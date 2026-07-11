import type { Camp } from "./types";
import type { CampComparison } from "./discoveryUtils";

export const curatedCampUpdateFields: Array<keyof Pick<Camp, "camp_name" | "town" | "county" | "address" | "eircode" | "activity_type" | "holiday_type" | "half_day_or_full_day">> = ["camp_name", "town", "county", "address", "eircode", "activity_type", "holiday_type", "half_day_or_full_day"];
export const operationalCampUpdateFields: Array<keyof Pick<Camp, "start_date" | "end_date" | "start_time" | "end_time" | "age_min" | "age_max" | "price" | "booking_url" | "source_url" | "last_checked">> = ["start_date", "end_date", "start_time", "end_time", "age_min", "age_max", "price", "booking_url", "source_url", "last_checked"];
export const existingCampCompareFields: Array<(typeof curatedCampUpdateFields)[number] | (typeof operationalCampUpdateFields)[number]> = [...curatedCampUpdateFields, ...operationalCampUpdateFields];

const trackingParams = /^(?:utm_|fbclid$|gclid$|gbraid$|wbraid$|mc_cid$|mc_eid$|igshid$)/i;
const suffixWords = /\b(?:ltd|limited|inc|company|co|club|clg)\b/g;
const campNoiseWords = /\b(?:summer|easter|halloween|christmas|midterm|camp|camps|course|workshop|programme|program)\b/g;

function label(field: string) { return field.replaceAll("_", " "); }
function fieldDisplay(value: string | number | null | undefined) { return String(value ?? "").trim(); }
export function normalizeTextForDuplicate(value: string | number | null | undefined) { return fieldDisplay(value).toLowerCase().replace(/&/g, " and ").replace(suffixWords, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function normalizeCampName(value: string | number | null | undefined) { return normalizeTextForDuplicate(value).replace(campNoiseWords, "").replace(/\s+/g, " ").trim(); }
function normalizedFieldValue(field: (typeof existingCampCompareFields)[number], value: string | number | null | undefined) { return field === "booking_url" || field === "source_url" ? normalizeUrlForDuplicate(String(value ?? "")) : field === "camp_name" || curatedCampUpdateFields.includes(field as (typeof curatedCampUpdateFields)[number]) ? normalizeTextForDuplicate(value) : fieldDisplay(value); }
export function normalizeUrlForDuplicate(value: string | null | undefined) {
  const raw = fieldDisplay(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    Array.from(url.searchParams.keys()).forEach((key) => { if (trackingParams.test(key)) url.searchParams.delete(key); });
    url.pathname = url.pathname.replace(/\/+$/g, "") || "/";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/g, "").trim();
  }
}
function sameDate(a: string | null | undefined, b: string | null | undefined) { return Boolean(fieldDisplay(a) && fieldDisplay(a) === fieldDisplay(b)); }
function sameAgeRange(a: Camp, b: Camp) { return Boolean(a.age_min && b.age_min && a.age_max && b.age_max && Number(a.age_min) === Number(b.age_min) && Number(a.age_max) === Number(b.age_max)); }
function namesOverlap(a: string, b: string) {
  const left = normalizeCampName(a);
  const right = normalizeCampName(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2));
  const rightTokens = right.split(" ").filter((token) => token.length > 2);
  if (!leftTokens.size || !rightTokens.length) return false;
  return rightTokens.filter((token) => leftTokens.has(token)).length / Math.min(leftTokens.size, rightTokens.length) >= 0.5;
}

export function campHasImportChanges(existing: Camp, extracted: Camp) {
  return existingCampCompareFields.some((field) => {
    const existingDisplayValue = fieldDisplay(existing[field]);
    const extractedDisplayValue = fieldDisplay(extracted[field]);
    if (!existingDisplayValue && !extractedDisplayValue) return false;
    if (!extractedDisplayValue) return false;
    if (curatedCampUpdateFields.includes(field as (typeof curatedCampUpdateFields)[number])) return !existingDisplayValue;
    return normalizedFieldValue(field, existing[field]) !== normalizedFieldValue(field, extracted[field]);
  });
}

export function compareExistingCamp(existing: Camp, extracted: Camp): CampComparison[] {
  return existingCampCompareFields.flatMap((field) => {
    const existingValue = fieldDisplay(existing[field]);
    const extractedValue = fieldDisplay(extracted[field]);
    const normalizedExisting = normalizedFieldValue(field, existing[field]);
    const normalizedExtracted = normalizedFieldValue(field, extracted[field]);
    if (!existingValue && !extractedValue) return [];
    if (existingValue && !extractedValue) return [{ field: label(field), existing: existingValue, extracted: "—", warning: `Existing camp found — existing record has ${label(field)}, new extraction does not` }];
    if (!existingValue || normalizedExisting === normalizedExtracted) return [];
    if (field === "booking_url") return [{ field: label(field), existing: existingValue, extracted: extractedValue, warning: "Existing camp found — booking URL differs" }];
    if (curatedCampUpdateFields.includes(field as (typeof curatedCampUpdateFields)[number])) return [{ field: label(field), existing: existingValue, extracted: extractedValue, warning: `Existing camp found — ${label(field)} differs; existing curated value will be preserved by default` }];
    return [{ field: label(field), existing: existingValue, extracted: extractedValue, warning: `Existing camp found — ${label(field)} differs: existing ${existingValue}, new ${extractedValue}` }];
  });
}

export function findExistingCampMatch(extracted: Camp, existingCamps: Camp[]) {
  const extractedBookingUrl = normalizeUrlForDuplicate(extracted.booking_url);
  const extractedSourceUrl = normalizeUrlForDuplicate(extracted.source_url);
  return existingCamps.find((existing) => {
    const sameProvider = Boolean(existing.provider_id && extracted.provider_id && existing.provider_id === extracted.provider_id);
    const sameStartDate = sameDate(existing.start_date, extracted.start_date);
    const sameTown = Boolean(normalizeTextForDuplicate(existing.town) && normalizeTextForDuplicate(existing.town) === normalizeTextForDuplicate(extracted.town));
    const sameCounty = Boolean(normalizeTextForDuplicate(existing.county) && normalizeTextForDuplicate(existing.county) === normalizeTextForDuplicate(extracted.county));
    const sameName = Boolean(normalizeTextForDuplicate(existing.camp_name) && normalizeTextForDuplicate(existing.camp_name) === normalizeTextForDuplicate(extracted.camp_name));
    const similarName = namesOverlap(existing.camp_name, extracted.camp_name);
    const sameBookingUrl = Boolean(extractedBookingUrl && normalizeUrlForDuplicate(existing.booking_url) === extractedBookingUrl);
    const sameSourceUrl = Boolean(extractedSourceUrl && normalizeUrlForDuplicate(existing.source_url) === extractedSourceUrl);
    if (existing.camp_id && existing.camp_id === extracted.camp_id) return true;
    if (sameProvider && sameName && sameStartDate) return true;
    if (sameProvider && sameTown && sameStartDate && similarName) return true;
    if (sameBookingUrl && sameStartDate) return true;
    if ((sameProvider || sameSourceUrl) && (sameTown || sameCounty) && sameStartDate && sameAgeRange(existing, extracted)) return true;
    return false;
  });
}
