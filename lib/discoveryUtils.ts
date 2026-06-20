import type { Camp, HolidayType, Provider } from "./types";

export type DiscoveryInput = { sourceUrl: string; providerId?: string; providerName?: string; county?: string; activityType?: string; holidayType?: string; notes?: string };
export type ConfidenceBreakdown = Record<string, number>;
export type SourceMethod = "crawler" | "manual_paste";
export type DiscoveryProvider = Provider & { selected: boolean; needs_review: boolean; duplicateWarnings: string[]; confidence: number; fieldConfidence: ConfidenceBreakdown; extractionWarnings: string[]; source_method: SourceMethod };
export type DiscoveryCamp = Camp & { selected: boolean; needs_review: boolean; duplicateWarnings: string[]; confidence: number; fieldConfidence: ConfidenceBreakdown; extractionWarnings: string[]; source_method: SourceMethod };
export type DiscoveryPageAnalysis = { url: string; text?: string; readableTextLength: number; candidateCount: number; dynamicWarning?: boolean; status: "analysed" | "failed" | "manual_added" | "extracted"; failureReason?: string; sourceMethod: SourceMethod };
export type ExtractionDebugMatch = { type: "Provider" | "Date" | "Time" | "Age" | "Location" | "Town" | "Price"; value: string };
export type ExtractionDebugCandidate = { extractedText: string; parsedFields: Record<string, string | number>; confidence: number; validationFailures: string[] };
export type ExtractionPipelineDebug = { sourceUrl: string; sourceMethod: SourceMethod; rawTextPreview: string; stages: Array<{ label: string; count: number; passed: boolean }>; regexMatches: ExtractionDebugMatch[]; candidateRows: ExtractionDebugCandidate[]; validationFailures: string[]; finalCampObjects: DiscoveryCamp[] };

const counties = ["Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath", "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath", "Wexford", "Wicklow"];
const holidays: HolidayType[] = ["Summer", "Easter", "Halloween", "February Midterm", "October Midterm", "Christmas", "Other"];
const navigationReject = /^(our )?(programmes?|programming|school tours?|after school programmes?|classes|activities|parties|contact|about|home|book now|faq|faqs|gallery|locations?|prices?|timetable|schedule|camp dates?|camps?|summer|easter|halloween)(?:\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4})?$/i;
const campSignal = /\b(summer|easter|halloween|midterm|christmas)\s+(camp|course|workshop)|\bcamp\s+(dates?|weeks?|booking|price|cost)|\b(?:ages?|aged)\s*\d|€\s?\d|book\s+(now|online)|\b\d{1,2}\s*(?:-|to)\s*\d{1,2}\s*(?:years?|yrs?)\b/i;
const eircodeRegex = /\b(?:[AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}\b/i;

const monthNumbers: Record<string, string> = { jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03", apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09", oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12" };
const southDublinTowns = ["Knocklyon", "Cabinteely", "Dundrum", "Rathfarnham", "Stillorgan", "Sandyford", "Blackrock", "Monkstown", "Dún Laoghaire", "Dun Laoghaire", "Dalkey", "Killiney", "Foxrock", "Ballinteer", "Terenure", "Templeogue", "Tallaght", "Lucan", "Clondalkin"];

type BricksDateRange = { label: string; startDate: string; endDate: string };
type TimeRange = { startTime: string; endTime: string; label: string };

function cleanOrdinal(value: string) { return value.replace(/(st|nd|rd|th)$/i, ""); }
function pad2(value: string | number) { return String(value).padStart(2, "0"); }
function inferYear(text: string) { return text.match(/\b20\d{2}\b/)?.[0] ?? today().slice(0, 4); }
function isoDate(day: string, month: string, year: string) { return `${year}-${monthNumbers[month.toLowerCase()] ?? ""}-${pad2(cleanOrdinal(day))}`; }
function parseDateRange(text: string): BricksDateRange | null {
  const year = inferYear(text);
  const splitMonth = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(?:-|–|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(20\d{2}))?/i);
  if (splitMonth) return { label: splitMonth[0], startDate: isoDate(splitMonth[1], splitMonth[2], splitMonth[5] || year), endDate: isoDate(splitMonth[3], splitMonth[4], splitMonth[5] || year) };
  const dayFirst = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(20\d{2}))?/i);
  if (dayFirst) return { label: dayFirst[0], startDate: isoDate(dayFirst[1], dayFirst[3], dayFirst[4] || year), endDate: isoDate(dayFirst[2], dayFirst[3], dayFirst[4] || year) };
  const monthFirst = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?\s*(?:-|–|to)\s*(?:(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?(?!\s*(?:am|pm))/i);
  if (monthFirst) {
    const startMonth = monthFirst[1];
    const endMonth = monthFirst[4] || startMonth;
    const startYear = monthFirst[3] || year;
    const endYear = monthFirst[6] || startYear;
    return { label: monthFirst[0], startDate: isoDate(monthFirst[2], startMonth, startYear), endDate: isoDate(monthFirst[5], endMonth, endYear) };
  }
  return null;
}
function to24Hour(hourValue: string, minuteValue: string | undefined, marker: string | undefined) {
  let hour = Number(hourValue);
  const minute = Number(minuteValue ?? 0);
  const effectiveMarker = (marker || "").toLowerCase();
  if (effectiveMarker === "pm" && hour < 12) hour += 12;
  if (effectiveMarker === "am" && hour === 12) hour = 0;
  return `${pad2(hour)}:${pad2(minute)}`;
}
function parseTimeRange(text: string): TimeRange {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match || (!match[2] && !match[5] && !match[3] && !match[6])) return { startTime: "", endTime: "", label: "" };
  return { label: match[0], startTime: to24Hour(match[1], match[2], match[3]), endTime: to24Hour(match[4], match[5], match[6]) };
}
function parseAgeRange(text: string) {
  const match = text.match(/\b(?:suitable\s+for\s+)?ages?\s*:?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})(?:\s*(?:years?|yrs?))?\b|\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years?|yrs?)\b/i);
  return { label: match?.[0] ?? "", ageMin: Number(match?.[1] ?? match?.[3] ?? 0), ageMax: Number(match?.[2] ?? match?.[4] ?? 0) };
}
function inferTown(text: string) {
  const lower = text.toLowerCase();
  return southDublinTowns.find((town) => lower.includes(town.toLowerCase())) ?? "";
}
function inferCounty(text: string, fallback: string) {
  if (fallback) return fallback;
  return /\bDublin\b|\bD\d{1,2}\b|south county dublin/i.test(text) || inferTown(text) ? "Dublin" : "";
}
function extractLocationText(text: string, dateRange: BricksDateRange) {
  const withoutDate = text.replace(dateRange.label, " ").replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|–|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, " ").replace(/\b(?:suitable\s+for\s+)?ages?\s*:?\s*\d{1,2}\s*(?:-|–|to)\s*\d{1,2}(?:\s*(?:years?|yrs?))?\b|\b\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)\b/i, " ").replace(/€?\s*0\.00\b/i, " ").trim();
  return withoutDate.replace(/\s{2,}/g, " ").replace(/^[·|,\s-]+|[·|,\s-]+$/g, "");
}
function findCampTitle(lines: string[], index: number, providerName: string) {
  const title = lines.slice(Math.max(0, index - 5), index + 1).reverse().find((line) => /\b(camp|workshop|course|class|academy|club)\b/i.test(line) && !navigationReject.test(line) && line.toLowerCase() !== providerName.toLowerCase());
  return title ?? "Bricks 4 Kidz Camp";
}
function extractBricksBookingCamps(rawText: string, input: DiscoveryInput, providerName: string, providerId: string, fallbackCounty: string, sourceMethod: SourceMethod) {
  const lines = rawText.replace(/\r/g, "\n").split(/\n+/).map((line) => line.trim().replace(/\s{2,}/g, " ")).filter(Boolean);
  const camps: DiscoveryCamp[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const rowHasDate = parseDateRange(lines[index]);
    if (!rowHasDate) continue;
    const context = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 4)).join(" · ");
    const dateRange = rowHasDate;
    const timeRange = parseTimeRange(lines[index]);
    const ageRange = parseAgeRange(context);
    if (!dateRange || !timeRange.startTime || !ageRange.ageMin) continue;
    const locationText = extractLocationText(lines[index], dateRange) || extractLocationText(context, dateRange);
    const title = findCampTitle(lines, index, providerName);
    const town = inferTown(locationText);
    const county = inferCounty(`${locationText} ${input.sourceUrl} ${input.county ?? ""} ${input.notes ?? ""}`, fallbackCounty);
    const nameParts = [title, dateRange.label, town || locationText].filter(Boolean);
    const campName = nameParts.join(" · ").slice(0, 140);
    const fieldConfidence = { camp_name: 90, county: county ? 85 : 0, town: town ? 82 : 0, address: locationText ? 60 : 0, eircode: 0, activity_type: 95, holiday_type: 88, age: 95, start_date: 95, price: 0, booking_url: 80 };
    const confidence = confidenceScore(fieldConfidence, { camp_name: 3, holiday_type: 2, age: 2, start_date: 2, price: 1, booking_url: 1, activity_type: 1 });
    camps.push({ camp_id: slugify(`${providerId || "provider"}-${campName}`) || `bricks-booking-camp-${index + 1}`, provider_id: providerId, camp_name: campName, county, town, address: locationText, eircode: "", activity_type: "STEM", holiday_type: findHoliday(campName, input.holidayType?.trim()), age_min: ageRange.ageMin, age_max: ageRange.ageMax, start_date: dateRange.startDate, end_date: dateRange.endDate, start_time: timeRange.startTime, end_time: timeRange.endTime, half_day_or_full_day: "Unknown", price: "", booking_url: input.sourceUrl, status: "draft", verified: false, featured: false, source_url: input.sourceUrl, last_checked: today(), selected: confidence >= 60, needs_review: true, duplicateWarnings: [], confidence, fieldConfidence, extractionWarnings: [], source_method: sourceMethod });
  }
  return camps;
}

function allMatches(text: string, regex: RegExp) { return Array.from(text.matchAll(regex)).map((match) => match[0]); }
function uniqueDebugMatches(matches: ExtractionDebugMatch[]) { const seen = new Set<string>(); return matches.filter((match) => { const key = `${match.type}:${match.value}`; if (!match.value || seen.has(key)) return false; seen.add(key); return true; }); }
function buildBricksDebugCandidates(rawText: string, input: DiscoveryInput, providerName: string, fallbackCounty: string, sourceMethod: SourceMethod) {
  const lines = rawText.replace(/\r/g, "\n").split(/\n+/).map((line) => line.trim().replace(/\s{2,}/g, " ")).filter(Boolean);
  const rows: ExtractionDebugCandidate[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const dateRange = parseDateRange(lines[index]);
    if (!dateRange) continue;
    const context = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 4)).join(" · ");
    const timeRange = parseTimeRange(lines[index]);
    const ageRange = parseAgeRange(context);
    const locationText = extractLocationText(lines[index], dateRange) || extractLocationText(context, dateRange);
    const title = findCampTitle(lines, index, providerName);
    const town = inferTown(locationText);
    const county = inferCounty(`${locationText} ${input.sourceUrl} ${input.county ?? ""} ${input.notes ?? ""}`, fallbackCounty);
    const fieldConfidence = { camp_name: 90, county: county ? 85 : 0, town: town ? 82 : 0, address: locationText ? 60 : 0, eircode: 0, activity_type: 95, holiday_type: 88, age: ageRange.ageMin ? 95 : 0, start_date: dateRange.startDate ? 95 : 0, price: 0, booking_url: input.sourceUrl ? 80 : 0 };
    rows.push({ extractedText: context, parsedFields: { title, start_date: dateRange.startDate, end_date: dateRange.endDate, matched_time: timeRange.label, start_time: timeRange.startTime, end_time: timeRange.endTime, matched_age: ageRange.label, age_min: ageRange.ageMin, age_max: ageRange.ageMax, location: locationText, town, county, source_method: sourceMethod }, confidence: confidenceScore(fieldConfidence, { camp_name: 3, holiday_type: 2, age: 2, start_date: 2, price: 1, booking_url: 1, activity_type: 1 }), validationFailures: [dateRange.startDate ? "" : "No valid start date", timeRange.startTime ? "" : "Missing time range", ageRange.ageMin ? "" : "Missing age range", locationText ? "" : "Missing location", title ? "" : "No camp title"].filter(Boolean) });
  }
  return rows;
}

export function buildExtractionDebug(input: DiscoveryInput, rawText: string, sourceMethod: SourceMethod = "crawler"): ExtractionPipelineDebug {
  const text = rawText.replace(/\s+/g, " ").trim();
  const providerName = input.providerName?.trim() || titleFromUrl(input.sourceUrl);
  const county = inferCounty(`${text} ${input.sourceUrl} ${input.notes ?? ""}`, input.county?.trim() || findKnown(text, counties));
  const activity = classifyActivity(text, input.activityType?.trim());
  const genericRows: ExtractionDebugCandidate[] = extractCampCandidates(rawText, providerName).map(({ name, context }) => {
    const date = firstMatch(context, /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|July|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i);
    const timeRange = parseTimeRange(context);
    const time = timeRange.label;
    const price = firstMatch(context, /€\s?\d+(?:\.\d{2})?/);
    const ageRange = parseAgeRange(context);
    const ageMin = ageRange.ageMin;
    const ageMax = ageRange.ageMax;
    const campActivity = classifyActivity(`${name} ${context}`, activity);
    const bookingUrl = firstUrl(context, /https?:\/\/\S*(?:book|booking|enrol|enroll|schedule|class|profile\.php|selected_schedule)\S*/i).replace(/[),.;]+$/, "") || (/book\s+(now|online)|booking|enrol|schedule|selected_schedule|profile\.php/i.test(context) ? input.sourceUrl : "");
    const fieldConfidence = { camp_name: 88, county: county ? 78 : 0, town: 0, address: 0, eircode: validEircode(text) ? 100 : 0, activity_type: campActivity ? 86 : 0, holiday_type: findHoliday(`${name} ${context}`) !== "Other" ? 88 : 35, age: ageMin || ageMax ? 88 : 0, start_date: date ? 76 : 0, price: price ? 100 : 0, booking_url: bookingUrl ? 75 : 0 };
    return { extractedText: context, parsedFields: { name, date, matched_time: time, start_time: timeRange.startTime, end_time: timeRange.endTime, price, matched_age: ageRange.label, age_min: ageMin, age_max: ageMax, activity_type: campActivity, booking_url: bookingUrl }, confidence: confidenceScore(fieldConfidence, { camp_name: 3, holiday_type: 2, age: 2, start_date: 2, price: 1, booking_url: 1, activity_type: 1 }), validationFailures: [date ? "" : "Missing dates", price ? "" : "No price detected", bookingUrl ? "" : "Missing booking URL"].filter(Boolean) };
  });
  const isBricks = /bricks\s*4\s*kidz|profile\.php|selected_schedule|south county dublin/i.test(`${rawText} ${input.sourceUrl} ${providerName}`);
  const bricksRows = isBricks ? buildBricksDebugCandidates(rawText, input, providerName, county, sourceMethod) : [];
  const records = extractDiscoveryRecords(input, rawText, sourceMethod);
  const candidateRows = isBricks && bricksRows.length ? bricksRows : genericRows;
  const regexMatches = uniqueDebugMatches([...(providerName ? [{ type: "Provider" as const, value: providerName }] : []), ...allMatches(rawText, /\b(?:\d{1,2})(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(?:-|–|to)\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+20\d{2})?|\b\d{1,2}(?:st|nd|rd|th)?\s*(?:-|–|to)\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+20\d{2})?|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*20\d{2})?\s*(?:-|–|to)\s*(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?\d{1,2}(?:st|nd|rd|th)?(?:,\s*20\d{2})?/gi).map((value) => ({ type: "Date" as const, value })), ...allMatches(rawText, /\b\d{1,2}:\d{2}\s*(?:am|pm)?\s*(?:-|–|to)\s*\d{1,2}:\d{2}\s*(?:am|pm)?\b|\b\d{1,2}\s*(?:am|pm)?\s*(?:-|–|to)\s*\d{1,2}\s*(?:am|pm)\b/gi).map((value) => ({ type: "Time" as const, value })), ...allMatches(rawText, /\b(?:suitable\s+for\s+)?ages?\s*:?\s*\d{1,2}\s*(?:-|–|to)\s*\d{1,2}(?:\s*(?:years?|yrs?))?\b|\b\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)\b/gi).map((value) => ({ type: "Age" as const, value })), ...allMatches(rawText, /€\s?\d+(?:\.\d{2})?/g).map((value) => ({ type: "Price" as const, value })), ...southDublinTowns.filter((town) => rawText.toLowerCase().includes(town.toLowerCase())).map((value) => ({ type: "Town" as const, value })), ...candidateRows.map((row) => String(row.parsedFields.location ?? "")).filter(Boolean).map((value) => ({ type: "Location" as const, value }))]);
  const count = (type: ExtractionDebugMatch["type"]) => regexMatches.filter((match) => match.type === type).length;
  return { sourceUrl: input.sourceUrl, sourceMethod, rawTextPreview: rawText.slice(0, 5000), stages: [{ label: "Provider detected", count: providerName ? 1 : 0, passed: Boolean(providerName) }, { label: "Dates detected", count: count("Date"), passed: count("Date") > 0 }, { label: "Time ranges detected", count: count("Time"), passed: count("Time") > 0 }, { label: "Age ranges detected", count: count("Age"), passed: count("Age") > 0 }, { label: "Locations detected", count: count("Location"), passed: count("Location") > 0 }, { label: "Candidate rows created", count: candidateRows.length, passed: candidateRows.length > 0 }, { label: "Camps created", count: records.camps.length, passed: records.camps.length > 0 }], regexMatches, candidateRows, validationFailures: [...candidateRows.flatMap((row) => row.validationFailures), ...Array.from({ length: Math.max(0, candidateRows.length - records.camps.length) }, () => "Duplicate camp")], finalCampObjects: records.camps };
}


export function slugify(value: string) { return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72); }
function today() { return new Date().toISOString().slice(0, 10); }
function firstMatch(text: string, regex: RegExp) { return text.match(regex)?.[0] ?? ""; }
function firstUrl(text: string, regex: RegExp) { return text.match(regex)?.[0] ?? ""; }
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

export function extractDiscoveryRecords(input: DiscoveryInput, rawText: string, sourceMethod: SourceMethod = "crawler") {
  const text = rawText.replace(/\s+/g, " ").trim();
  const providerName = input.providerName?.trim() || titleFromUrl(input.sourceUrl);
  const providerId = input.providerId?.trim() || (providerName ? slugify(providerName) : "");
  const county = inferCounty(`${text} ${input.sourceUrl} ${input.notes ?? ""}`, input.county?.trim() || findKnown(text, counties));
  const activity = classifyActivity(text, input.activityType?.trim());
  const providerFieldConfidence = { provider_name: providerName ? (input.providerName ? 100 : 78) : 0, website: input.sourceUrl ? 95 : 0, primary_email: validEmail(text) ? 100 : 0, primary_phone: validPhone(text) ? 90 : 0, primary_county: county ? (input.county ? 100 : 78) : 0, activity_category: activity ? 84 : 0 };
  const provider: DiscoveryProvider = { provider_id: providerId, provider_name: providerName, website: websiteFromUrl(input.sourceUrl), source_url: input.sourceUrl, primary_email: validEmail(text), primary_phone: validPhone(text), description: "", primary_county: county, activity_category: activity, provider_type: "", status: "draft", verified: false, featured: false, last_checked: today(), notes: input.notes ?? "", selected: Boolean(providerId && providerName), needs_review: true, duplicateWarnings: [], confidence: confidenceScore(providerFieldConfidence, { provider_name: 3, website: 2, primary_email: 1, primary_phone: 1, primary_county: 1, activity_category: 1 }), fieldConfidence: providerFieldConfidence, extractionWarnings: [], source_method: sourceMethod };

  const candidates = extractCampCandidates(rawText, providerName);
  const globalEircode = validEircode(text);
  const genericCamps: DiscoveryCamp[] = candidates.map(({ name, context }, index) => {
    const date = firstMatch(context, /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|July|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i);
    const timeRange = parseTimeRange(context);
    const time = timeRange.startTime;
    const price = firstMatch(context, /€\s?\d+(?:\.\d{2})?/);
    const ageRange = parseAgeRange(context);
    const ageMin = ageRange.ageMin;
    const ageMax = ageRange.ageMax;
    const campActivity = classifyActivity(`${name} ${context}`, activity);
    const bookingUrl = firstUrl(context, /https?:\/\/\S*(?:book|booking|enrol|enroll|schedule|class|profile\.php|selected_schedule)\S*/i).replace(/[),.;]+$/, "") || (/book\s+(now|online)|booking|enrol|schedule|selected_schedule|profile\.php/i.test(context) ? input.sourceUrl : "");
    const fieldConfidence = { camp_name: 88, county: county ? 78 : 0, town: 0, address: 0, eircode: globalEircode ? 100 : 0, activity_type: campActivity ? 86 : 0, holiday_type: findHoliday(`${name} ${context}`) !== "Other" ? 88 : 35, age: ageMin || ageMax ? 88 : 0, start_date: date ? 76 : 0, price: price ? 100 : 0, booking_url: bookingUrl ? 75 : 0 };
    const confidence = confidenceScore(fieldConfidence, { camp_name: 3, holiday_type: 2, age: 2, start_date: 2, price: 1, booking_url: 1, activity_type: 1 });
    const extractionWarnings = [date ? "" : "Missing dates", price ? "" : "No price detected", bookingUrl ? "" : "Missing booking URL"].filter(Boolean);
    return { camp_id: slugify(`${providerId || "provider"}-${name}`) || `discovered-camp-${index + 1}`, provider_id: providerId, camp_name: name, county, town: "", address: "", eircode: globalEircode, activity_type: campActivity, holiday_type: findHoliday(`${name} ${context}`, input.holidayType?.trim()), age_min: ageMin, age_max: ageMax, start_date: date, end_date: "", start_time: time, end_time: "", half_day_or_full_day: /half\s?day/i.test(context) ? "Half day" : /full\s?day/i.test(context) ? "Full day" : "Unknown", price, booking_url: bookingUrl, status: "draft", verified: false, featured: false, source_url: input.sourceUrl, last_checked: today(), selected: confidence >= 60, needs_review: true, duplicateWarnings: [], confidence, fieldConfidence, extractionWarnings, source_method: sourceMethod };
  });
  const bricksCamps = /bricks\s*4\s*kidz|profile\.php|selected_schedule|south county dublin/i.test(`${rawText} ${input.sourceUrl} ${providerName}`) ? extractBricksBookingCamps(rawText, input, providerName, providerId, county, sourceMethod) : [];
  const camps = dedupeDiscoveryCamps(bricksCamps.length ? bricksCamps : genericCamps);
  const manualEmptyWarning = sourceMethod === "manual_paste" && rawText.trim() && camps.length === 0 ? "Manual text was added, but no camps could be extracted. Check extraction patterns or paste a more complete section." : "";
  const warnings = [providerName ? "" : "Provider name could not be determined.", manualEmptyWarning || (camps.length ? "" : "No high-confidence camp offerings found; generic navigation items were ignored."), camps.length && camps.every((camp) => !camp.price) ? "No prices detected" : "", camps.some((camp) => !camp.start_date) ? `${camps.filter((camp) => !camp.start_date).length} camp(s) missing dates` : "", camps.some((camp) => !camp.booking_url) ? "Booking links not detected for all camps" : ""].filter(Boolean);
  return { providers: provider.provider_id || provider.provider_name ? [provider] : [], camps, warnings, textLength: text.length };
}

export function dedupeDiscoveryCamps(camps: DiscoveryCamp[]) {
  const seen = new Set<string>();
  return camps.filter((camp) => {
    const keys = [
      camp.camp_id ? `id:${camp.camp_id}` : "",
      camp.provider_id && camp.camp_name && camp.town && camp.start_date ? `provider:${camp.provider_id}:${camp.camp_name.toLowerCase()}:${camp.town.toLowerCase()}:${camp.start_date}` : "",
      camp.source_url && camp.camp_name ? `source:${camp.source_url}:${camp.camp_name.toLowerCase()}` : "",
    ].filter(Boolean);
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}

export function recordsToCsv(records: Array<Record<string, unknown>>) {
  if (records.length === 0) return "";
  const headers = Object.keys(records[0]).filter((key) => !["selected", "needs_review", "duplicateWarnings", "fieldConfidence", "extractionWarnings", "confidence", "source_method"].includes(key));
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...records.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}
