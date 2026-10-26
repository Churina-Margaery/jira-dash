/** Минимальная модель: сохраняем только данные, необходимые для отчёта. */
export interface User {
  id: string;
  name: string;
}

export interface StatusChange {
  at: string;
  from: string;
  to: string;
}

export interface Issue {
  key: string;
  created: string;
  resolved: string | null;
  status: string;
  priority: string;
  assignee: User | null;
  reporter: User | null;
  loggedSeconds: number | null;
  changes: StatusChange[];
}

export interface Dataset {
  version: 1;
  source: string;
  project: string;
  fetchedAt: string;
  jql: string;
  total: number;
  complete: boolean;
  issues: Issue[];
}

/** Проверяет структуру JSON до доступа к его полям. */
export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: ожидался объект`);
  }
  return value as Record<string, unknown>;
}

/** Проверяет строковое поле ответа или сохранённых данных. */
export function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}: ожидалась непустая строка`);
  return value;
}

/** Проверяет дату, возвращая нормализованную UTC-строку. */
export function timestamp(value: unknown, label: string): string {
  const text = string(value, label);
  const millis = Date.parse(text);
  if (!Number.isFinite(millis)) throw new Error(`${label}: некорректная дата`);
  return new Date(millis).toISOString();
}

/** Проверяет неотрицательное числовое значение. */
export function nonnegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label}: ожидалось неотрицательное число`);
  }
  return value;
}
