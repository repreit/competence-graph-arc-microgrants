export function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}

export function isPositiveSafeInt(value) {
    return Number.isSafeInteger(value) && value >= 1;
}
