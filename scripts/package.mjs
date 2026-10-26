import { cp, mkdir, rm, writeFile, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const target = 'release/jira-task-analytics';
await rm(target, { recursive: true, force: true });
await mkdir(`${target}/scripts`, { recursive: true });
for (const entry of ['dist', 'config', 'README.md']) {
  await cp(entry, `${target}/${entry}`, { recursive: true });
}
for (const script of ['run.sh', 'run.cmd']) await cp(`scripts/${script}`, `${target}/scripts/${script}`);
await chmod(`${target}/scripts/run.sh`, 0o755);
await writeFile(`${target}/package.json`, JSON.stringify({ name: 'jira-task-analytics', version: '1.0.0', type: 'module', engines: { node: '>=22' } }, null, 2));
execFileSync('tar', ['-czf', 'release/jira-task-analytics.tar.gz', '-C', 'release', 'jira-task-analytics']);
console.log('Дистрибутив: release/jira-task-analytics.tar.gz (для запуска нужен Node.js 22+)');
