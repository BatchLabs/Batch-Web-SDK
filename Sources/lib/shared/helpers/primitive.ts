/**
 * Returns the value as a boolean if it is one or a non-zero number.
 * Doesn't convert strings by design.
 *
 * Fallback on the default value if the value is not a boolean or a number.
 */
export function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return fallback;
}

export function isString(value: unknown): value is string {
  return typeof value === "string" || value instanceof String;
}

export function isFloat(value: unknown): value is number {
  return Number(value) === value && value % 1 !== 0;
}

export function isBoolean(value: unknown): value is boolean {
  return value instanceof Boolean || typeof value === "boolean";
}

export function isNumber(value: unknown): value is number {
  return value instanceof Number || (typeof value === "number" && !isNaN(value));
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

export function isURL(value: unknown): value is URL {
  return value instanceof URL;
}

export function isArray(value: unknown): value is Array<unknown> {
  return Array.isArray(value);
}

export function isSet(value: unknown): value is Set<string> {
  return value instanceof Set;
}

export function isUnknownObject(value: unknown): value is { [key: string]: unknown } {
  return value instanceof Object && !Array.isArray(value) && value !== null;
}
