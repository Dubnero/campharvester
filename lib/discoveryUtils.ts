import type { Camp, HolidayType, Provider } from "./types";

export type DiscoveryInput = { sourceUrl: string; providerId?: string; providerName?: string; county?: string; activityType?: string; holidayType?: string; notes?: string };
export type ConfidenceBreakdown = Record<string, number>;
export type DiscoveryProvider = Provider & { selected: boolean; needs_review: boolean; duplicateWarnings: string[]; confidence: number; fieldConfidence: ConfidenceBreakdown; extractionWarnings: string[] };
export type DiscoveryCamp = Camp & { selected: boolean; needs_review: boolean; duplicateWarnings: string[]; confidence: number; fieldConfidence: ConfidenceBreakdown; extractionWarnings: string[] };

const counties = ["Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath", "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath", "Wexford", "Wicklow"];
const holidays: HolidayType[] = ["Summer", "Easter", "Halloween", "February Midterm", "October Midterm", "Christmas", "Other"];
const navigationReject = /^(our )?(programmes?|programming|school tours?|after school programmes?|classes|activities|parties|contact|about|home|book now|faq|faqs|gallery|locations?|prices?|timetable|schedule|camp dates?|camps?|summer|easter|halloween)(?:\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4})?$/i;
const campSignal = /\b(summer|easter|halloween|midterm|christmas)\s+(camp|course|workshop)|\bcamp\s+(dates?|weeks?|booking|price|cost)|\b(?:ages?|aged)\s*\d|€\s?\d|book\s+(now|online)|\b\d{1,2}\s*(?:-|to)\s*\d{1,2}\s*(?:years?|yrs?)\b/i;
const eircodeRegex = /\b(?:[AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}\b/i;

export function slugify(value: string) { return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72); }
function today() { return new Date().toISOString().slice(0, 10); }
function firstMatch(text: string, regex: RegExp) { return text.match(regex)?.[0] ?? ""; }
function findKnown(text: string, values: readonly string[]) { const lower = text.toLowerCase(); return values.find((value) => lower.includes(value.toLowerCase())) ?? ""; }
function titleFromUrl(sourceUrl: string) { try { const url = new URL(sourceUrl); return url.hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); } catch { return ""; } }
function websiteFromUrl(sourceUrl: string) { try { const url = new URL(sourceUrl); return `${url.protocol}//${url.host}`; } catch { return sourceUrl; } }
function validEmail(text: string) { return firstMatch(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); }
function validPhone(text: string) { return firstMatch(text, /(?:\+353|0)\s?(?:1|2[1-9]|4[0-9]|5[0-9]|6[0-9]|7[14]|8[356789]|9[0-9])(?:[\s-]?\d){6,8}\b/); }
function validEircode(text: string) { return (text.match(eircodeRegex)?.[0] ?? "").toUpperCase().replace(/\s+/, " "); }
function classifyActivity(text: string, fallback = "") {
  const lower = `${fallback} ${text}`.toLowerCase();
  if (/bricks\s*4\s*kidz|robot|science|stem|lego|engineering/.test(lower)) return "STEM";
  if (/coderdojo|coding|code club|programming camp|python|scratch/.test(lower)) return "Coding";
  if (/football|soccer/.test(lower)) return "Soccer";
  if (/multi[- ]?activity|multi activity|variety camp/.test(lower)) return "Multi Activity";
  if (/dance/.test(lower)) return "Dance";
  if (/\barts?\b|\bcrafts?\b/.test(lower)) return "Arts & Crafts";
  if (/gaa/.test(lower)) return "GAA";
  if (/rugby/.test(lower)) return "Rugby";
  if (/tennis/.test(lower)) return "Tennis";
  return fallback || "";
}
function findHoliday(text: string, fallback?: string): HolidayType { const found = findKnown(text, holidays); return ((fallback || found || "Other") as HolidayType); }
function confidenceScore(scores: ConfidenceBreakdown, weights: Record<string, number>) { const total = Object.values(weights).reduce((a, b) => a + b, 0); return Math.round(Object.entries(weights).reduce((sum, [key, weight]) => sum + (scores[key] ?? 0) * weight, 0) / total); }
function extractCampCandidates(rawText: string, providerName: string) {
  const lines = rawText.replace(/\r/g, "\n").split(/\n+/).map((line) => line.trim().replace(/\s{2,}/g, " ")).filter((line) => line.length >= 4 && line.length <= 140);
  const candidates = new Map<string, string>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const context = lines.slice(Math.max(0, index - 2), index + 5).join(" · ");
    if (navigationReject.test(line) || /\bcamp dates?\b/i.test(line) || line.toLowerCase() === providerName.toLowerCase()) continue;
    const hasCampName = /\b(camp|academy|workshop|course|club)\b/i.test(line);
    const hasStrongContext = campSignal.test(context);
    if (hasCampName && hasStrongContext) candidates.set(line, context);
  }
  return Array.from(candidates.entries()).slice(0, 8).map(([name, context]) => ({ name, context }));
}

export function extractDiscoveryRecords(input: DiscoveryInput, rawText: string) {
  const text = rawText.replace(/\s+/g, " ").trim();
  const providerName = input.providerName?.trim() || titleFromUrl(input.sourceUrl);
  const providerId = input.providerId?.trim() || (providerName ? slugify(providerName) : "");
  const county = input.county?.trim() || findKnown(text, counties);
  const activity = classifyActivity(text, input.activityType?.trim());
  const providerFieldConfidence = { provider_name: providerName ? (input.providerName ? 100 : 78) : 0, website: input.sourceUrl ? 95 : 0, primary_email: validEmail(text) ? 100 : 0, primary_phone: validPhone(text) ? 90 : 0, primary_county: county ? (input.county ? 100 : 78) : 0, activity_category: activity ? 84 : 0 };
  const provider: DiscoveryProvider = { provider_id: providerId, provider_name: providerName, website: websiteFromUrl(input.sourceUrl), source_url: input.sourceUrl, primary_email: validEmail(text), primary_phone: validPhone(text), description: "", primary_county: county, activity_category: activity, provider_type: "", status: "draft", verified: false, featured: false, last_checked: today(), notes: input.notes ?? "", selected: Boolean(providerId && providerName), needs_review: true, duplicateWarnings: [], confidence: confidenceScore(providerFieldConfidence, { provider_name: 3, website: 2, primary_email: 1, primary_phone: 1, primary_county: 1, activity_category: 1 }), fieldConfidence: providerFieldConfidence, extractionWarnings: [] };

  const candidates = extractCampCandidates(rawText, providerName);
  const globalEircode = validEircode(text);
  const camps: DiscoveryCamp[] = candidates.map(({ name, context }, index) => {
    const date = firstMatch(context, /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|July|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i);
    const time = firstMatch(context, /\b\d{1,2}[:.]\d{2}\s?(?:am|pm)?\b/i);
    const price = firstMatch(context, /€\s?\d+(?:\.\d{2})?/);
    const ageMin = Number(firstMatch(context, /(?:(?:age[s]?|aged)\s*)\d{1,2}/i).match(/\d{1,2}/)?.[0] ?? 0);
    const ageMax = Number(context.match(/(?:age[s]?|aged)?\s*\d{1,2}\s?(?:-|to)\s?(\d{1,2})/i)?.[1] ?? 0);
    const campActivity = classifyActivity(`${name} ${context}`, activity);
    const bookingUrl = /book\s+(now|online)|booking/i.test(context) ? input.sourceUrl : "";
    const fieldConfidence = { camp_name: 88, county: county ? 78 : 0, town: 0, address: 0, eircode: globalEircode ? 100 : 0, activity_type: campActivity ? 86 : 0, holiday_type: findHoliday(`${name} ${context}`) !== "Other" ? 88 : 35, age: ageMin || ageMax ? 88 : 0, start_date: date ? 76 : 0, price: price ? 100 : 0, booking_url: bookingUrl ? 75 : 0 };
    const confidence = confidenceScore(fieldConfidence, { camp_name: 3, holiday_type: 2, age: 2, start_date: 2, price: 1, booking_url: 1, activity_type: 1 });
    const extractionWarnings = [date ? "" : "Missing dates", price ? "" : "No price detected", bookingUrl ? "" : "Missing booking URL"].filter(Boolean);
    return { camp_id: slugify(`${providerId || "provider"}-${name}`) || `discovered-camp-${index + 1}`, provider_id: providerId, camp_name: name, county, town: "", address: "", eircode: globalEircode, activity_type: campActivity, holiday_type: findHoliday(`${name} ${context}`, input.holidayType?.trim()), age_min: ageMin, age_max: ageMax, start_date: date, end_date: "", start_time: time, end_time: "", half_day_or_full_day: /half\s?day/i.test(context) ? "Half day" : /full\s?day/i.test(context) ? "Full day" : "Unknown", price, booking_url: bookingUrl, status: "draft", verified: false, featured: false, source_url: input.sourceUrl, last_checked: today(), selected: confidence >= 60, needs_review: true, duplicateWarnings: [], confidence, fieldConfidence, extractionWarnings };
  });
  const warnings = [providerName ? "" : "Provider name could not be determined.", camps.length ? "" : "No high-confidence camp offerings found; generic navigation items were ignored.", camps.length && camps.every((camp) => !camp.price) ? "No prices detected" : "", camps.some((camp) => !camp.start_date) ? `${camps.filter((camp) => !camp.start_date).length} camp(s) missing dates` : "", camps.some((camp) => !camp.booking_url) ? "Booking links not detected for all camps" : ""].filter(Boolean);
  return { providers: provider.provider_id || provider.provider_name ? [provider] : [], camps, warnings, textLength: text.length };
}

export function recordsToCsv(records: Array<Record<string, unknown>>) {
  if (records.length === 0) return "";
  const headers = Object.keys(records[0]).filter((key) => !["selected", "duplicateWarnings", "fieldConfidence", "extractionWarnings"].includes(key));
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...records.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}
