import { object, string, timestamp, nonnegative } from '../model.js';
function user(value) {
    if (value == null)
        return null;
    const raw = object(value, 'Пользователь');
    return {
        id: string(raw.key ?? raw.accountId ?? raw.name, 'ID пользователя'),
        name: string(raw.displayName ?? raw.name, 'Имя пользователя'),
    };
}
/** Преобразует ответ Jira Server/Data Center; неполную историю не принимает. */
export function normalizeIssue(value) {
    const raw = object(value, 'Задача');
    const key = string(raw.key, 'key');
    const fields = object(raw.fields, `${key}.fields`);
    const changelog = object(raw.changelog, `${key}.changelog`);
    if (!Array.isArray(changelog.histories) || changelog.startAt !== 0 ||
        changelog.total !== changelog.histories.length) {
        throw new Error(`${key}: история изменений неполная; расчёт времени по статусам остановлен`);
    }
    const changes = [];
    for (const value of changelog.histories) {
        const history = object(value, `${key}.history`);
        if (!Array.isArray(history.items))
            throw new Error(`${key}: отсутствуют элементы истории`);
        for (const value of history.items) {
            const item = object(value, `${key}.history.item`);
            if (item.field === 'status') {
                changes.push({
                    at: timestamp(history.created, `${key}.history.created`),
                    from: string(item.fromString, `${key}.fromString`),
                    to: string(item.toString, `${key}.toString`),
                });
            }
        }
    }
    return {
        key,
        created: timestamp(fields.created, `${key}.created`),
        resolved: fields.resolutiondate == null ? null : timestamp(fields.resolutiondate, `${key}.resolutiondate`),
        status: string(object(fields.status, `${key}.status`).name, `${key}.status.name`),
        priority: fields.priority == null ? 'Не указана' : string(object(fields.priority, 'priority').name, 'priority.name'),
        assignee: user(fields.assignee), reporter: user(fields.reporter),
        loggedSeconds: fields.timespent == null ? null : nonnegative(fields.timespent, `${key}.timespent`),
        changes: changes.sort((a, b) => a.at.localeCompare(b.at)),
    };
}
//# sourceMappingURL=normalize.js.map