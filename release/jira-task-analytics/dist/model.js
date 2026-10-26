/** Проверяет структуру JSON до доступа к его полям. */
export function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label}: ожидался объект`);
    }
    return value;
}
/** Проверяет строковое поле ответа или сохранённых данных. */
export function string(value, label) {
    if (typeof value !== 'string' || !value.trim())
        throw new Error(`${label}: ожидалась непустая строка`);
    return value;
}
/** Проверяет дату, возвращая нормализованную UTC-строку. */
export function timestamp(value, label) {
    const text = string(value, label);
    const millis = Date.parse(text);
    if (!Number.isFinite(millis))
        throw new Error(`${label}: некорректная дата`);
    return new Date(millis).toISOString();
}
/** Проверяет неотрицательное числовое значение. */
export function nonnegative(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`${label}: ожидалось неотрицательное число`);
    }
    return value;
}
//# sourceMappingURL=model.js.map