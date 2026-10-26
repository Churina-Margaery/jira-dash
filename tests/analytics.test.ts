import test from 'node:test';
import assert from 'node:assert/strict';
import { durationUnit, histogram } from '../src/analytics/histogram.js';
import { histogramChart } from '../src/report/charts.js';
import { calculate, closureTime, timeByStatus, topUsers } from '../src/analytics/calculate.js';
import { normalizeIssue } from '../src/jira/normalize.js';
import { parseDataset } from '../src/storage.js';
import { renderReport } from '../src/report/render.js';
import { issue, rawIssue, testDataset } from './fixtures.js';

test('гистограмма включает максимум ровно один раз', () => {
  assert.deepEqual(histogram([0, 1, 2, 3, 4], 2).map(bin => bin.count), [2, 3]);
});

test('пустая гистограмма и нулевые длительности', () => {
  assert.deepEqual(histogram([], 5), []);
  assert.deepEqual(histogram([0, 0], 5), [{ from: 0, to: 1, count: 2 }]);
  assert.throws(() => histogram([-1], 5));
  assert.throws(() => histogram([1], 0));
});

test('длинные сроки имеют шаг в целых месяцах и не теряют задачи', () => {
  const values = [0, 24, 1440, 2880, 16898.657];
  const bins = histogram(values, 15);
  assert.equal(bins[0]!.to, 1440);
  assert.equal(durationUnit(bins[0]!.to).label, 'месяцы');
  assert.deepEqual(bins.slice(0, 3).map(bin => bin.count), [2, 1, 1]);
  assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), values.length);
  assert.ok(bins.at(-1)!.to >= values.at(-1)!);
  assert.ok(bins.length <= 15);
  assert.ok(histogramChart(bins).includes('Шаг интервала: 2 мес.'));
});

test('короткие трудозатраты отображаются в минутах', () => {
  const bins = histogram([0, 0.5], 15);
  const html = histogramChart(bins);
  assert.ok(html.includes('Время, минуты'));
  assert.ok(html.includes('Шаг интервала: 2 мин'));
  assert.equal(bins.at(-1)!.count, 1);
  assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), 2);
});

test('округление на границе единиц даёт один день вместо 25 часов', () => {
  const bins = histogram([23], 1);
  assert.deepEqual(bins, [{ from: 0, to: 24, count: 1 }]);
  assert.equal(durationUnit(bins[0]!.to).label, 'дни');
  assert.ok(histogramChart(bins).includes('Шаг интервала: 1 дн.'));
});

test('жизненный цикл учитывает только сейчас закрытые задачи', () => {
  const metrics = calculate([issue(), issue({ key: 'TEST-2', status: 'Open', resolved: null })], ['Closed'], 2);
  assert.equal(metrics.closedCount, 1);
  assert.equal(metrics.lifetime.at(-1)!.to, 48);
  assert.equal(metrics.lifetime.reduce((sum, bin) => sum + bin.count, 0), 1);
});

test('дата закрытия из перехода важнее resolutiondate', () => {
  const task = issue({ resolved: '2025-01-02T00:00:00.000Z' });
  assert.equal(closureTime(task, ['Closed'])!.at, Date.parse('2025-01-03T00:00:00Z'));
});

test('повторные открытия суммируют посещения статусов', () => {
  const task = issue({ changes: [
    { at: '2025-01-02T00:00:00.000Z', from: 'Open', to: 'Closed' },
    { at: '2025-01-03T00:00:00.000Z', from: 'Closed', to: 'Open' },
    { at: '2025-01-04T00:00:00.000Z', from: 'Open', to: 'Closed' },
  ] });
  const at = closureTime(task, ['Closed'])!.at;
  assert.equal(at, Date.parse('2025-01-04T00:00:00Z'));
  assert.deepEqual([...timeByStatus(task, at)], [['Open', 48], ['Closed', 24]]);
});

test('переход внутри группы конечных статусов не меняет дату закрытия', () => {
  const task = issue({ changes: [
    { at: '2025-01-02T00:00:00.000Z', from: 'Open', to: 'Resolved' },
    { at: '2025-01-03T00:00:00.000Z', from: 'Resolved', to: 'Closed' },
  ] });
  assert.equal(closureTime(task, ['Resolved', 'Closed'])!.at, Date.parse('2025-01-02T00:00:00Z'));
});

test('дни без событий заполнены нулями, накопительные суммы точны', () => {
  assert.deepEqual(calculate([issue()], ['Closed'], 5).daily, [
    { day: '2025-01-01', created: 1, closed: 0, createdTotal: 1, closedTotal: 0 },
    { day: '2025-01-02', created: 0, closed: 0, createdTotal: 1, closedTotal: 0 },
    { day: '2025-01-03', created: 0, closed: 1, createdTotal: 1, closedTotal: 1 },
  ]);
});

test('календарные дни приводятся к UTC', () => {
  const metrics = calculate([issue({ status: 'Open', created: '2025-01-01T01:00:00+03:00' })], ['Closed'], 5);
  assert.equal(metrics.daily[0]!.day, '2024-12-31');
});

test('совпадение ролей не удваивает число уникальных задач', () => {
  const users = topUsers([issue({ reporter: { id: 'a', name: 'Alice' } })]);
  assert.deepEqual(users, [{ id: 'a', name: 'Alice', assigned: 1, reported: 1, total: 1 }]);
});

test('пользователи с одинаковыми именами различаются по ID; топ ограничен 30', () => {
  const tasks = Array.from({ length: 40 }, (_, i) => issue({ key: `TEST-${i}`, assignee: { id: String(i), name: 'Same' }, reporter: null }));
  assert.equal(topUsers(tasks).length, 30);
  assert.equal(topUsers(tasks)[0]!.total, 1);
});

test('timespent переводится в часы; null исключается, ноль сохраняется', () => {
  const metrics = calculate([issue(), issue({ loggedSeconds: null }), issue({ loggedSeconds: 0 })], ['Closed'], 2);
  assert.equal(metrics.missingWorklogs, 1);
  assert.equal(metrics.worklogs.reduce((sum, bin) => sum + bin.count, 0), 2);
  assert.equal(metrics.worklogs.at(-1)!.to, 2);
});

test('серьёзность считается по всем задачам, включая открытые', () => {
  const metrics = calculate([issue(), issue({ status: 'Open', priority: 'Minor' })], ['Closed'], 2);
  assert.deepEqual(metrics.priorities, [{ priority: 'Major', count: 1 }, { priority: 'Minor', count: 1 }]);
});

test('неполная история Jira вызывает ошибку, а не неточный отчёт', () => {
  const raw = rawIssue();
  raw.changelog.total = 50;
  assert.throws(() => normalizeIssue(raw), /история изменений неполная/);
});

test('нормализация серверного ответа', () => {
  assert.deepEqual(normalizeIssue(rawIssue()), issue());
});

test('fallback на resolutiondate сопровождается замечанием', () => {
  const metrics = calculate([issue({ changes: [] })], ['Closed'], 5);
  assert.equal(metrics.warnings.length, 1);
  assert.equal(metrics.statuses.length, 0);
});

test('невалидный порядок истории и закрытие до создания не принимаются', () => {
  assert.throws(() => timeByStatus(issue(), Date.parse('2024-01-01')), /раньше создания/);
  const task = issue();
  task.changes[1]!.from = 'Unknown';
  assert.throws(() => timeByStatus(task, Date.parse('2025-01-03')), /несогласованная/);
});

test('проверка сохранённого снимка обнаруживает дубликаты', () => {
  const dataset = testDataset();
  assert.equal(parseDataset(dataset).issues.length, 3);
  dataset.issues[1] = dataset.issues[0]!;
  assert.throws(() => parseDataset(dataset), /дубликаты/);
});

test('HTML содержит 6 разделов и экранирует имена из Jira', () => {
  const dataset = testDataset();
  dataset.project = '<script>alert(1)</script>';
  const html = renderReport(dataset, calculate(dataset.issues, ['Closed'], 5), ['Closed']);
  assert.equal((html.match(/<section>/g) ?? []).length, 6);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
});
