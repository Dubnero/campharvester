import { normalizeDateFieldValue, omitNullishDateFields } from "./dateNormalization";
import { campStatuses, dayLengths, holidayTypes, type Camp } from "./types";

export const campStorageKey = "campharvester.camps";

export function loadStoredCamps(): Camp[] | null {
  if (typeof window === "undefined") return null;

  try {
    const storedCamps = window.localStorage.getItem(campStorageKey);
    if (!storedCamps) return null;

    const parsed = JSON.parse(storedCamps);
    if (!Array.isArray(parsed)) return null;

    const camps = parsed.map(normalizeCampRecord).filter(isCampRecord);
    return camps.length > 0 ? camps : null;
  } catch (error) {
    console.error("Failed to load stored CampHarvester camps.", error);
    return null;
  }
}

export function saveStoredCamps(camps: Camp[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(campStorageKey, JSON.stringify(camps.map(normalizeCampRecord)));
  } catch (error) {
    console.error("Failed to save CampHarvester camps.", error);
  }
}

export function clearStoredCamps() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(campStorageKey);
  } catch (error) {
    console.error("Failed to clear stored CampHarvester camps.", error);
  }
}

function normalizeCampRecord(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;

  const camp = value as Partial<Camp>;

  return {
    ...camp,
    start_date: normalizeDateFieldValue(camp.start_date) ?? "",
    end_date: normalizeDateFieldValue(camp.end_date) ?? "",
    last_checked: normalizeDateFieldValue(camp.last_checked) ?? "",
    created_at: normalizeDateFieldValue(camp.created_at),
  };
}

export function prepareCampForSupabase(camp: Camp) {
  return omitNullishDateFields({
    ...camp,
    start_date: normalizeDateFieldValue(camp.start_date),
    end_date: normalizeDateFieldValue(camp.end_date),
    last_checked: normalizeDateFieldValue(camp.last_checked),
    created_at: normalizeDateFieldValue(camp.created_at),
  });
}

function isCampRecord(value: unknown): value is Camp {
  if (!value || typeof value !== "object") return false;
  const camp = value as Partial<Camp>;

  return (
    typeof camp.camp_id === "string" &&
    camp.camp_id.trim().length > 0 &&
    typeof camp.provider_id === "string" &&
    camp.provider_id.trim().length > 0 &&
    typeof camp.camp_name === "string" &&
    camp.camp_name.trim().length > 0 &&
    typeof camp.county === "string" &&
    typeof camp.town === "string" &&
    typeof camp.address === "string" &&
    typeof camp.eircode === "string" &&
    typeof camp.activity_type === "string" &&
    holidayTypes.includes(camp.holiday_type as Camp["holiday_type"]) &&
    typeof camp.age_min === "number" &&
    Number.isFinite(camp.age_min) &&
    typeof camp.age_max === "number" &&
    Number.isFinite(camp.age_max) &&
    typeof camp.start_date === "string" &&
    typeof camp.end_date === "string" &&
    typeof camp.start_time === "string" &&
    typeof camp.end_time === "string" &&
    dayLengths.includes(camp.half_day_or_full_day as Camp["half_day_or_full_day"]) &&
    typeof camp.price === "string" &&
    typeof camp.booking_url === "string" &&
    campStatuses.includes(camp.status as Camp["status"]) &&
    typeof camp.verified === "boolean" &&
    typeof camp.featured === "boolean" &&
    typeof camp.source_url === "string" &&
    typeof camp.last_checked === "string"
  );
}
