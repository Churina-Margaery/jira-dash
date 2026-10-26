import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializeLogger, log } from '../src/logger.js';

test('файл логов сохраняет записи между запусками, уровни и одну строку на событие', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'jira-logs-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'logs', 'app.log');
  initializeLogger(path);
  log('Первый запуск');
  initializeLogger(path);
  log('Повтор запроса', 'WARN');
  log('Ошибка\nс продолжением', 'ERROR');
  const lines = (await readFile(path, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0]!, /^\[\d{4}-\d{2}-\d{2}T.*Z\] \[INFO\] Первый запуск$/);
  assert.match(lines[1]!, /\[WARN\] Повтор запроса$/);
  assert.match(lines[2]!, /\[ERROR\] Ошибка с продолжением$/);
});
