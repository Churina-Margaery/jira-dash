import test from 'node:test';
import assert from 'node:assert/strict';
import { testDataset } from './fixtures.js';
import { calculate } from '../src/analytics/calculate.js';
import { renderReport } from '../src/report/render.js';
import { chartQueries, quoteJql } from '../src/report/queries.js';
import { escapeHtml } from '../src/report/charts.js';

function dataset() {
  return {
    ...testDataset(), source: 'https://issues.apache.org/jira', project: 'HDFS',
    jql: 'project = "HDFS" ORDER BY created DESC, key DESC',
  };
}

test('отчёт содержит только графики, JQL и пояснения расчётов', () => {
  const data = dataset();
  const html = renderReport(data, calculate(data.issues, ['Closed'], 5), ['Closed']);
  const sections = [...html.matchAll(/<section>([\s\S]*?)<\/section>/g)];
  assert.equal(sections.length, 6);
  for (const section of sections) {
    assert.ok(section[1]!.includes('JQL'));
    assert.ok(section[1]!.includes('<svg'));
    assert.ok(section[1]!.includes('Расчёт в приложении:'));
  }
  assert.ok(!html.includes('REST API'));
  assert.ok(!html.includes('<details'));
  assert.ok(!html.includes('<table'));
  assert.ok(!html.includes('class="cards"'));
  assert.ok(!html.includes('Источник:'));
  assert.ok(html.includes('status WAS &quot;Open&quot;'));
  assert.ok(html.includes('status IN (&quot;Closed&quot;)'));

});

test('неполная выборка обозначена внутри пояснения расчёта', () => {
  const data = { ...dataset(), complete: false, total: 1000 };
  const html = renderReport(data, calculate(data.issues, ['Closed'], 5), ['Closed']);
  assert.ok(html.includes('Расчёт по неполной выборке: 3 из 1000 задач'));
  assert.ok(html.includes('JQL описывает отбор по всему проекту'));
  assert.ok(!html.includes('Ключи загруженной выборки'));
});

test('имена статусов экранируются отдельно для JQL и HTML', () => {
  const status = 'Ready "review"\\x<script>';
  assert.equal(quoteJql(status), '"Ready \\"review\\"\\\\x<script>"');
  const details = chartQueries(dataset(), [status]).status(status);
  assert.ok(!details.includes('<script>'));
  assert.ok(details.includes(escapeHtml(`status IN (${quoteJql(status)})`)));
  assert.ok(details.includes(escapeHtml(`status WAS ${quoteJql(status)}`)));

});

