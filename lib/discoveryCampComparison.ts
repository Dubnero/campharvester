import type { Camp } from "./types";
import type { CampComparison } from "./discoveryUtils";

export const existingCampCompareFields: Array<keyof Pick<Camp, "address" | "eircode" | "price" | "start_date" | "end_date" | "start_time" | "end_time" | "age_min" | "age_max" | "booking_url">> = ["address", "eircode", "price", "start_date", "end_date", "start_time", "end_time", "age_min", "age_max", "booking_url"];

function label(field: string) { return field.replaceAll("_", " "); }
function fieldDisplay(value: string | number | null | undefined) { return String(value ?? "").trim(); }

export function campHasImportChanges(existing: Camp, extracted: Camp) {
  return existingCampCompareFields.some((field) => {
    const existingValue = fieldDisplay(existing[field]);
    const extractedValue = fieldDisplay(extracted[field]);
    if (!existingValue && !extractedValue) return false;
    if (!existingValue) return false;
    return existingValue !== extractedValue;
  });
}

export function compareExistingCamp(existing: Camp, extracted: Camp): CampComparison[] {
  return existingCampCompareFields.flatMap((field) => {
    const existingValue = fieldDisplay(existing[field]);
    const extractedValue = fieldDisplay(extracted[field]);
    if (!existingValue && !extractedValue) return [];
    if (existingValue && !extractedValue) return [{ field: label(field), existing: existingValue, extracted: "—", warning: `Existing camp found — existing record has ${label(field)}, new extraction does not` }];
    if (!existingValue || existingValue === extractedValue) return [];
    if (field === "booking_url") return [{ field: label(field), existing: existingValue, extracted: extractedValue, warning: "Existing camp found — booking URL differs" }];
    return [{ field: label(field), existing: existingValue, extracted: extractedValue, warning: `Existing camp found — ${label(field)} differs: existing ${existingValue}, new ${extractedValue}` }];
  });
}
