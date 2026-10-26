import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type RequestListener } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JiraClient } from '../src/jira/client.js';
import { loadConfig } from '../src/config.js';
import { loadDataset, saveDataset, saveFile } from '../src/storage.js';
import { calculate } from '../src/analytics/calculate.js';
import { renderReport } from '../src/report/render.js';
import { config, rawIssue } from './fixtures.js';

async function serverFor(t: TestContext, handler: RequestListener): Promise<string> {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  }));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Нет порта тестового сервера');
  return `http://127.0.0.1:${address.port}`;
}

test('HTTP → пагинация → JSON на диске → аналитика → HTML', async t => {
  const starts: number[] = [];
  const baseUrl = await serverFor(t, (request, response) => {
    const url = new URL(request.url!, 'http://localhost');
    assert.equal(url.pathname, '/rest/api/2/search');
    assert.equal(url.searchParams.get('expand'), 'changelog');
    assert.equal(request.headers.authorization, undefined);
    assert.match(url.searchParams.get('jql')!, /project = "TEST"/);
    const startAt = Number(url.searchParams.get('startAt'));
    starts.push(startAt);
    // Сервер может ограничить страницу сильнее запрошенного pageSize.
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ startAt, total: 3, issues: [rawIssue(`TEST-${startAt + 1}`)] }));
  });
  const directory = await mkdtemp(join(tmpdir(), 'jira-integration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dataset = await new JiraClient({ ...config, baseUrl }, '').fetchProject();
  assert.deepEqual(starts, [0, 1, 2]);
  assert.equal(dataset.complete, true);
  const path = join(directory, 'issues.json');
  await saveDataset(path, dataset);
  const loaded = await loadDataset(path);
  const metrics = calculate(loaded.issues, ['Closed'], 5);
  assert.equal(metrics.closedCount, 3);
  assert.equal(metrics.daily.at(-1)!.closedTotal, 3);
  await saveFile(join(directory, 'index.html'), renderReport(loaded, metrics, ['Closed']));
  assert.ok((await readFile(join(directory, 'index.html'), 'utf8')).includes('<svg'));
});

test('maxIssues помечает отчёт как неполный', async t => {
  const baseUrl = await serverFor(t, (_request, response) => {
    response.end(JSON.stringify({ startAt: 0, total: 20, issues: [rawIssue()] }));
  });
  const dataset = await new JiraClient({ ...config, baseUrl, maxIssues: 1 }, '').fetchProject();
  assert.equal(dataset.complete, false);
  assert.equal(dataset.issues.length, 1);
});

test('429 повторяется с ограничением числа попыток', async t => {
  let attempts = 0;
  const baseUrl = await serverFor(t, (_request, response) => {
    attempts++;
    response.statusCode = attempts === 1 ? 429 : 200;
    response.setHeader('Retry-After', '0');
    response.end(JSON.stringify({ startAt: 0, total: 0, issues: [] }));
  });
  const dataset = await new JiraClient({ ...config, baseUrl, retries: 1 }, '').fetchProject();
  assert.equal(attempts, 2);
  assert.equal(dataset.complete, true);
});

test('401 не повторяется и объясняет проблему авторизации', async t => {
  let attempts = 0;
  const baseUrl = await serverFor(t, (_request, response) => {
    attempts++;
    response.writeHead(401).end();
  });
  await assert.rejects(new JiraClient({ ...config, baseUrl, retries: 3 }, '').fetchProject(), /анонимный доступ запрещён/);
  assert.equal(attempts, 1);
});

test('зависший HTTP-запрос прерывается по таймауту', async t => {
  const baseUrl = await serverFor(t, () => {});
  await assert.rejects(new JiraClient({ ...config, baseUrl, timeoutMs: 40 }, '').fetchProject(), /timeout/i);
});

test('пустая страница до конца списка обнаруживается', async t => {
  const baseUrl = await serverFor(t, (_request, response) => {
    response.end(JSON.stringify({ startAt: 0, total: 10, issues: [] }));
  });
  await assert.rejects(new JiraClient({ ...config, baseUrl }, '').fetchProject(), /пустую страницу/);
});

test('конфигурация валидируется до обращения к API', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'jira-config-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'config.json');
  await saveFile(path, JSON.stringify({ ...config, project: 'HDFS OR project = OTHER' }));
  await assert.rejects(loadConfig(path), /ключ проекта/);
  await saveFile(path, JSON.stringify({ ...config, pageSize: 0 }));
  await assert.rejects(loadConfig(path), /pageSize/);
});
