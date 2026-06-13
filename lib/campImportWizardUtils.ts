import { campFields, createBlankCamp, parseBoolean, parseCsv, requiredCampFields, validateCamp } from "./campUtils";
import { Camp, Provider } from "./types";

export type CampImportRow = {
  rowNumber: number;
  camp: Camp;
};

export type CampImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  providerCount: number;
  holidayTypeCounts: Record<string, number>;
  rows: CampImportRow[];
  errors: string[];
};

const campIdAliases = ["id", "camp_id"];

function getRawValue(values: Record<string, string>, field: keyof Camp, fallback: Camp[keyof Camp]) {
  if (field === "id") {
    const alias = campIdAliases.find((header) => values[header] !== undefined);
    return alias ? values[alias] : fallback;
  }

  return values[field] ?? fallback;
}

export function getCampImportTemplateHeaders() {
  return campFields.map((field) => (field === "id" ? "camp_id" : field));
}

export function validateDuplicateCampIds(rows: CampImportRow[]) {
  const seen = new Map<string, number>();
  const errors: string[] = [];

  rows.forEach(({ rowNumber, camp }) => {
    const campId = camp.id.trim();
    if (!campId) return;

    const firstRow = seen.get(campId);
    if (firstRow) {
      errors.push(`Row ${rowNumber}: camp_id duplicates Row ${firstRow} (${campId}).`);
      return;
    }

    seen.set(campId, rowNumber);
  });

  return errors;
}

export function buildCampImportSummary(csvText: string, providers: Provider[]): CampImportSummary {
  const rows = parseCsv(csvText);
  const errors: string[] = [];

  if (rows.length === 0) {
    return {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      providerCount: 0,
      holidayTypeCounts: {},
      rows: [],
      errors: ["CSV file is empty."],
    };
  }

  const headers = rows[0].map((header) => header.trim());
  const hasCampId = campIdAliases.some((header) => headers.includes(header));
  const requiredHeaders = requiredCampFields.map((field) => (field === "id" ? "camp_id" : field));
  const missingRequired = requiredHeaders.filter((field) => {
    if (field === "camp_id") return !hasCampId;
    return !headers.includes(field);
  });

  if (missingRequired.length > 0) {
    return {
      totalRows: rows.length - 1,
      validRows: 0,
      invalidRows: rows.length - 1,
      providerCount: 0,
      holidayTypeCounts: {},
      rows: [],
      errors: [`Missing required column${missingRequired.length > 1 ? "s" : ""}: ${missingRequired.join(", ")}.`],
    };
  }

  const importRows = rows.slice(1).map((row, index) => {
    const values = Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""]));
    const camp = createBlankCamp(providers[0]?.provider_id ?? "");

    campFields.forEach((field) => {
      const rawValue = getRawValue(values, field, camp[field]);
      if (field === "age_min" || field === "age_max") {
        (camp[field] as number) = Number(rawValue);
      } else if (field === "verified" || field === "featured") {
        (camp[field] as boolean) = parseBoolean(rawValue);
      } else {
        (camp[field] as string) = String(rawValue);
      }
    });

    return { rowNumber: index + 2, camp };
  });

  const rowErrors = importRows.flatMap(({ rowNumber, camp }) => validateCamp(camp, providers, `Row ${rowNumber}`));
  const duplicateErrors = validateDuplicateCampIds(importRows);
  errors.push(...rowErrors, ...duplicateErrors);

  const invalidRowNumbers = new Set(
    errors
      .map((error) => error.match(/^Row (\d+):/)?.[1])
      .filter((rowNumber): rowNumber is string => Boolean(rowNumber))
      .map(Number),
  );
  const providerIds = new Set(importRows.map(({ camp }) => camp.provider_id).filter(Boolean));
  const holidayTypeCounts = importRows.reduce<Record<string, number>>((counts, { camp }) => {
    counts[camp.holiday_type] = (counts[camp.holiday_type] ?? 0) + 1;
    return counts;
  }, {});

  return {
    totalRows: importRows.length,
    validRows: importRows.length - invalidRowNumbers.size,
    invalidRows: invalidRowNumbers.size,
    providerCount: providerIds.size,
    holidayTypeCounts,
    rows: importRows,
    errors,
  };
}

export function campsFromImportSummary(summary: CampImportSummary) {
  return summary.rows.map(({ camp }) => camp);
}
