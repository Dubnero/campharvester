import type { Camp, HolidayType, Provider } from "./types";

export type DiscoveryInput = {
  sourceUrl: string;
  providerId?: string;
  providerName?: string;
  county?: string;
  activityType?: string;
  holidayType?: string;
  notes?: string;
};

export type DiscoveryProvider = Provider & { selected: boolean; needs_review: boolean; duplicateWarnings: string[] };
export type DiscoveryCamp = Camp & { selected: boolean; needs_review: boolean; duplicateWarnings: string[] };

const counties = ["Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath", "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath", "Wexford", "Wicklow"];
const activities = ["Arts", "Dance", "Drama", "Football", "GAA", "Hockey", "Coding", "STEM", "Science", "Music", "Swimming", "Tennis", "Rugby", "Multi-activity", "Sports", "Outdoor"];
const holidays: HolidayType[] = ["Summer", "Easter", "Halloween", "February Midterm", "October Midterm", "Christmas", "Other"];

export function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstMatch(text: string, regex: RegExp) {
  return text.match(regex)?.[0] ?? "";
}

function findKnown(text: string, values: readonly string[]) {
  const lower = text.toLowerCase();
  return values.find((value) => lower.includes(value.toLowerCase())) ?? "";
}

function titleFromUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    return url.hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "";
  }
}

function websiteFromUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return sourceUrl;
  }
}

function extractCampNames(text: string, defaultProviderName: string) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter((line) => line.length >= 4 && line.length <= 90);
  const likely = lines.filter((line) => /camp|academy|workshop|course|club|programme|program/i.test(line));
  return Array.from(new Set(likely.slice(0, 8))).filter((line) => line.toLowerCase() !== defaultProviderName.toLowerCase());
}

export function extractDiscoveryRecords(input: DiscoveryInput, rawText: string) {
  const text = rawText.replace(/\s+/g, " ").trim();
  const lineText = rawText.replace(/\r/g, "\n");
  const providerName = input.providerName?.trim() || titleFromUrl(input.sourceUrl);
  const providerId = input.providerId?.trim() || (providerName ? slugify(providerName) : "");
  const county = input.county?.trim() || findKnown(text, counties);
  const activity = input.activityType?.trim() || findKnown(text, activities);
  const holiday = (input.holidayType?.trim() || findKnown(text, holidays) || "Other") as HolidayType;
  const provider: DiscoveryProvider = {
    provider_id: providerId,
    provider_name: providerName,
    website: websiteFromUrl(input.sourceUrl),
    source_url: input.sourceUrl,
    primary_email: firstMatch(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i),
    primary_phone: firstMatch(text, /(\+353|0)\s?\d{1,2}[\s-]?\d{3}[\s-]?\d{3,4}/),
    description: "",
    primary_county: county,
    activity_category: activity,
    provider_type: "",
    status: "draft",
    verified: false,
    featured: false,
    last_checked: today(),
    notes: input.notes ?? "",
    selected: Boolean(providerId && providerName),
    needs_review: true,
    duplicateWarnings: [],
  };

  const date = firstMatch(text, /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/);
  const time = firstMatch(text, /\b\d{1,2}[:.]\d{2}\s?(am|pm)?\b/i);
  const price = firstMatch(text, /€\s?\d+(?:\.\d{2})?/);
  const eircode = firstMatch(text, /\b[A-Z0-9]{3}\s?[A-Z0-9]{4}\b/i).toUpperCase();
  const names = extractCampNames(lineText, providerName);
  const campNames = names.length > 0 ? names : (providerName ? [`${providerName} Camp`] : []);
  const camps: DiscoveryCamp[] = campNames.slice(0, 5).map((campName, index) => ({
    camp_id: slugify(`${providerId || "provider"}-${campName}`) || `discovered-camp-${index + 1}`,
    provider_id: providerId,
    camp_name: campName,
    county,
    town: "",
    address: "",
    eircode,
    activity_type: activity,
    holiday_type: holiday,
    age_min: Number(firstMatch(text, /(?<=age[s]?\s)\d{1,2}/i)) || 0,
    age_max: Number(text.match(/age[s]?\s\d{1,2}\s?(?:-|to)\s?(\d{1,2})/i)?.[1] ?? 0),
    start_date: date,
    end_date: "",
    start_time: time,
    end_time: "",
    half_day_or_full_day: /half\s?day/i.test(text) ? "Half day" : /full\s?day/i.test(text) ? "Full day" : "Unknown",
    price,
    booking_url: input.sourceUrl,
    status: "draft",
    verified: false,
    featured: false,
    source_url: input.sourceUrl,
    last_checked: today(),
    selected: true,
    needs_review: true,
    duplicateWarnings: [],
  }));

  const warnings = [providerName ? "" : "Provider name could not be determined.", camps.length ? "" : "No likely camp rows found."].filter(Boolean);
  return { providers: provider.provider_id || provider.provider_name ? [provider] : [], camps, warnings, textLength: text.length };
}

export function recordsToCsv(records: Array<Record<string, unknown>>) {
  if (records.length === 0) return "";
  const headers = Object.keys(records[0]).filter((key) => !["selected", "duplicateWarnings"].includes(key));
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...records.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}
