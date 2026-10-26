import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { object, string, timestamp, nonnegative, type Dataset, type Issue, type User } from './model.js';

/** Записывает файл через временный, чтобы ошибка не испортила предыдущий результат. */
export async function saveFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, contents, 'utf8');
  await rename(temporary, path);
}

/** Сохраняет нормализованный снимок для повторяемых расчётов без сети. */
export async function saveDataset(path: string, dataset: Dataset): Promise<void> {
  await saveFile(path, JSON.stringify(dataset, null, 2));
}

/** Загружает и проверяет локальный снимок; повреждённые данные не пропускает. */
export async function loadDataset(path: string): Promise<Dataset> {
  return parseDataset(JSON.parse(await readFile(path, 'utf8')));
}

/** Проверяет версию, метаданные и обязательные поля сохранённого снимка. */
export function parseDataset(value: unknown): Dataset {
  const raw = object(value, 'Снимок');
  if (raw.version !== 1 || !Array.isArray(raw.issues) || typeof raw.complete !== 'boolean') {
    throw new Error('Неподдерживаемый формат снимка');
  }
  const parseUser = (value: unknown): User | null => {
    if (value === null) return null;
    const raw = object(value, 'user');
    return { id: string(raw.id, 'user.id'), name: string(raw.name, 'user.name') };
  };
  const issues: Issue[] = raw.issues.map(value => {
    const issue = object(value, 'issue');
    if (!Array.isArray(issue.changes)) throw new Error('Отсутствует история статусов');
    return {
      key: string(issue.key, 'key'), created: timestamp(issue.created, 'created'),
      resolved: issue.resolved === null ? null : timestamp(issue.resolved, 'resolved'),
      status: string(issue.status, 'status'), priority: string(issue.priority, 'priority'),
      assignee: parseUser(issue.assignee), reporter: parseUser(issue.reporter),
      loggedSeconds: issue.loggedSeconds === null ? null : nonnegative(issue.loggedSeconds, 'loggedSeconds'),
      changes: issue.changes.map(value => {
        const change = object(value, 'change');
        return { at: timestamp(change.at, 'change.at'), from: string(change.from, 'change.from'), to: string(change.to, 'change.to') };
      }).sort((a, b) => a.at.localeCompare(b.at)),
    };
  });
  const total = nonnegative(raw.total, 'total');
  if (!Number.isInteger(total) || total < issues.length || raw.complete !== (total === issues.length) ||
      new Set(issues.map(issue => issue.key)).size !== issues.length) {
    throw new Error('Снимок содержит дубликаты или противоречивые счётчики');
  }
  return {
    version: 1, source: string(raw.source, 'source'), project: string(raw.project, 'project'),
    fetchedAt: timestamp(raw.fetchedAt, 'fetchedAt'), jql: string(raw.jql, 'jql'),
    total, complete: raw.complete, issues,
  };
}
