import { rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

// Удалённые исходные модули не должны оставаться в сборке и дистрибутиве.
await rm('dist', { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });
