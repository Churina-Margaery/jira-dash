import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { JiraClient } from './jira/client.js';
import { calculate } from './analytics/calculate.js';
import { renderReport } from './report/render.js';
import { loadDataset, saveDataset, saveFile } from './storage.js';
import { initializeLogger, log } from './logger.js';
/** Команды: fetch, report, run (обе операции). */
async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || !args.length) {
        console.log('Использование: npm start -- <fetch|report|run> [--config config/default.json]\nfetch — скачать; report — локальный отчёт; run — скачать и построить.');
        return;
    }
    const command = args[0];
    if (!['fetch', 'report', 'run'].includes(command))
        throw new Error(`Неизвестная команда: ${command}`);
    if (args.length !== 1 && !(args.length === 3 && args[1] === '--config'))
        throw new Error('Ожидается --config <путь>');
    const config = await loadConfig(args[2] ?? 'config/default.json');
    const paths = [config.dataFile, config.reportFile, `${config.reportFile}.json`, config.logFile, args[2] ?? 'config/default.json'].map(path => resolve(path));
    if (new Set(paths).size !== paths.length)
        throw new Error('Пути данных, отчётов, логов и конфигурации должны различаться');
    initializeLogger(config.logFile);
    log(`Начало команды ${command}; проект ${config.project}; файл логов: ${resolve(config.logFile)}`);
    const { dataFile, reportFile } = config;
    let dataset;
    if (command === 'fetch' || command === 'run') {
        dataset = await new JiraClient(config).fetchProject();
        await saveDataset(dataFile, dataset);
        log(`Данные сохранены: ${resolve(dataFile)}`);
        if (command === 'fetch') {
            log(`Команда fetch завершена; задач: ${dataset.issues.length}; полный снимок: ${dataset.complete}`);
            return;
        }
    }
    else
        dataset = await loadDataset(dataFile);
    if (dataset.project !== config.project)
        throw new Error('Проект в снимке не совпадает с конфигурацией');
    const { closedStatuses } = config;
    const analytics = calculate(dataset.issues, closedStatuses, config.histogramBins);
    for (const warning of analytics.warnings)
        log(warning, 'WARN');
    await saveFile(reportFile, renderReport(dataset, analytics, closedStatuses));
    await saveFile(`${reportFile}.json`, JSON.stringify({ dataset: { ...dataset, issues: undefined }, closedStatuses, analytics }, null, 2));
    log(`Отчёт готов: ${resolve(reportFile)}`);
    log(`Задач: ${analytics.issueCount}; закрытых: ${analytics.closedCount}; замечаний: ${analytics.warnings.length}`);
    log(`Команда ${command} завершена`);
}
main().catch((error) => {
    const message = `Ошибка: ${error instanceof Error ? error.message : String(error)}`;
    try {
        log(message, 'ERROR');
    }
    catch (loggingError) {
        console.error(`${message}\nНе удалось записать лог: ${loggingError instanceof Error ? loggingError.message : String(loggingError)}`);
    }
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map