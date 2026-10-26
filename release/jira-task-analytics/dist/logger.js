import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
let logFile;
/** Создаёт файл логов; существующие записи сохраняются между запусками. */
export function initializeLogger(path) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, '', 'utf8');
    logFile = path;
}
/** Пишет событие с UTC-временем и уровнем в stderr и настроенный файл. */
export function log(message, level = 'INFO') {
    const line = `[${new Date().toISOString()}] [${level}] ${message.replace(/[\r\n]+/g, ' ')}`;
    console.error(line);
    // Синхронная запись гарантирует сохранение последней ошибки перед выходом CLI.
    if (logFile)
        appendFileSync(logFile, `${line}\n`, 'utf8');
}
//# sourceMappingURL=logger.js.map