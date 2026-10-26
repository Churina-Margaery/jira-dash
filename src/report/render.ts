import type { Dataset } from '../model.js';
import type { Analytics } from '../analytics/calculate.js';
import { dailyChart, escapeHtml as escape, histogramChart, priorityChart, usersChart } from './charts.js';
import { chartQueries } from './queries.js';

/** Формирует автономный HTML: графики, JQL и пояснения расчётов. */
export function renderReport(dataset: Dataset, metrics: Analytics, closedStatuses: string[]): string {
  const section = (title: string, chart: string) => `<section><h2>${title}</h2>${chart}</section>`;
  const queries = chartQueries(dataset, closedStatuses);
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Аналитика ${escape(dataset.project)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f2f5f9;color:#203149;font:16px/1.6 system-ui,sans-serif}main{max-width:1140px;margin:auto;padding:12px 24px 40px}h2{font-size:23px;line-height:1.3}h3{font-size:18px}p{color:#52627b}section{background:white;border:1px solid #dfe6f0;border-radius:16px;padding:24px;margin:24px 0}svg{display:block;width:100%;height:auto;font:12px system-ui,sans-serif;fill:#52627b}svg rect,svg path{vector-effect:non-scaling-stroke}.legend{display:flex;gap:20px;flex-wrap:wrap;font-size:14px}.empty{padding:30px;text-align:center;background:#f7f9fc}.queries{margin-top:20px;padding:16px 20px;background:#f7f9fc;border:1px solid #dfe6f0;border-radius:10px;font-size:14px}.queries p{margin:8px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#edf1f7;padding:12px;border-radius:6px;font-size:13px;line-height:1.6}pre code{font-family:ui-monospace,monospace}@media print{body{background:white}section{break-inside:avoid}main{padding:0}}
</style></head><body><main>
${section('1. Время от создания до закрытия', histogramChart(metrics.lifetime) + queries.lifetime)}
${section('2. Время в каждом статусе', metrics.statuses.length ? metrics.statuses.map(item => `<h3>${escape(item.status)}</h3>${histogramChart(item.histogram)}${queries.status(item.status)}`).join('') : '<p class="empty">Нет полных историй закрытых задач.</p>' + queries.status())}
${section('3. Созданные и закрытые задачи по дням', dailyChart(metrics.daily) + queries.daily)}
${section('4. Топ-30 пользователей', usersChart(metrics.users) + queries.users)}
${section('5. Залогированное время на задачу', histogramChart(metrics.worklogs) + queries.worklogs)}
${section('6. Количество задач по серьёзности', priorityChart(metrics.priorities) + queries.priorities)}
</main></body></html>`;
}
