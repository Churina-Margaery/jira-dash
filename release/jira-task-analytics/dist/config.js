import { readFile } from 'node:fs/promises';
import { object, string } from './model.js';
/** Загружает настройки. Пути к данным считаются от рабочей директории. */
export async function loadConfig(path) {
    const raw = object(JSON.parse(await readFile(path, 'utf8')), 'Конфигурация');
    const url = new URL(string(raw.baseUrl, 'baseUrl'));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('baseUrl должен быть HTTP(S) URL без пароля, query и fragment');
    }
    const project = string(raw.project, 'project');
    if (!/^[A-Z][A-Z0-9_]*$/.test(project))
        throw new Error('Некорректный ключ проекта');
    if (!Array.isArray(raw.closedStatuses) || !raw.closedStatuses.length) {
        throw new Error('closedStatuses должен содержать хотя бы один статус');
    }
    const integer = (key, min, max) => {
        const value = raw[key];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
            throw new Error(`${key}: ожидалось целое число от ${min} до ${max}`);
        }
        return value;
    };
    return {
        baseUrl: url.toString().replace(/\/$/, ''), project,
        closedStatuses: raw.closedStatuses.map(value => string(value, 'closedStatuses')),
        pageSize: integer('pageSize', 1, 1000),
        maxIssues: integer('maxIssues', 0, 1_000_000),
        timeoutMs: integer('timeoutMs', 1, 300_000),
        retries: integer('retries', 0, 10),
        requestDelayMs: integer('requestDelayMs', 0, 60_000),
        histogramBins: integer('histogramBins', 1, 100),
        dataFile: string(raw.dataFile, 'dataFile'),
        reportFile: string(raw.reportFile, 'reportFile'),
        logFile: string(raw.logFile ?? 'logs/jira-analytics.log', 'logFile'),
    };
}
//# sourceMappingURL=config.js.map