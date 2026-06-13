import { Camp, Provider, campStatuses, dayLengths, holidayTypes } from "./types";
import { campFields, createBlankCamp, parseCsv, providersById } from "./campUtils";

export type CampImportIssue = {
  row: number;
  level: "error" | "warning";
  field?: string;
  message: string;
};

export type CampImportReport = {
  camps: Camp[];
  issues: CampImportIssue[];
  summary: {
    totalCamps: number;
    totalErrors: number;
    totalWarnings: number;
    campsByProvider: Record<string, number>;
    campsByCounty: Record<string, number>;
    campsByActivityType: Record<string, number>;
  };
};

function countBy(camps: Camp[], getKey: (camp: Camp) => string) {
  return camps.reduce<Record<string, number>>((counts, camp) => {
    const key = getKey(camp).trim() || "Unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function asDateValue(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function normalizeVenue(camp: Camp) {
  return (camp.address || camp.location).trim().toLowerCase();
}

function parseCampRows(text: string, providers: Provider[]) {
  const rows = parseCsv(text);
  const issues: CampImportIssue[] = [];

  if (rows.length === 0) {
    return { camps: [], issues: [{ row: 0, level: "error" as const, message: "CSV file is empty." }] };
  }

  const headers = rows[0].map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => (header === "camp_id" ? "id" : header));

  if (!normalizedHeaders.includes("id")) {
    issues.push({ row: 1, level: "error", field: "camp_id", message: "Missing required camp_id or id column." });
  }

  if (!normalizedHeaders.includes("provider_id")) {
    issues.push({ row: 1, level: "error", field: "provider_id", message: "Missing required provider_id column." });
  }

  const camps = rows.slice(1).map((row) => {
    const values = Object.fromEntries(normalizedHeaders.map((header, columnIndex) => [header, row[columnIndex] ?? ""]));
    const camp = createBlankCamp(providers[0]?.provider_id ?? "");

    campFields.forEach((field) => {
      const rawValue = values[field] ?? camp[field];
      if (field === "age_min" || field === "age_max") {
        (camp[field] as number) = Number(rawValue);
      } else {
        (camp[field] as string) = String(rawValue);
      }
    });

    return camp;
  });

  return { camps, issues };
}

export function buildCampImportReport(text: string, providers: Provider[]): CampImportReport {
  const { camps, issues } = parseCampRows(text, providers);
  const providerLookup = providersById(providers);
  const seenCampIds = new Map<string, number>();
  const seenCampRecords = new Map<string, number>();

  camps.forEach((camp, index) => {
    const row = index + 2;
    const campId = camp.id.trim();
    const startDateValue = asDateValue(camp.start_date);
    const endDateValue = asDateValue(camp.end_date);

    if (!camp.provider_id || !providerLookup[camp.provider_id]) {
      issues.push({ row, level: "error", field: "provider_id", message: "provider_id must exist in the Provider dataset." });
    }

    if (campId) {
      const firstRow = seenCampIds.get(campId);
      if (firstRow) {
        issues.push({ row, level: "error", field: "camp_id", message: `Duplicate camp_id also appears on row ${firstRow}.` });
      } else {
        seenCampIds.set(campId, row);
      }
    } else {
      issues.push({ row, level: "error", field: "camp_id", message: "camp_id is required." });
    }

    if (!camp.camp_name.trim()) {
      issues.push({ row, level: "error", field: "camp_name", message: "camp_name is required." });
    }

    if (!camp.booking_url.trim()) {
      issues.push({ row, level: "error", field: "booking_url", message: "booking_url is required." });
    }

    if (!camp.holiday_type.trim()) {
      issues.push({ row, level: "error", field: "holiday_type", message: "holiday_type is required." });
    } else if (!holidayTypes.includes(camp.holiday_type)) {
      issues.push({ row, level: "error", field: "holiday_type", message: `holiday_type must be one of ${holidayTypes.join(", ")}.` });
    }

    if (Number.isNaN(Number(camp.age_min)) || Number.isNaN(Number(camp.age_max))) {
      issues.push({ row, level: "error", field: "age range", message: "age_min and age_max must be numbers." });
    } else if (Number(camp.age_min) < 0 || Number(camp.age_max) < 0 || Number(camp.age_min) > Number(camp.age_max)) {
      issues.push({ row, level: "error", field: "age range", message: "Age range is invalid." });
    }

    if (camp.start_date && camp.end_date && startDateValue !== null && endDateValue !== null && startDateValue > endDateValue) {
      issues.push({ row, level: "error", field: "date range", message: "start_date cannot be after end_date." });
    }

    if (!campStatuses.includes(camp.status)) {
      issues.push({ row, level: "error", field: "status", message: `status must be one of ${campStatuses.join(", ")}.` });
    }

    if (!dayLengths.includes(camp.half_day_or_full_day)) {
      issues.push({ row, level: "error", field: "half_day_or_full_day", message: `half_day_or_full_day must be one of ${dayLengths.join(", ")}.` });
    }

    const duplicateRecordKey = [camp.provider_id, normalizeVenue(camp), camp.start_date].join("|");
    const firstDuplicateRow = seenCampRecords.get(duplicateRecordKey);
    if (camp.provider_id && normalizeVenue(camp) && camp.start_date && firstDuplicateRow) {
      issues.push({ row, level: "warning", message: `Potential duplicate camp record: same provider, venue and start date as row ${firstDuplicateRow}.` });
    } else if (camp.provider_id && normalizeVenue(camp) && camp.start_date) {
      seenCampRecords.set(duplicateRecordKey, row);
    }
  });

  const providerNamesById = providersById(providers);
  const campsByProvider = countBy(camps, (camp) => providerNamesById[camp.provider_id]?.provider_name ?? camp.provider_id);
  const campsByCounty = countBy(camps, (camp) => camp.county);
  const campsByActivityType = countBy(camps, (camp) => camp.activity_type);

  return {
    camps,
    issues,
    summary: {
      totalCamps: camps.length,
      totalErrors: issues.filter((issue) => issue.level === "error").length,
      totalWarnings: issues.filter((issue) => issue.level === "warning").length,
      campsByProvider,
      campsByCounty,
      campsByActivityType,
    },
  };
}
