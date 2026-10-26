const TIME_UNITS = [
    { hours: 1 / 3600, label: 'секунды', short: 'с', note: '' },
    { hours: 1 / 60, label: 'минуты', short: 'мин', note: '' },
    { hours: 1, label: 'часы', short: 'ч', note: '' },
    { hours: 24, label: 'дни', short: 'дн.', note: '1 день = 24 часа.' },
    { hours: 24 * 30, label: 'месяцы', short: 'мес.', note: 'Для шкалы 1 месяц = 30 дней.' },
    { hours: 24 * 365, label: 'годы', short: 'г.', note: 'Для шкалы 1 год = 365 дней.' },
];
/** Выбирает единицу времени так, чтобы один шаг не был дробью крупной единицы. */
export function durationUnit(stepHours) {
    return TIME_UNITS.filter(unit => stepHours >= unit.hours).at(-1) ?? TIME_UNITS[0];
}
/** Округляет шаг вверх до удобного значения: 1, 2, 2.5, 5, 10 × степень десяти. */
export function niceStep(value) {
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const factor = [1, 2, 2.5, 5, 10].find(candidate => candidate * magnitude >= value);
    return factor * magnitude;
}
function timeStep(rawHours) {
    let unit = durationUnit(rawHours);
    let step = niceStep(rawHours / unit.hours) * unit.hours;
    // Если округление пересекло границу единиц, округляем уже в новой единице:
    // например, 23 часа превращаются в 1 день, а не в 25 часов.
    while (durationUnit(step) !== unit) {
        unit = durationUnit(step);
        step = niceStep(rawHours / unit.hours) * unit.hours;
    }
    return step;
}
/** Равные округлённые интервалы времени в часах; binCount — желаемый максимум их числа. */
export function histogram(values, binCount) {
    if (!Number.isInteger(binCount) || binCount < 1)
        throw new Error('Число интервалов должно быть положительным целым');
    if (values.some(value => !Number.isFinite(value) || value < 0))
        throw new Error('Недопустимое значение гистограммы');
    if (!values.length)
        return [];
    const maximum = values.reduce((max, value) => Math.max(max, value), 0);
    const width = maximum === 0 ? 1 : timeStep(maximum / binCount);
    const count = maximum === 0 ? 1 : Math.ceil(maximum / width);
    const bins = Array.from({ length: count }, (_, i) => ({ from: i * width, to: (i + 1) * width, count: 0 }));
    for (const value of values)
        bins[Math.min(bins.length - 1, Math.floor(value / width))].count++;
    return bins;
}
//# sourceMappingURL=histogram.js.map