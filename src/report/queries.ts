import type { Dataset } from '../model.js';
import { escapeHtml as escape } from './charts.js';

interface QueryExample {
  label: string;
  jql: string;
}

/** Экранирует строковое значение для литерала JQL. */
export function quoteJql(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Показывает JQL и пояснение вычислений для графика. */
export function queryDetails(examples: QueryExample[], calculation: string): string {
  const queries = examples.map(example => `<p><strong>${escape(example.label)}</strong></p><pre><code>${escape(example.jql)}</code></pre>`).join('');
  return `<aside class="queries">${queries}<p><strong>Расчёт в приложении:</strong> ${escape(calculation)}</p></aside>`;
}

/** Создаёт подписи запросов для шести видов графиков и отдельных статусов. */
export function chartQueries(dataset: Dataset, closedStatuses: string[]) {
  const project = `project = ${quoteJql(dataset.project)}`;
  const closed = `${project} AND status IN (${closedStatuses.map(quoteJql).join(', ')})`;
  const ordered = (jql: string) => `${jql} ORDER BY created DESC, key DESC`;
  const scope = dataset.complete
    ? `Расчёт по ${dataset.issues.length} задачам проекта ${dataset.project}. `
    : `Расчёт по неполной выборке: ${dataset.issues.length} из ${dataset.total} задач проекта ${dataset.project}. JQL описывает отбор по всему проекту. `;
  const detail = (jql: string, calculation: string) => queryDetails([
    { label: 'JQL', jql: ordered(jql) },
  ], scope + calculation);
  return {
    lifetime: detail(closed,
      'Для сейчас закрытых задач из changelog берётся последнее вхождение в группу закрытых статусов, затем вычитается created. При отсутствии перехода используется resolutiondate; при отсутствии обеих дат задача исключается. Повторные открытия учитываются. Полученные длительности группируются в равные округлённые интервалы.'),
    status: (status?: string) => detail(status === undefined ? closed : `${closed} AND status WAS ${quoteJql(status)}`,
      'Для сейчас закрытых задач по changelog суммируется время всех посещений этого статуса до последнего закрытия. Учитываются только задачи, посещавшие статус и имеющие подтверждённый переход в закрытый статус. Затем строится гистограмма суммарных длительностей.'),
    daily: queryDetails([
      { label: 'JQL — созданные задачи', jql: ordered(project) },
      { label: 'JQL — закрытые задачи', jql: ordered(closed) },
    ], scope + 'Создания группируются по created в UTC. Закрытия — по последнему вхождению в группу закрытых статусов из changelog (или resolutiondate при отсутствии перехода), только у сейчас закрытых задач. Пустые дни заполняются нулями, накопительные итоги получаются последовательным суммированием дневных значений.'),
    users: detail(project,
      'Задачи группируются по ID исполнителя и репортера. Если один человек выполняет обе роли в задаче, в общем количестве она учитывается один раз. Выбираются 30 пользователей с наибольшим числом уникальных задач; обе роли показаны отдельно.'),
    worklogs: detail(closed,
      'timespent — суммарное залогированное время всех участников задачи в секундах. Для сейчас закрытых задач это время переводится в часы и группируется в интервалы. Пустое значение исключается, явный ноль учитывается. Единица отображения выбирается автоматически.'),
    priorities: detail(project,
      'Все задачи выборки группируются по полю priority. Высота столбца — число задач с соответствующим значением серьёзности.'),
  };
}
