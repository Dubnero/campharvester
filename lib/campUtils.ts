import { Camp, ImportResult, Provider, campStatuses, dayLengths, holidayTypes } from "./types";

export const campFields: (keyof Camp)[] = [
  "id",
  "provider_id",
  "camp_name",
  "county",
  "town",
  "address",
  "eircode",
  "activity_type",
  "holiday_type",
  "age_min",
  "age_max",
  "start_date",
  "end_date",
  "start_time",
  "end_time",
  "half_day_or_full_day",
  "price",
  "booking_url",
  "status",
  "verified",
  "featured",
  "source_url",
  "last_checked",
];

export const requiredCampFields: (keyof Camp)[] = [
  "id",
  "provider_id",
  "camp_name",
  "county",
  "activity_type",
  "holiday_type",
  "age_min",
  "age_max",
  "start_date",
  "end_date",
  "half_day_or_full_day",
  "status",
];

export function createBlankCamp(defaultProviderId = ""): Camp {
  return {
    id: `camp-${Date.now()}`,
    provider_id: defaultProviderId,
    camp_name: "",
    county: "",
    town: "",
    address: "",
    eircode: "",
    activity_type: "",
    holiday_type: "Summer",
    age_min: 5,
    age_max: 12,
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    half_day_or_full_day: "Unknown",
    price: "",
    booking_url: "",
    status: "draft",
    verified: false,
    featured: false,
    source_url: "",
    last_checked: new Date().toISOString().slice(0, 10),
  };
}

export function providersById(providers: Provider[]) {
  return Object.fromEntries(providers.map((provider) => [provider.provider_id, provider]));
}

export function getProviderForCamp(camp: Camp, providers: Provider[]) {
  return providersById(providers)[camp.provider_id];
}

export function getDashboardStats(camps: Camp[], providers: Provider[]) {
  const providerLookup = providersById(providers);

  return {
    total: camps.length,
    draft: camps.filter((camp) => camp.status === "draft").length,
    approved: camps.filter((camp) => camp.status === "approved").length,
    needsReview: camps.filter((camp) => camp.status === "needs_review").length,
    featured: camps.filter((camp) => providerLookup[camp.provider_id]?.featured).length,
    verified: camps.filter((camp) => providerLookup[camp.provider_id]?.verified).length,
  };
}

export function getUniqueValues(camps: Camp[], key: keyof Camp) {
  return Array.from(new Set(camps.map((camp) => String(camp[key])).filter(Boolean))).sort();
}

export function filterCamps(
  camps: Camp[],
  providers: Provider[],
  filters: { search: string; county: string; activityType: string; holidayType: string; status: string },
) {
  const search = filters.search.trim().toLowerCase();
  const providerLookup = providersById(providers);

  return camps.filter((camp) => {
    const provider = providerLookup[camp.provider_id];
    const matchesSearch = search
      ? [camp.camp_name, provider?.provider_name ?? "", camp.town, camp.county, camp.address].some((value) =>
          value.toLowerCase().includes(search),
        )
      : true;

    return (
      matchesSearch &&
      (!filters.county || camp.county === filters.county) &&
      (!filters.activityType || camp.activity_type === filters.activityType) &&
      (!filters.holidayType || camp.holiday_type === filters.holidayType) &&
      (!filters.status || camp.status === filters.status)
    );
  });
}

export function validateCamp(camp: Camp, providers: Provider[], rowLabel = "Camp") {
  const errors: string[] = [];
  const providerIds = new Set(providers.map((provider) => provider.provider_id));

  requiredCampFields.forEach((field) => {
    if (camp[field] === "" || camp[field] === undefined || camp[field] === null) {
      errors.push(`${rowLabel}: ${field} is required.`);
    }
  });

  if (camp.provider_id && !providerIds.has(camp.provider_id)) {
    errors.push(`${rowLabel}: provider_id must match an existing provider.`);
  }

  if (!holidayTypes.includes(camp.holiday_type)) {
    errors.push(`${rowLabel}: holiday_type must be one of ${holidayTypes.join(", ")}.`);
  }

  if (!campStatuses.includes(camp.status)) {
    errors.push(`${rowLabel}: status must be one of ${campStatuses.join(", ")}.`);
  }

  if (!dayLengths.includes(camp.half_day_or_full_day)) {
    errors.push(`${rowLabel}: half_day_or_full_day must be one of ${dayLengths.join(", ")}.`);
  }

  if (Number.isNaN(Number(camp.age_min)) || Number.isNaN(Number(camp.age_max))) {
    errors.push(`${rowLabel}: age_min and age_max must be numbers.`);
  }

  if (Number(camp.age_min) > Number(camp.age_max)) {
    errors.push(`${rowLabel}: age_min cannot be greater than age_max.`);
  }

  if (camp.start_date && !isValidDateValue(camp.start_date)) {
    errors.push(`${rowLabel}: start_date must be a valid YYYY-MM-DD date.`);
  }

  if (camp.end_date && !isValidDateValue(camp.end_date)) {
    errors.push(`${rowLabel}: end_date must be a valid YYYY-MM-DD date.`);
  }

  if (
    camp.start_date &&
    camp.end_date &&
    isValidDateValue(camp.start_date) &&
    isValidDateValue(camp.end_date) &&
    camp.start_date > camp.end_date
  ) {
    errors.push(`${rowLabel}: start_date cannot be after end_date.`);
  }

  if (camp.last_checked && !isValidDateValue(camp.last_checked)) {
    errors.push(`${rowLabel}: last_checked must be a valid YYYY-MM-DD date.`);
  }

  return errors;
}

export function parseBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["true", "yes", "1", "y"].includes(String(value ?? "").trim().toLowerCase());
}

function isValidDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function escapeCsvValue(value: unknown) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function campsToCsv(camps: Camp[]) {
  const rows = [campFields.map((field) => (field === "id" ? "camp_id" : field)).join(",")];
  camps.forEach((camp) => {
    rows.push(campFields.map((field) => escapeCsvValue(camp[field])).join(","));
  });
  return rows.join("\n");
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current.trim());
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  return rows;
}

export function csvToCamps(text: string, providers: Provider[]): ImportResult {
  const rows = parseCsv(text);
  const errors: string[] = [];

  if (rows.length === 0) {
    return { camps: [], errors: ["CSV file is empty."] };
  }

  const headers = rows[0].map((header) => header.trim());
  const hasCampId = headers.includes("camp_id") || headers.includes("id");
  const missingRequired = requiredCampFields.filter((field) => {
    if (field === "id") return !hasCampId;
    return !headers.includes(field);
  });

  if (missingRequired.length > 0) {
    return {
      camps: [],
      errors: [`Missing required column${missingRequired.length > 1 ? "s" : ""}: ${missingRequired.join(", ")}.`],
    };
  }

  const camps = rows.slice(1).map((row, index) => {
    const values = Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""]));
    const camp = createBlankCamp(providers[0]?.provider_id ?? "");

    campFields.forEach((field) => {
      const rawValue = field === "id" ? (values.camp_id ?? values.id ?? camp[field]) : (values[field] ?? camp[field]);
      if (field === "age_min" || field === "age_max") {
        (camp[field] as number) = Number(rawValue);
      } else if (field === "verified" || field === "featured") {
        (camp[field] as boolean) = parseBoolean(rawValue);
      } else {
        (camp[field] as string) = String(rawValue);
      }
    });

    errors.push(...validateCamp(camp, providers, `Row ${index + 2}`));
    return camp;
  });

  return { camps, errors };
}
