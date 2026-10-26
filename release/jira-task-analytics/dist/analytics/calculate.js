import { histogram } from './histogram.js';
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Находит последнее вхождение в группу закрытых статусов для сейчас закрытой задачи. */
export function closureTime(issue, closedStatuses) {
    const closed = new Set(closedStatuses);
    if (!closed.has(issue.status))
        return null;
    const transition = issue.changes.filter(change => !closed.has(change.from) && closed.has(change.to)).at(-1);
    if (transition)
        return { at: Date.parse(transition.at), fallback: false };
    if (issue.resolved)
        return { at: Date.parse(issue.resolved), fallback: true };
    return null;
}
/** Суммирует повторные посещения каждого статуса до последнего закрытия, в часах. */
export function timeByStatus(issue, closedAt) {
    const result = new Map();
    let cursor = Date.parse(issue.created);
    let status = issue.changes[0]?.from ?? issue.status;
    if (closedAt < cursor)
        throw new Error(`${issue.key}: закрытие раньше создания`);
    const add = (until) => result.set(status, (result.get(status) ?? 0) + (until - cursor) / HOUR_MS);
    for (const change of issue.changes) {
        const at = Date.parse(change.at);
        if (at < cursor || change.from !== status)
            throw new Error(`${issue.key}: несогласованная история статусов`);
        if (at > closedAt)
            break;
        add(at);
        cursor = at;
        status = change.to;
    }
    if (cursor < closedAt)
        add(closedAt);
    return result;
}
/** Считает уникальные задачи пользователя, сохраняя отдельные счётчики ролей. */
export function topUsers(issues, limit = 30) {
    const users = new Map();
    const get = (user) => {
        let entry = users.get(user.id);
        if (!entry) {
            entry = { ...user, assigned: 0, reported: 0, total: 0 };
            users.set(user.id, entry);
        }
        return entry;
    };
    for (const issue of issues) {
        if (issue.assignee)
            get(issue.assignee).assigned++;
        if (issue.reporter)
            get(issue.reporter).reported++;
        for (const id of new Set([issue.assignee?.id, issue.reporter?.id])) {
            if (id)
                users.get(id).total++;
        }
    }
    return [...users.values()].sort((a, b) => b.total - a.total || a.id.localeCompare(b.id)).slice(0, limit);
}
/** Строит шесть наборов метрик; календарные дни считаются в UTC. */
export function calculate(issues, closedStatuses, binCount) {
    const lifetimes = [];
    const loggedHours = [];
    const statuses = new Map();
    const priorities = new Map();
    const events = new Map();
    const warnings = [];
    let closedCount = 0;
    let missingWorklogs = 0;
    const event = (at) => {
        const day = new Date(at).toISOString().slice(0, 10);
        if (!events.has(day))
            events.set(day, { created: 0, closed: 0 });
        return events.get(day);
    };
    for (const issue of issues) {
        event(Date.parse(issue.created)).created++;
        priorities.set(issue.priority, (priorities.get(issue.priority) ?? 0) + 1);
        if (!closedStatuses.includes(issue.status))
            continue;
        closedCount++;
        if (issue.loggedSeconds === null)
            missingWorklogs++;
        else
            loggedHours.push(issue.loggedSeconds / 3600);
        const closure = closureTime(issue, closedStatuses);
        if (!closure) {
            warnings.push(`${issue.key}: нет даты закрытия, исключена из временных графиков`);
            continue;
        }
        const lifetime = (closure.at - Date.parse(issue.created)) / HOUR_MS;
        if (lifetime < 0)
            throw new Error(`${issue.key}: закрытие раньше создания`);
        lifetimes.push(lifetime);
        event(closure.at).closed++;
        if (closure.fallback) {
            warnings.push(`${issue.key}: дата закрытия взята из resolutiondate; нет перехода в закрытый статус. Время по статусам не рассчитывается.`);
            continue;
        }
        for (const [status, hours] of timeByStatus(issue, closure.at)) {
            if (!statuses.has(status))
                statuses.set(status, []);
            statuses.get(status).push(hours);
        }
    }
    const days = [...events.keys()].sort();
    const daily = [];
    let createdTotal = 0;
    let closedTotal = 0;
    if (days.length) {
        const end = Date.parse(days.at(-1));
        for (let date = Date.parse(days[0]); date <= end; date += DAY_MS) {
            const day = new Date(date).toISOString().slice(0, 10);
            const counts = events.get(day) ?? { created: 0, closed: 0 };
            createdTotal += counts.created;
            closedTotal += counts.closed;
            daily.push({ day, ...counts, createdTotal, closedTotal });
        }
    }
    return {
        issueCount: issues.length, closedCount, missingWorklogs, warnings,
        lifetime: histogram(lifetimes, binCount),
        statuses: [...statuses].sort(([a], [b]) => a.localeCompare(b)).map(([status, values]) => ({ status, histogram: histogram(values, binCount) })),
        daily, users: topUsers(issues), worklogs: histogram(loggedHours, binCount),
        priorities: [...priorities].sort((a, b) => b[1] - a[1]).map(([priority, count]) => ({ priority, count })),
    };
}
//# sourceMappingURL=calculate.js.map