import { durationUnit, niceStep } from '../analytics/histogram.js';
const COLORS = ['#3569df', '#df7540', '#168470', '#9c4dc4'];
const WIDTH = 1000;
const HEIGHT = 360;
const LEFT = 76;
const RIGHT = 970;
const TOP = 26;
const BOTTOM = 280;
/** Экранирует данные Jira перед вставкой в HTML и SVG. */
export function escapeHtml(value) {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function number(value) {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}
function text(x, y, value, anchor = 'middle') {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}">${escapeHtml(value)}</text>`;
}
function svg(contents, label, height = HEIGHT) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${escapeHtml(label)}"><title>${escapeHtml(label)}</title>${contents}</svg>`;
}
function frame(maximum, xLabel) {
    let result = '';
    for (let i = 0; i <= 4; i++) {
        const y = BOTTOM - (BOTTOM - TOP) * i / 4;
        result += `<path d="M${LEFT} ${y}H${RIGHT}" stroke="#dce3eb"/>` + text(LEFT - 10, y + 4, number(maximum * i / 4), 'end');
    }
    return result + text((LEFT + RIGHT) / 2, 345, xLabel) +
        `<text transform="translate(18,160) rotate(-90)" text-anchor="middle">Количество задач</text>`;
}
function empty() {
    return '<p class="empty">Нет данных для этого графика в текущей выборке.</p>';
}
/** Строит SVG-гистограмму с удобной единицей времени и целыми делениями количества задач. */
export function histogramChart(bins) {
    if (!bins.length)
        return empty();
    const max = Math.max(1, Math.ceil(niceStep(Math.max(1, ...bins.map(bin => bin.count)) / 4))) * 4;
    const width = (RIGHT - LEFT) / bins.length;
    const stepHours = bins[0].to - bins[0].from;
    const unit = durationUnit(stepHours);
    let contents = frame(max, `Время, ${unit.label}`);
    bins.forEach((bin, index) => {
        const height = (BOTTOM - TOP) * bin.count / max;
        const label = `${number(bin.from / unit.hours)}–${number(bin.to / unit.hours)} ${unit.short}: ${bin.count} задач`;
        contents += `<rect x="${LEFT + index * width + 1}" y="${BOTTOM - height}" width="${Math.max(1, width - 2)}" height="${height}" fill="${COLORS[0]}"><title>${label}</title></rect>`;
        if (index % Math.ceil(bins.length / 7) === 0)
            contents += text(LEFT + index * width, 305, number(bin.from / unit.hours));
    });
    contents += text(RIGHT, 305, number(bins.at(-1).to / unit.hours));
    const count = bins.reduce((sum, bin) => sum + bin.count, 0);
    return `<p>Шаг интервала: ${number(stepHours / unit.hours)} ${unit.short} ${unit.note} Учтено задач: ${count}. Точные интервалы и количество задач — при наведении на столбец.</p>` + svg(contents, `Гистограмма: время (${unit.label}) и количество задач`);
}
/** Рисует дневные и накопительные ряды на общей календарной оси. */
export function dailyChart(days) {
    if (!days.length)
        return empty();
    const series = [
        { key: 'created', title: 'Создано за день' }, { key: 'closed', title: 'Закрыто за день' },
        { key: 'createdTotal', title: 'Создано накопительно' }, { key: 'closedTotal', title: 'Закрыто накопительно' },
    ];
    const max = days.reduce((max, day) => Math.max(max, day.createdTotal, day.closedTotal), 1);
    const x = (i) => LEFT + i / Math.max(1, days.length - 1) * (RIGHT - LEFT);
    const y = (n) => BOTTOM - n / max * (BOTTOM - TOP);
    let contents = frame(max, 'Календарный день, UTC');
    series.forEach((series, index) => {
        const path = days.map((day, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)} ${y(day[series.key]).toFixed(2)}`).join(' ');
        contents += `<path d="${path}" fill="none" stroke="${COLORS[index]}" stroke-width="2" ${index >= 2 ? 'stroke-dasharray="6 3"' : ''}/>`;
        if (days.length === 1)
            contents += `<circle cx="${x(0)}" cy="${y(days[0][series.key])}" r="4" fill="${COLORS[index]}"/>`;
    });
    const ticks = new Set([0, days.length - 1, ...Array.from({ length: 5 }, (_, i) => Math.floor(i * (days.length - 1) / 4))]);
    for (const index of ticks)
        contents += text(x(index), 308, days[index].day);
    return `<div class="legend">${series.map((item, index) => `<span style="color:${COLORS[index]}">● ${item.title}</span>`).join('')}</div>` + svg(contents, 'Созданные и закрытые задачи по дням, включая накопительный итог');
}
/** Горизонтальные группы показывают обе роли и число уникальных задач пользователя. */
export function usersChart(users) {
    if (!users.length)
        return empty();
    const left = 250;
    const rowHeight = 68;
    const height = users.length * rowHeight + 80;
    const max = Math.max(1, ...users.map(user => user.total));
    let contents = '';
    for (let i = 0; i <= 4; i++) {
        const x = left + (RIGHT - left) * i / 4;
        contents += `<path d="M${x} 10V${height - 55}" stroke="#dce3eb"/>` + text(x, height - 30, number(max * i / 4));
    }
    users.forEach((user, i) => {
        const y = 22 + i * rowHeight;
        contents += text(left - 12, y + 15, user.name.length > 27 ? user.name.slice(0, 25) + '…' : user.name, 'end');
        [user.assigned, user.reported, user.total].forEach((value, index) => {
            contents += `<rect x="${left}" y="${y + index * 15}" width="${value / max * (RIGHT - left)}" height="11" fill="${COLORS[index]}"><title>${escapeHtml(user.name)} (${escapeHtml(user.id)}): ${['исполнитель', 'репортер', 'уникальных задач'][index]} — ${value}</title></rect>`;
        });
    });
    contents += text((left + RIGHT) / 2, height - 5, 'Количество задач');
    return '<div class="legend"><span style="color:#3569df">● Исполнитель</span><span style="color:#df7540">● Репортер</span><span style="color:#168470">● Уникальные задачи</span></div>' + svg(contents, 'Топ-30 пользователей по уникальным задачам', height);
}
/** Столбчатая диаграмма количества задач по Jira priority. */
export function priorityChart(priorities) {
    if (!priorities.length)
        return empty();
    const max = Math.max(1, ...priorities.map(item => item.count));
    const width = (RIGHT - LEFT) / priorities.length;
    let contents = frame(max, 'Серьёзность / Jira priority');
    priorities.forEach((item, index) => {
        const height = item.count / max * (BOTTOM - TOP);
        contents += `<rect x="${LEFT + width * index + width * 0.15}" y="${BOTTOM - height}" width="${width * 0.7}" height="${height}" fill="${COLORS[0]}"><title>${escapeHtml(item.priority)}: ${item.count}</title></rect>`;
        contents += text(LEFT + width * (index + 0.5), 305, item.priority);
    });
    return svg(contents, 'Количество задач по серьёзности');
}
//# sourceMappingURL=charts.js.map