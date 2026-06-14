export const providerDateFields = ["last_checked", "created_at"] as const;
export const campDateFields = ["start_date", "end_date", "last_checked"] as const;

const dateFieldNames = new Set<string>([...providerDateFields, ...campDateFields]);

type DateFieldValue = string | null | undefined;

export function normalizeDateFieldValue<T extends DateFieldValue>(value: T): Exclude<T, ""> | null | undefined {
  if (typeof value !== "string") return value as Exclude<T, ""> | null | undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? (trimmed as Exclude<T, "">) : null;
}

export function normalizeEmptyDateFields<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).map(([field, value]) => [field, dateFieldNames.has(field) ? normalizeDateFieldValue(value as DateFieldValue) : value]),
  ) as T;
}

export function omitNullishDateFields<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(normalizeEmptyDateFields(record)).filter(([field, value]) => !dateFieldNames.has(field) || value !== null),
  ) as T;
}
