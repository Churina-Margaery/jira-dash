import { setTimeout as sleep } from 'node:timers/promises';
import { log } from '../logger.js';
import { object, nonnegative } from '../model.js';
import { normalizeIssue } from './normalize.js';
class HttpError extends Error {
    status;
    retryAfterMs;
    constructor(status, retryAfterMs) {
        super(status === 401 || status === 403
            ? `JIRA HTTP ${status}: анонимный доступ запрещён. Проверьте права проекта; при необходимости задайте JIRA_TOKEN.`
            : `JIRA HTTP ${status}`);
        this.status = status;
        this.retryAfterMs = retryAfterMs;
    }
}
/** REST-клиент Apache Jira Server/Data Center API v2. */
export class JiraClient {
    config;
    token;
    constructor(config, token = process.env.JIRA_TOKEN) {
        this.config = config;
        this.token = token;
        if (token && !config.baseUrl.startsWith('https://'))
            throw new Error('Токен разрешён только для HTTPS');
    }
    /** Делает GET с таймаутом и ограниченными повторами сетевых ошибок, 429 и 5xx. */
    async get(path, parameters) {
        const url = new URL(`${this.config.baseUrl}/rest/api/2/${path}`);
        url.search = new URLSearchParams(parameters).toString();
        for (let attempt = 0;; attempt++) {
            const startedAt = Date.now();
            log(`GET ${url.toString()} — попытка ${attempt + 1}`);
            try {
                const response = await fetch(url, {
                    headers: { Accept: 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
                    signal: AbortSignal.timeout(this.config.timeoutMs),
                    redirect: 'error',
                });
                log(`HTTP ${response.status} — ${Date.now() - startedAt} мс — ${url.pathname}`, response.ok ? 'INFO' : 'WARN');
                if (!response.ok) {
                    const retryAfter = response.headers.get('retry-after');
                    const delay = retryAfter == null ? 0 : /^\d+$/.test(retryAfter)
                        ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
                    await response.body?.cancel();
                    throw new HttpError(response.status, Number.isFinite(delay) ? delay : 0);
                }
                return await response.json();
            }
            catch (error) {
                const retryable = error instanceof HttpError ? error.status === 429 || error.status >= 500
                    : error instanceof TypeError || (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name));
                if (!retryable || attempt >= this.config.retries) {
                    log(`Запрос завершился ошибкой: ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
                    throw error;
                }
                const delay = Math.max(500 * 2 ** attempt, error instanceof HttpError ? error.retryAfterMs : 0);
                // Не повторяем запрос раньше Retry-After; долгую паузу оставляем пользователю.
                if (delay > 60_000)
                    throw new Error(`JIRA просит повторить запрос через ${Math.ceil(delay / 1000)} с. Запустите загрузку позже.`);
                log(`Повтор запроса ${attempt + 1}/${this.config.retries} через ${delay} мс: ${error instanceof Error ? error.message : String(error)}`, 'WARN');
                await sleep(delay);
            }
        }
    }
    /** Загружает все страницы или maxIssues задач; 0 означает весь проект. */
    async fetchProject() {
        const jql = `project = "${this.config.project}" ORDER BY created DESC, key DESC`;
        const issues = [];
        const seen = new Set();
        let startAt = 0;
        let total;
        while (total === undefined || startAt < total) {
            const remaining = this.config.maxIssues === 0 ? Infinity : this.config.maxIssues - issues.length;
            if (remaining <= 0)
                break;
            const page = object(await this.get('search', {
                jql, startAt: String(startAt), maxResults: String(Math.min(this.config.pageSize, remaining)),
                fields: 'created,resolutiondate,status,priority,timespent,assignee,reporter', expand: 'changelog',
            }), 'JIRA search');
            const pageTotal = nonnegative(page.total, 'search.total');
            if (!Number.isInteger(pageTotal) || page.startAt !== startAt || !Array.isArray(page.issues)) {
                throw new Error('Некорректная страница JIRA');
            }
            if (total !== undefined && total !== pageTotal)
                throw new Error('Число задач изменилось во время загрузки. Повторите выгрузку.');
            total = pageTotal;
            if (!page.issues.length && startAt < total)
                throw new Error('JIRA вернула пустую страницу до конца списка');
            for (const raw of page.issues) {
                const issue = normalizeIssue(raw);
                if (seen.has(issue.key))
                    throw new Error(`Повтор задачи ${issue.key}: список изменился во время загрузки`);
                seen.add(issue.key);
                issues.push(issue);
            }
            startAt += page.issues.length;
            log(`Получено задач: ${issues.length} / ${total}`);
            if (startAt < total && (this.config.maxIssues === 0 || issues.length < this.config.maxIssues)) {
                await sleep(this.config.requestDelayMs);
            }
        }
        return {
            version: 1, source: this.config.baseUrl, project: this.config.project,
            fetchedAt: new Date().toISOString(), jql, total: total ?? 0,
            complete: issues.length === total, issues,
        };
    }
}
//# sourceMappingURL=client.js.map