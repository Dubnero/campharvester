import type { Camp, HolidayType, Provider } from "./types";

export type DiscoveryInput = { sourceUrl: string; providerId?: string; providerName?: string; county?: string; activityType?: string; holidayType?: string; notes?: string };
export type ConfidenceBreakdown = Record<string, number>;
export type SourceMethod = "crawler" | "manual_paste";
export type DiscoveryProvider = Provider & { selected: boolean; needs_review: boolean; duplicateWarnings: string[]; confidence: number; fieldConfidence: ConfidenceBreakdown; extractionWarnings: string[]; source_method: SourceMethod };
export type CampComparison = { field: string; existing: string; extracted: string; warning: string };
export type DiscoveryCamp = Camp & { selected: boolean; needs_review: boolean; duplicateWarnings: string[]; comparisonWarnings?: CampComparison[]; matchedExistingCamp?: Camp; confidence: number; fieldConfidence: ConfidenceBreakdown; extractionWarnings: string[]; source_method: SourceMethod };
export type DiscoveryPageAnalysis = { url: string; text?: string; readableTextLength: number; candidateCount: number; dynamicWarning?: boolean; status: "analysed" | "failed" | "manual_added" | "extracted"; failureReason?: string; sourceMethod: SourceMethod; extractionBlocked?: boolean };
export type ExtractionDebugMatch = { type: "Provider" | "Date" | "Time" | "Age" | "Location" | "Town" | "Price"; value: string };
export type ExtractionDebugCandidate = { extractedText: string; parsedFields: Record<string, string | number>; confidence: number; validationFailures: string[] };
export type ExtractionPipelineDebug = { sourceUrl: string; sourceMethod: SourceMethod; rawTextPreview: string; stages: Array<{ label: string; count: number; passed: boolean }>; regexMatches: ExtractionDebugMatch[]; candidateRows: ExtractionDebugCandidate[]; validationFailures: string[]; finalCampObjects: DiscoveryCamp[] };

const counties = ["Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath", "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath", "Wexford", "Wicklow"];
const holidays: HolidayType[] = ["Summer", "Easter", "Halloween", "February Midterm", "October Midterm", "Christmas", "Other"];
const navigationReject = /^(our )?(programmes?|programming|school tours?|after school programmes?|classes|activities|parties|contact|about|home|book now|faq|faqs|gallery|locations?|prices?|timetable|schedule|camp dates?|camps?|summer|easter|halloween)(?:\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4})?$/i;
const campSignal = /\b(summer|easter|halloween|midterm|christmas)\s+(camp|course|workshop)|\bcamp\s+(dates?|weeks?|booking|price|cost)|\b(?:ages?|aged)\s*\d|€\s?\d|book\s+(now|online)|\b\d{1,2}\s*(?:-|to)\s*\d{1,2}\s*(?:years?|yrs?)\b/i;
const eircodeRegex = /\b(?:[AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}\b/i;
const candidateAgeWindow = 8;

const monthNumbers: Record<string, string> = { jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03", apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09", oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12" };
const southDublinTowns = ["Firhouse", "Cherrywood", "Mount Merrion", "Newtownpark", "Kilternan", "Saggart", "Rathfarnham", "Killiney", "Foxrock", "Sandyford", "Knocklyon", "Cabinteely", "Dundrum", "Stillorgan", "Blackrock", "Monkstown", "Dún Laoghaire", "Dun Laoghaire", "Dalkey", "Ballinteer", "Terenure", "Templeogue", "Tallaght", "Lucan", "Clondalkin"];
const nonCampOffering = /\b(after[- ]?school(?:\s+clubs?)?|birthday\s+part(?:y|ies)|workshops?|holiday\s+clubs?)\b/i;

type BricksDateRange = { label: string; startDate: string; endDate: string; priority: number };
type TimeRange = { startTime: string; endTime: string; label: string };

function cleanOrdinal(value: string) { return value.replace(/(st|nd|rd|th)$/i, ""); }
function pad2(value: string | number) { return String(value).padStart(2, "0"); }
function inferYear(text: string) { return text.match(/\b20\d{2}\b/)?.[0] ?? today().slice(0, 4); }
function isoDate(day: string, month: string, year: string) { return `${year}-${monthNumbers[month.toLowerCase()] ?? ""}-${pad2(cleanOrdinal(day))}`; }
function parseNumericDate(day: string, month: string, year: string) { return `${year.length === 2 ? `20${year}` : year}-${pad2(month)}-${pad2(day)}`; }
function parseDateRange(text: string): BricksDateRange | null {
  const numericRange = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2}|\d{2})\s*(?:-|–|to)\s*(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2}|\d{2})\b/i);
  if (numericRange) return { label: numericRange[0], startDate: parseNumericDate(numericRange[1], numericRange[2], numericRange[3]), endDate: parseNumericDate(numericRange[4], numericRange[5], numericRange[6]), priority: 1 };
  const isoRange = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\s*(?:-|–|to)\s*(20\d{2})-(\d{2})-(\d{2})\b/i);
  if (isoRange) return { label: isoRange[0], startDate: `${isoRange[1]}-${isoRange[2]}-${isoRange[3]}`, endDate: `${isoRange[4]}-${isoRange[5]}-${isoRange[6]}`, priority: 2 };
  const year = inferYear(text);
  const splitMonth = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(?:-|–|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(20\d{2}))?/i);
  if (splitMonth) return { label: splitMonth[0], startDate: isoDate(splitMonth[1], splitMonth[2], splitMonth[5] || year), endDate: isoDate(splitMonth[3], splitMonth[4], splitMonth[5] || year), priority: 4 };
  const dayFirst = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(20\d{2}))?/i);
  if (dayFirst) return { label: dayFirst[0], startDate: isoDate(dayFirst[1], dayFirst[3], dayFirst[4] || year), endDate: isoDate(dayFirst[2], dayFirst[3], dayFirst[4] || year), priority: 4 };
  const monthFirst = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?\s*(?:-|–|to)\s*(?:(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?(?!\s*(?:am|pm))/i);
  if (monthFirst) {
    const startMonth = monthFirst[1];
    const endMonth = monthFirst[4] || startMonth;
    const startYear = monthFirst[3] || year;
    const endYear = monthFirst[6] || startYear;
    return { label: monthFirst[0], startDate: isoDate(monthFirst[2], startMonth, startYear), endDate: isoDate(monthFirst[5], endMonth, endYear), priority: 4 };
  }
  return null;
}
function to24Hour(hourValue: string, minuteValue: string | undefined, marker: string | undefined) {
  let hour = Number(hourValue);
  const minute = Number(minuteValue ?? 0);
  const effectiveMarker = (marker || "").toLowerCase();
  if (hour > 12) return `${pad2(hour)}:${pad2(minute)}`;
  if (effectiveMarker === "pm" && hour < 12) hour += 12;
  if (effectiveMarker === "am" && hour === 12) hour = 0;
  return `${pad2(hour)}:${pad2(minute)}`;
}
function parseTimeRange(text: string): TimeRange {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match || (!match[2] && !match[5] && !match[3] && !match[6])) return { startTime: "", endTime: "", label: "" };
  const endMarker = match[6];
  const startMarker = match[3] || (endMarker && Number(match[1]) <= Number(match[4]) ? endMarker : undefined);
  return { label: match[0], startTime: to24Hour(match[1], match[2], startMarker), endTime: to24Hour(match[4], match[5], endMarker) };
}
function parseAgeRange(text: string) {
  const match = text.match(/\b(?:suitable\s+for\s+)?ages?\s*:?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})(?:\s*(?:years?|yrs?))?\b|\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years?|yrs?)\b/i);
  return { label: match?.[0] ?? "", ageMin: Number(match?.[1] ?? match?.[3] ?? 0), ageMax: Number(match?.[2] ?? match?.[4] ?? 0) };
}
function inferTown(text: string) {
  const lower = text.toLowerCase();
  if (/rathfarn(?:ham|ahm|am)\s+etns/i.test(text)) return "Rathfarnham";
  if (/\brathfarn(?:ham|ahm|am)\b/i.test(text)) return "Rathfarnham";
  if (/holy trinity (?:church|centre)|carry centre/i.test(text) && /killiney|south county dublin|dublin|bricks\s*4\s*kidz|bricks4kidz/i.test(text)) return "Killiney";
  return southDublinTowns.find((town) => lower.includes(town.toLowerCase())) ?? "";
}
function inferCounty(text: string, fallback: string) {
  if (fallback) return fallback;
  return /\bDublin\b|\bD\d{1,2}\b|south county dublin/i.test(text) || inferTown(text) ? "Dublin" : "";
}
function candidateTextWindow(lines: string[], index: number, radius = candidateAgeWindow) {
  return lines.slice(Math.max(0, index - radius), Math.min(lines.length, index + radius + 1)).join(" · ");
}
function nearestAgeRange(lines: string[], index: number, radius = candidateAgeWindow) {
  const ownLine = parseAgeRange(lines[index]);
  if (ownLine.ageMin) return ownLine;
  for (let distance = 1; distance <= radius; distance += 1) {
    const after = lines[index + distance] ? parseAgeRange(lines[index + distance]) : null;
    if (after?.ageMin) return after;
    const before = lines[index - distance] ? parseAgeRange(lines[index - distance]) : null;
    if (before?.ageMin) return before;
  }
  return parseAgeRange(candidateTextWindow(lines, index, radius));
}

function extractLocationText(text: string, dateRange: BricksDateRange) {
  const withoutDate = text.replace(dateRange.label, " ").replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|–|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, " ").replace(/\b(?:suitable\s+for\s+)?ages?\s*:?\s*\d{1,2}\s*(?:-|–|to)\s*\d{1,2}(?:\s*(?:years?|yrs?))?\b|\b\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)\b/i, " ").replace(/(?:schedule\s+cost|term\s+(?:cost|price)|price|cost)\s*:?\s*€?\s*\d+(?:\.\d{2})?|€\s*\d+(?:\.\d{2})?/i, " ").replace(/€?\s*0\.00\b/i, " ").trim();
  return withoutDate.replace(/\s{2,}/g, " ").replace(/^[·|,\s-]+|[·|,\s-]+$/g, "");
}
function extractPrice(text: string) {
  const matches = Array.from(text.matchAll(/(?:schedule\s+cost|term\s+cost|term\s+price|price|cost)\s*:?\s*(€\s*\d+(?:\.\d{2})?|\d+(?:\.\d{2})?)|€\s*\d+(?:\.\d{2})?/gi));
  const ordered = [...matches].sort((a, b) => (/schedule\s+cost/i.test(b[0]) ? 1 : 0) - (/schedule\s+cost/i.test(a[0]) ? 1 : 0));
  for (const match of ordered) {
    const value = (match[1] ?? match[0]).replace(/^(?:schedule\s+cost|term\s+cost|term\s+price|price|cost)\s*:?\s*/i, "").trim();
    if (!value || /^€?\s*0(?:\.00)?$/i.test(value)) continue;
    return value.startsWith("€") ? value.replace(/€\s*/, "€") : `€${value}`;
  }
  return "";
}
function nearestPrice(lines: string[], index: number) {
  const ownLine = extractPrice(lines[index]);
  if (ownLine) return ownLine;
  for (let offset = 1; offset <= 6; offset += 1) {
    const after = lines[index + offset];
    if (after && parseDateRange(after)) break;
    const priceAfter = after ? extractPrice(after) : "";
    if (priceAfter) return priceAfter;
  }
  for (let offset = 1; offset <= 3; offset += 1) {
    const before = lines[index - offset];
    if (before && parseDateRange(before)) break;
    const priceBefore = before ? extractPrice(before) : "";
    if (priceBefore) return priceBefore;
  }
  return "";
}
function isCampOffering(text: string) {
  const lower = text.toLowerCase();
  if (/\b(after[- ]?school(?:\s+clubs?)?|birthday\s+part(?:y|ies)|workshops?)\b/i.test(text)) return false;
  if (/holiday\s+club/i.test(text) && !/\bcamps?\b/.test(lower)) return false;
  return /\bcamps?\b/.test(lower) || !nonCampOffering.test(text);
}
function inferHolidayFromDate(date: string, fallback?: string): HolidayType {
  if (fallback) return fallback as HolidayType;
  const month = Number(date.slice(5, 7));
  if (month >= 6 && month <= 8) return "Summer";
  if (month === 10) return "Halloween";
  if (month === 12) return "Christmas";
  if (month === 2) return "February Midterm";
  if (month === 3 || month === 4) return "Easter";
  return "Other";
}
function inferDayType(startTime: string, endTime: string) {
  const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
  if (!startTime || !endTime) return "Unknown";
  const duration = minutes(endTime) - minutes(startTime);
  if (duration <= 0) return "Unknown";
  return duration < 300 ? "Half day" : "Full day";
}
function findCampTitle(lines: string[], index: number, providerName: string, town = "") {
  const title = lines.slice(Math.max(0, index - 6), index + 1).reverse().find((line) => /\bcamps?\b/i.test(line) && !nonCampOffering.test(line) && !navigationReject.test(line) && line.toLowerCase() !== providerName.toLowerCase());
  return title ?? (town ? `${town} Summer Camp` : "Summer Camp");
}

function isSelectMarker(line: string) {
  return /^select\b/i.test(line);
}
function isMarketingScheduleTitle(line: string) {
  const dateRange = parseDateRange(line);
  return Boolean(dateRange && dateRange.priority >= 4);
}
function marketingTitleHasVenue(line: string, dateRange: BricksDateRange) {
  return Boolean(inferTown(line) || extractLocationText(line, dateRange));
}
function bricksScheduleRows(lines: string[]) {
  const rows: Array<{ index: number; dateRange: BricksDateRange; text: string }> = [];
  const usedStructuredRows = new Set<number>();
  const seenTitles = new Set<string>();
  for (let index = 0; index < lines.length; index += 1) {
    const titleDateRange = parseDateRange(lines[index]);
    if (!titleDateRange || titleDateRange.priority < 4 || !marketingTitleHasVenue(lines[index], titleDateRange)) continue;

    let structuredIndex = -1;
    let structuredDateRange: BricksDateRange | null = null;
    let limit = Math.min(lines.length, index + 10);
    for (let cursor = index + 1; cursor < limit; cursor += 1) {
      if (isSelectMarker(lines[cursor]) || isMarketingScheduleTitle(lines[cursor])) {
        limit = cursor;
        break;
      }
      const forwardDateRange = parseDateRange(lines[cursor]);
      if (forwardDateRange && forwardDateRange.priority < 4) {
        if (!usedStructuredRows.has(cursor)) {
          structuredIndex = cursor;
          structuredDateRange = forwardDateRange;
        }
        limit = cursor + 1;
        break;
      }
    }
    if (structuredIndex === -1 || !structuredDateRange) continue;

    const key = `${index}:${lines[index].toLowerCase()}`;
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    usedStructuredRows.add(structuredIndex);
    rows.push({ index: structuredIndex, dateRange: structuredDateRange, text: lines.slice(index, limit).join(" · ") });
  }
  return rows;
}
function extractBricksBookingCamps(rawText: string, input: DiscoveryInput, providerName: string, providerId: string, fallbackCounty: string, sourceMethod: SourceMethod) {
  const lines = normalizeStarcampPriceText(rawText).replace(/\r/g, "\n").split(/\n+/).map((line) => line.trim().replace(/\s{2,}/g, " ")).filter(Boolean);
  const camps: DiscoveryCamp[] = [];
  for (const row of bricksScheduleRows(lines)) {
    const index = row.index;
    const context = row.text;
    const dateRange = row.dateRange;
    const timeRange = parseTimeRange(context);
    const ageRange = nearestAgeRange(lines, index);
    if (!dateRange || !timeRange.startTime || !ageRange.ageMin) continue;
    const locationText = extractLocationText(context, dateRange);
    const town = inferTown(`${locationText} ${context}`);
    const title = findCampTitle(lines, index, providerName, town);
    if (!isCampOffering(`${title} ${context}`)) continue;
    const county = inferCounty(`${locationText} ${input.sourceUrl} ${input.county ?? ""} ${input.notes ?? ""}`, fallbackCounty);
    if (!locationText) continue;
    const price = nearestPrice(lines, index);
    const campName = title.slice(0, 140);
    const fieldConfidence = { camp_name: 90, county: county ? 85 : 0, town: town ? 82 : 0, address: locationText ? 60 : 0, eircode: 0, activity_type: 95, holiday_type: 88, age: 95, start_date: 95, price: price ? 100 : 0, booking_url: 80 };
    const confidence = confidenceScore(fieldConfidence, { camp_name: 3, holiday_type: 2, age: 2, start_date: 2, price: 1, booking_url: 1, activity_type: 1 });
    camps.push({ camp_id: slugify(`${providerId || "provider"}-${campName}-${town}-${dateRange.startDate}`) || `bricks-booking-camp-${index + 1}`, provider_id: providerId, camp_name: campName, county, town, address: locationText, eircode: "", activity_type: "STEM", holiday_type: inferHolidayFromDate(dateRange.startDate, input.holidayType?.trim()), age_min: ageRange.ageMin, age_max: ageRange.ageMax, start_date: dateRange.startDate, end_date: dateRange.endDate, start_time: timeRange.startTime, end_time: timeRange.endTime, half_day_or_full_day: inferDayType(timeRange.startTime, timeRange.endTime), price, booking_url: input.sourceUrl, status: "draft", verified: false, featured: false, source_url: input.sourceUrl, last_checked: today(), selected: confidence >= 60, needs_review: true, duplicateWarnings: [], confidence, fieldConfidence, extractionWarnings: [], source_method: sourceMethod });
  }
  return camps;
}


function isStarcampSource(input: DiscoveryInput, rawText: string, providerName: string) {
  return /starcamp\.ie/i.test(input.sourceUrl) || /\bstarcamp\b/i.test(`${providerName} ${rawText}`);
}

function isStarcampProductSourceUrl(sourceUrl: string) {
  try { return /^\/product\/[^/]*camp[^/]*\/?$/i.test(new URL(sourceUrl).pathname) && /(^|\.)starcamp\.ie$/i.test(new URL(sourceUrl).hostname.replace(/^www\./, "")); } catch { return false; }
}
function isStarcampListingSourceUrl(sourceUrl: string) {
  try { return /^\/(summer|easter)-camps-list(?:\/page\/\d+)?\/?$/i.test(new URL(sourceUrl).pathname) && /(^|\.)starcamp\.ie$/i.test(new URL(sourceUrl).hostname.replace(/^www\./, "")); } catch { return false; }
}
function starcampTownFromUrl(sourceUrl: string) {
  try {
    const slug = new URL(sourceUrl).pathname.split("/").filter(Boolean).pop() ?? "";
    return slug.replace(/-(?:summer|easter|halloween|midterm|christmas)?-?camp$/i, "").split("-")[0].replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch { return ""; }
}
type StarcampDateRange = BricksDateRange & { source: "radio_label" | "variation_option" | "readable_text" };
function normalizeStarcampDateText(rawText: string) { return rawText.replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, "–").replace(/&nbsp;/gi, " "); }
function inferStarcampDateOptionSource(context: string): StarcampDateRange["source"] {
  if (/radio|select|option|attribute|variation/i.test(context)) return /radio/i.test(context) ? "radio_label" : "variation_option";
  return "readable_text";
}
function extractStarcampDateRanges(rawText: string) {
  const normalizedText = normalizeStarcampDateText(rawText);
  const compact = normalizedText.replace(/\r/g, "\n").replace(/\n+/g, " · ");
  const ranges: StarcampDateRange[] = [];
  const seen = new Set<string>();
  const regex = /\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–|—|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(?:\s+(20\d{2}))?\b/gi;
  let match: RegExpExecArray | null;
  const fallbackYear = inferYear(normalizedText);
  while ((match = regex.exec(compact)) !== null) {
    const context = compact.slice(Math.max(0, match.index - 160), Math.min(compact.length, match.index + match[0].length + 160));
    const range = { label: match[0], startDate: isoDate(match[1], match[3], match[4] || fallbackYear), endDate: isoDate(match[2], match[3], match[4] || fallbackYear), priority: 4, source: inferStarcampDateOptionSource(context) } satisfies StarcampDateRange;
    const key = `${range.startDate}:${range.endDate}`;
    if (!seen.has(key)) { seen.add(key); ranges.push(range); }
  }
  return ranges;
}

type StarcampPriceCandidate = { price: string; source: "fixed_product_price" | "price_range_low" | "ignored_noise_price_low_confidence"; label: string; value: number };
type StarcampPriceMatch = { price: string; source: "fixed_product_price" | "price_range_low" | "ignored_noise_price" | "ignored_noise_price_low_confidence"; ignored: string[]; scopedCandidates: string[]; fallbackCandidates: string[]; rawPriceTextExamples: string[]; normalizedPriceCandidates: string[]; rejectionReason: string };
function formatEuroPrice(value: string | number) { return `€${Number(value).toFixed(2)}`; }
function normalizeStarcampText(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function rawStarcampPriceExamples(rawText: string) { return Array.from(new Set(Array.from(rawText.matchAll(/(?:€|&euro;|&#8364;|EUR)\s*(?:\r?\n|\s|·)*\d+(?:\.\d{2})?/gi)).map((match) => match[0].trim()))); }
function normalizeStarcampPriceText(value: string) {
  return value
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/\bEUR\b\s*/gi, "€")
    .replace(/€\s*(?:\r?\n|·)\s*/g, "€")
    .replace(/€\s+(?=\d)/g, "€");
}
function starcampProductSlugTokens(sourceUrl: string) {
  try { return new URL(sourceUrl).pathname.split("/").filter(Boolean).pop()?.replace(/-(?:summer|easter|halloween|midterm|christmas)?-?camp$/i, "").split("-").filter((part) => part.length > 2) ?? []; } catch { return []; }
}
function starcampPriceWindows(rawText: string, sourceUrl: string) {
  const lines = rawText.replace(/\r/g, "\n").split(/\n+/).map((line) => line.trim().replace(/\s{2,}/g, " ")).filter(Boolean);
  const tokens = starcampProductSlugTokens(sourceUrl);
  const titleIndex = lines.findIndex((line) => {
    const normalized = normalizeStarcampText(line);
    return tokens.length > 0 && tokens.every((token) => normalized.includes(token.toLowerCase()));
  });
  const firstAnyPriceIndex = lines.findIndex((line) => /€\s*\d+(?:\.\d{2})?/i.test(line));
  const firstValidPriceIndex = lines.findIndex((line) => /€\s*(?:[7-9]\d|1\d{2}|2\d{2})(?:\.\d{2})?/i.test(line));
  const starts = [titleIndex >= 0 ? Math.max(0, titleIndex - 8) : -1, firstValidPriceIndex >= 0 ? Math.max(0, firstValidPriceIndex - 14) : -1, firstAnyPriceIndex >= 0 ? Math.max(0, firstAnyPriceIndex - 14) : -1, 0].filter((index, position, values) => index >= 0 && values.indexOf(index) === position);
  return starts.map((start) => {
    const endCandidates = [lines.findIndex((line, index) => index > start && /^description$/i.test(line)), lines.findIndex((line, index) => index > start && /^additional information$/i.test(line)), lines.findIndex((line, index) => index > start && /related products|20% off any additional camps/i.test(line))].filter((index) => index > start);
    const end = endCandidates.length ? Math.min(...endCandidates) : Math.min(lines.length, start + 70);
    return lines.slice(start, end).join(" · ");
  });
}
function collectStarcampPriceCandidates(text: string) {
  const candidates: StarcampPriceCandidate[] = [];
  const seen = new Set<string>();
  const addCandidate = (candidate: StarcampPriceCandidate) => { const key = `${candidate.source}:${candidate.price}:${candidate.label}`; if (!seen.has(key)) { seen.add(key); candidates.push(candidate); } };
  for (const match of Array.from(text.matchAll(/price\s+range\s*:\s*€\s*(\d+(?:\.\d{2})?)\s*(?:through|to|[-–—])\s*€\s*(\d+(?:\.\d{2})?)/gi))) {
    const low = Math.min(Number(match[1]), Number(match[2]));
    addCandidate({ price: formatEuroPrice(low), source: low >= 70 ? "price_range_low" : "ignored_noise_price_low_confidence", label: match[0], value: low });
  }
  for (const match of Array.from(text.matchAll(/€\s*(\d+(?:\.\d{2})?)\s*(?:through|to|[-–—])\s*€\s*(\d+(?:\.\d{2})?)/gi))) {
    const low = Math.min(Number(match[1]), Number(match[2]));
    addCandidate({ price: formatEuroPrice(low), source: low >= 70 ? "price_range_low" : "ignored_noise_price_low_confidence", label: match[0], value: low });
  }
  for (const match of Array.from(text.matchAll(/€\s*(\d+(?:\.\d{2})?)/gi))) {
    const value = Number(match[1]);
    addCandidate({ price: formatEuroPrice(value), source: value >= 70 ? "fixed_product_price" : "ignored_noise_price_low_confidence", label: match[0].replace(/€\s*/, "€"), value });
  }
  return candidates;
}
function isStarcampNoisePrice(candidate: StarcampPriceCandidate) { return candidate.value === 0 || candidate.value === 1 || candidate.value === 10 || candidate.value === 60; }
function bestStarcampPriceCandidate(candidates: StarcampPriceCandidate[]) { return candidates.find((candidate) => candidate.value >= 70 && !isStarcampNoisePrice(candidate)); }
function extractStarcampProductPrice(rawText: string, sourceUrl: string): StarcampPriceMatch {
  const normalizedText = normalizeStarcampPriceText(rawText);
  const rawExamples = rawStarcampPriceExamples(rawText);
  const scopedCandidates = starcampPriceWindows(normalizedText, sourceUrl).flatMap(collectStarcampPriceCandidates);
  const fallbackCandidates = collectStarcampPriceCandidates(normalizedText);
  const ignored = Array.from(new Set([...scopedCandidates, ...fallbackCandidates].filter(isStarcampNoisePrice).map((candidate) => candidate.label)));
  const scoped = bestStarcampPriceCandidate(scopedCandidates);
  if (scoped) return { price: scoped.price, source: scoped.source, ignored, scopedCandidates: scopedCandidates.map((candidate) => candidate.label), fallbackCandidates: fallbackCandidates.map((candidate) => candidate.label), rawPriceTextExamples: rawExamples, normalizedPriceCandidates: Array.from(new Set([...scopedCandidates, ...fallbackCandidates].map((candidate) => candidate.label))), rejectionReason: "" };
  const fallback = bestStarcampPriceCandidate(fallbackCandidates);
  if (fallback) return { price: fallback.price, source: fallback.source, ignored, scopedCandidates: scopedCandidates.map((candidate) => candidate.label), fallbackCandidates: fallbackCandidates.map((candidate) => candidate.label), rawPriceTextExamples: rawExamples, normalizedPriceCandidates: Array.from(new Set([...scopedCandidates, ...fallbackCandidates].map((candidate) => candidate.label))), rejectionReason: "" };
  const lowConfidenceNoise = [...scopedCandidates, ...fallbackCandidates].find(isStarcampNoisePrice);
  if (lowConfidenceNoise) return { price: lowConfidenceNoise.price, source: "ignored_noise_price_low_confidence", ignored, scopedCandidates: scopedCandidates.map((candidate) => candidate.label), fallbackCandidates: fallbackCandidates.map((candidate) => candidate.label), rawPriceTextExamples: rawExamples, normalizedPriceCandidates: Array.from(new Set([...scopedCandidates, ...fallbackCandidates].map((candidate) => candidate.label))), rejectionReason: "Only ignored/noise price matches found; using low-confidence fallback" };
  return { price: "", source: "ignored_noise_price", ignored, scopedCandidates: scopedCandidates.map((candidate) => candidate.label), fallbackCandidates: fallbackCandidates.map((candidate) => candidate.label), rawPriceTextExamples: rawExamples, normalizedPriceCandidates: Array.from(new Set([...scopedCandidates, ...fallbackCandidates].map((candidate) => candidate.label))), rejectionReason: "No Starcamp product price matched in scoped or fallback search" };
}


function titleCaseStarcampName(value: string) { return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/\bUi\b/g, "Ui"); }
function inferStarcampHoliday(sourceUrl: string, rawText: string, fallback?: string): { holiday: HolidayType; source: "product_url" | "listing_url" | "fallback" } {
  try {
    const pathname = new URL(sourceUrl).pathname.toLowerCase();
    if (/\/product\/[^/]*summer-camp/.test(pathname)) return { holiday: "Summer", source: "product_url" };
    if (/\/product\/[^/]*easter-camp/.test(pathname)) return { holiday: "Easter", source: "product_url" };
    if (/\/summer-camps-list\//.test(`${pathname}/`)) return { holiday: "Summer", source: "listing_url" };
    if (/\/easter-camps-list\//.test(`${pathname}/`)) return { holiday: "Easter", source: "listing_url" };
  } catch { /* Fall back below. */ }
  if (fallback === "Summer" || fallback === "Easter") return { holiday: fallback, source: "fallback" };
  return { holiday: /\bsummer\b/i.test(rawText) && !/\beaster\b/i.test(rawText) ? "Summer" : /\beaster\b/i.test(rawText) ? "Easter" : "Other", source: "fallback" };
}
function cleanStarcampCampName(originalName: string, sourceUrl: string, holidayType: HolidayType) {
  const town = starcampTownFromUrl(sourceUrl);
  const cleanedOriginal = originalName.replace(/STARCAMP\s+Summer\s+Camps?/gi, " ").replace(/STARCAMP\s+Easter\s+Camps?/gi, " ").replace(/Nationwide/gi, " ").replace(/\s*[,|-]+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  const hasDrama = /\bdrama\b/i.test(cleanedOriginal);
  const base = [titleCaseStarcampName(town || cleanedOriginal.replace(/\b(?:summer|easter)\s+camp\b/ig, "").trim()), hasDrama ? "Drama" : "", holidayType, "Camp"].filter(Boolean).join(" ");
  return base.replace(/\s{2,}/g, " ").trim();
}

function cleanStarcampLocationText(value: string) {
  return value.replace(/&amp;/gi, "&").replace(/^Starcamp\s*/i, "").replace(/\b(?:summer|easter)\s+camp\b.*$/i, "").replace(/^[-–—:,]+|[-–—:,]+$/g, "").replace(/\s{2,}/g, " ").trim();
}

function parseStarcampTownVenue(value: string, fallbackTown: string) {
  const cleaned = cleanStarcampLocationText(value);
  const match = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (!match) return { town: fallbackTown, venue: cleaned };
  return { town: titleCaseStarcampName(match[1].trim()), venue: cleanStarcampLocationText(match[2]) };
}

function extractStarcampLocation(rawText: string, fallbackTown: string) {
  const lines = rawText.replace(/\r/g, "\n").split(/\n+/).map((line) => line.trim().replace(/\s{2,}/g, " ")).filter(Boolean);
  const titleLine = lines.find((line) => /^.{3,90}\s*[-–—]\s*.{3,90}$/.test(line) && !navigationReject.test(line)) ?? lines.find((line) => /\b(?:summer|easter)\s+camp\b/i.test(line) && !navigationReject.test(line)) ?? "";
  const venueLabel = lines.find((line) => /(?:venue|location|camp location|address)\s*:/i.test(line))?.replace(/.*?(?:venue|location|camp location|address)\s*:\s*/i, "") ?? "";
  const townVenue = parseStarcampTownVenue(venueLabel || titleLine, fallbackTown);
  const county = findKnown(rawText, counties);
  const town = townVenue.town || findKnown(rawText, [...southDublinTowns, fallbackTown].filter(Boolean)) || fallbackTown;
  const address = townVenue.venue && townVenue.venue.toLowerCase() !== town.toLowerCase() ? townVenue.venue : cleanStarcampLocationText(venueLabel || titleLine) || town;
  return { town, county, address, titleLine };
}
function extractStarcampCamps(rawText: string, input: DiscoveryInput, sourceMethod: SourceMethod) {
  const providerName = "Starcamp";
  const providerId = input.providerId?.trim() || "starcamp";
  if (!isStarcampProductSourceUrl(input.sourceUrl)) return [];
  const fallbackTown = starcampTownFromUrl(input.sourceUrl);
  const { town, county, address, titleLine } = extractStarcampLocation(rawText, fallbackTown);
  const dateRanges = extractStarcampDateRanges(rawText);
  const selectedDefaultDateOption = dateRanges[0]?.label ?? "";
  const productPrice = extractStarcampProductPrice(rawText, input.sourceUrl);
  const price = productPrice.price;
  const ageRange = parseAgeRange(rawText);
  const bookingUrl = input.sourceUrl;
  const holidayInfo = inferStarcampHoliday(input.sourceUrl, rawText, input.holidayType?.trim());
  const holidayFallback = holidayInfo.holiday;
  const originalCampName = titleLine || `${town || fallbackTown} ${holidayFallback || ""} Camp`.replace(/\s+/g, " ").trim();
  const campNameBase = cleanStarcampCampName(originalCampName, input.sourceUrl, holidayFallback);
  const rejectionBase = [campNameBase ? "" : "Missing camp_name", bookingUrl ? "" : "Missing booking_url", price ? "" : "Missing price", productPrice.price && price !== productPrice.price ? `Matched product price ${productPrice.price} differs from final price ${price}` : "", productPrice.rejectionReason && !price ? productPrice.rejectionReason : "", town || county ? "" : "Missing town or county"].filter(Boolean);
  if (rejectionBase.length || dateRanges.length === 0) return [];
  return dateRanges.map((dateRange) => {
    const holidayType = holidayFallback;
    const fieldConfidence = { camp_name: 95, county: county ? 85 : 0, town: town ? 85 : 0, address: address ? 80 : 0, eircode: validEircode(rawText) ? 100 : 0, activity_type: 90, holiday_type: 95, age: ageRange.ageMin ? 80 : 0, start_date: 100, price: 100, booking_url: 100 };
    const confidence = confidenceScore(fieldConfidence, { camp_name: 3, holiday_type: 2, age: 1, start_date: 3, price: 2, booking_url: 2, activity_type: 1 });
    return { camp_id: slugify(`${providerId}-${address || town}-${holidayType}-${dateRange.startDate}`), provider_id: providerId, camp_name: campNameBase.slice(0, 140), county, town, address, eircode: validEircode(rawText), activity_type: input.activityType?.trim() || "Performing Arts", holiday_type: holidayType, age_min: ageRange.ageMin, age_max: ageRange.ageMax, start_date: dateRange.startDate, end_date: dateRange.endDate, start_time: "", end_time: "", half_day_or_full_day: "Unknown", price, booking_url: bookingUrl, status: "draft", verified: false, featured: false, source_url: input.sourceUrl, last_checked: today(), selected: true, needs_review: true, duplicateWarnings: [], confidence, fieldConfidence, extractionWarnings: [], source_method: sourceMethod } satisfies DiscoveryCamp;
  });
}
function buildStarcampDebugCandidates(rawText: string, input: DiscoveryInput, sourceMethod: SourceMethod) {
  const fallbackTown = starcampTownFromUrl(input.sourceUrl);
  const location = extractStarcampLocation(rawText, fallbackTown);
  const productPrice = extractStarcampProductPrice(rawText, input.sourceUrl);
  const price = productPrice.price;
  const holidayInfo = inferStarcampHoliday(input.sourceUrl, rawText, input.holidayType?.trim());
  const originalCampName = location.titleLine || `${location.town || fallbackTown} ${holidayInfo.holiday} Camp`.replace(/\s+/g, " ").trim();
  const cleanedCampName = cleanStarcampCampName(originalCampName, input.sourceUrl, holidayInfo.holiday);
  const ageRange = parseAgeRange(rawText);
  const dateRanges = extractStarcampDateRanges(rawText);
  const selectedDefaultDateOption = dateRanges[0]?.label ?? "";
  const listingRejected = isStarcampListingSourceUrl(input.sourceUrl) || !isStarcampProductSourceUrl(input.sourceUrl);
  return (dateRanges.length ? dateRanges : [{ label: "", startDate: "", endDate: "", priority: 0, source: "readable_text" as const }]).map((dateRange) => {
    const failures = [listingRejected ? "Starcamp listing/index pages are discovery-only; camps must come from /product/*-camp/ pages" : "", location.titleLine || location.town ? "" : "Missing camp_name", input.sourceUrl ? "" : "Missing booking_url", price ? "" : "Missing price", dateRange.startDate ? "" : "Missing start_date", dateRange.endDate ? "" : "Missing end_date", location.town || location.county ? "" : "Missing town or county"].filter(Boolean);
    return { extractedText: `${location.titleLine || location.address} ${dateRange.label}`.trim(), parsedFields: { provider: "Starcamp", title: cleanedCampName, original_camp_name: originalCampName, cleaned_camp_name: cleanedCampName, holiday_type_source: holidayInfo.source, all_date_options_found: dateRanges.map((range) => range.label).join(", "), selected_default_date_option: selectedDefaultDateOption, camp_records_created_from_product: dateRanges.length, date_option_source: dateRange.source, date_options_rejected: "", matched_date: dateRange.label, start_date: dateRange.startDate, end_date: dateRange.endDate, price, matched_product_price: productPrice.price, price_source: productPrice.source, scoped_price_candidates: productPrice.scopedCandidates.join(", "), fallback_price_candidates: productPrice.fallbackCandidates.join(", "), raw_price_text_examples: productPrice.rawPriceTextExamples.join(", "), normalized_price_candidates: productPrice.normalizedPriceCandidates.join(", "), ignored_noise_price_matches: productPrice.ignored.join(", "), final_price_used: price, price_rejection_reason: productPrice.rejectionReason, matched_age: ageRange.label, age_min: ageRange.ageMin, age_max: ageRange.ageMax, location: location.address, town: location.town, county: location.county, booking_url: input.sourceUrl, source_method: sourceMethod, rejected_reason: failures.join(", ") }, confidence: failures.length ? 0 : 95, validationFailures: failures } satisfies ExtractionDebugCandidate;
  });
}

function allMatches(text: string, regex: RegExp) { return Array.from(text.matchAll(regex)).map((match) => match[0]); }
function uniqueDebugMatches(matches: ExtractionDebugMatch[]) { const seen = new Set<string>(); return matches.filter((match) => { const key = `${match.type}:${match.value}`; if (!match.value || seen.has(key)) return false; seen.add(key); return true; }); }
function buildBricksDebugCandidates(rawText: string, input: DiscoveryInput, providerName: string, fallbackCounty: string, sourceMethod: SourceMethod) {
  const lines = rawText.replace(/\r/g, "\n").split(/\n+/).map((line) => line.trim().replace(/\s{2,}/g, " ")).filter(Boolean);
  const rows: ExtractionDebugCandidate[] = [];
  for (const row of bricksScheduleRows(lines)) {
    const index = row.index;
    const dateRange = row.dateRange;
    const context = row.text;
    const candidateSlice = row.text;
    const timeRange = parseTimeRange(context);
    const ageRange = nearestAgeRange(lines, index);
    const locationText = extractLocationText(context, dateRange);
    const town = inferTown(`${locationText} ${context}`);
    const title = findCampTitle(lines, index, providerName, town);
    const county = inferCounty(`${locationText} ${input.sourceUrl} ${input.county ?? ""} ${input.notes ?? ""}`, fallbackCounty);
    const notCamp = !isCampOffering(`${title} ${context}`);
    const price = nearestPrice(lines, index);
    const fieldConfidence = { camp_name: 90, county: county ? 85 : 0, town: town ? 82 : 0, address: locationText ? 60 : 0, eircode: 0, activity_type: 95, holiday_type: 88, age: ageRange.ageMin ? 95 : 0, start_date: dateRange.startDate ? 95 : 0, price: price ? 100 : 0, booking_url: input.sourceUrl ? 80 : 0 };
    rows.push({ extractedText: candidateSlice, parsedFields: { title, holiday_type: inferHolidayFromDate(dateRange.startDate, input.holidayType?.trim()), day_type: inferDayType(timeRange.startTime, timeRange.endTime), start_date: dateRange.startDate, end_date: dateRange.endDate, matched_time: timeRange.label, start_time: timeRange.startTime, end_time: timeRange.endTime, price, matched_age: ageRange.label, age_min: ageRange.ageMin, age_max: ageRange.ageMax, location: locationText, town, county, source_method: sourceMethod, rejected_reason: [notCamp ? "Not a camp" : "", dateRange.startDate ? "" : "Missing date", locationText ? "" : "Missing location", ageRange.ageMin ? "" : "Missing age", timeRange.startTime ? "" : "Missing time"].filter(Boolean).join(", ") }, confidence: confidenceScore(fieldConfidence, { camp_name: 3, holiday_type: 2, age: 2, start_date: 2, price: 1, booking_url: 1, activity_type: 1 }), validationFailures: [notCamp ? "Not a camp" : "", dateRange.startDate ? "" : "Missing date", locationText ? "" : "Missing location", ageRange.ageMin ? "" : "Missing age", timeRange.startTime ? "" : "Missing time"].filter(Boolean) });
  }
  return rows;
}

export function buildExtractionDebug(input: DiscoveryInput, rawText: string, sourceMethod: SourceMethod = "crawler"): ExtractionPipelineDebug {
  const text = rawText.replace(/\s+/g, " ").trim();
  const providerName = input.providerName?.trim() || inferProviderName(input.sourceUrl, rawText);
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
  const isStarcamp = isStarcampSource(input, rawText, providerName);
  const bricksRows = isBricks ? buildBricksDebugCandidates(rawText, input, providerName, county, sourceMethod) : [];
  const starcampRows = isStarcamp ? buildStarcampDebugCandidates(rawText, input, sourceMethod) : [];
  const records = extractDiscoveryRecords(input, rawText, sourceMethod);
  const candidateRows = isStarcamp && starcampRows.length ? starcampRows : isBricks && bricksRows.length ? bricksRows : genericRows;
  const regexMatches = uniqueDebugMatches([...(providerName ? [{ type: "Provider" as const, value: providerName }] : []), ...allMatches(rawText, /\b(?:\d{1,2})(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(?:-|–|to)\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+20\d{2})?|\b\d{1,2}(?:st|nd|rd|th)?\s*(?:-|–|to)\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+20\d{2})?|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*20\d{2})?\s*(?:-|–|to)\s*(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?\d{1,2}(?:st|nd|rd|th)?(?:,\s*20\d{2})?/gi).map((value) => ({ type: "Date" as const, value })), ...allMatches(rawText, /\b\d{1,2}:\d{2}\s*(?:am|pm)?\s*(?:-|–|to)\s*\d{1,2}:\d{2}\s*(?:am|pm)?\b|\b\d{1,2}\s*(?:am|pm)?\s*(?:-|–|to)\s*\d{1,2}\s*(?:am|pm)\b/gi).map((value) => ({ type: "Time" as const, value })), ...allMatches(rawText, /\b(?:suitable\s+for\s+)?ages?\s*:?\s*\d{1,2}\s*(?:-|–|to)\s*\d{1,2}(?:\s*(?:years?|yrs?))?\b|\b\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)\b/gi).map((value) => ({ type: "Age" as const, value })), ...allMatches(rawText, /€\s?\d+(?:\.\d{2})?/g).map((value) => ({ type: "Price" as const, value })), ...southDublinTowns.filter((town) => rawText.toLowerCase().includes(town.toLowerCase())).map((value) => ({ type: "Town" as const, value })), ...candidateRows.map((row) => String(row.parsedFields.location ?? "")).filter(Boolean).map((value) => ({ type: "Location" as const, value }))]);
  const count = (type: ExtractionDebugMatch["type"]) => regexMatches.filter((match) => match.type === type).length;
  return { sourceUrl: input.sourceUrl, sourceMethod, rawTextPreview: rawText.slice(0, 5000), stages: [{ label: "Provider detected", count: providerName ? 1 : 0, passed: Boolean(providerName) }, { label: "Product page text length", count: isStarcamp && isStarcampProductSourceUrl(input.sourceUrl) ? rawText.length : 0, passed: !isStarcamp || isStarcampProductSourceUrl(input.sourceUrl) }, { label: "Dates detected", count: count("Date"), passed: count("Date") > 0 }, { label: "Time ranges detected", count: count("Time"), passed: count("Time") > 0 }, { label: "Age ranges detected", count: count("Age"), passed: count("Age") > 0 }, { label: "Locations detected", count: count("Location"), passed: count("Location") > 0 }, { label: "Candidate rows created", count: candidateRows.length, passed: candidateRows.length > 0 }, { label: "Multiple schedules detected", count: candidateRows.length > 1 ? candidateRows.length : 0, passed: candidateRows.length > 1 }, { label: "Camps created", count: records.camps.length, passed: records.camps.length > 0 }], regexMatches, candidateRows, validationFailures: [...candidateRows.flatMap((row) => row.validationFailures), ...Array.from({ length: Math.max(0, candidateRows.filter((row) => row.validationFailures.length === 0).length - records.camps.length) }, () => "Duplicate")], finalCampObjects: records.camps };
}


export function slugify(value: string) { return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72); }
function today() { return new Date().toISOString().slice(0, 10); }
function firstMatch(text: string, regex: RegExp) { return text.match(regex)?.[0] ?? ""; }
function firstUrl(text: string, regex: RegExp) { return text.match(regex)?.[0] ?? ""; }
function findKnown(text: string, values: readonly string[]) { const lower = text.toLowerCase(); return values.find((value) => lower.includes(value.toLowerCase())) ?? ""; }
function titleFromUrl(sourceUrl: string) { try { const url = new URL(sourceUrl); return url.hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); } catch { return ""; } }
function inferProviderName(sourceUrl: string, text: string) { return /starcamp\.ie|\bstarcamp\b/i.test(`${sourceUrl} ${text}`) ? "Starcamp" : /bricks\s*4\s*kidz|bricks4kidz|profile\.php|selected_schedule|ie1/i.test(`${sourceUrl} ${text}`) ? "Bricks4Kidz" : titleFromUrl(sourceUrl); }
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
    const hasCampName = /\b(camp|academy|course|club)\b/i.test(line) && isCampOffering(`${line} ${context}`);
    const hasStrongContext = campSignal.test(context);
    if (hasCampName && hasStrongContext) candidates.set(line, context);
  }
  return Array.from(candidates.entries()).slice(0, 8).map(([name, context]) => ({ name, context }));
}

export function extractDiscoveryRecords(input: DiscoveryInput, rawText: string, sourceMethod: SourceMethod = "crawler") {
  const text = rawText.replace(/\s+/g, " ").trim();
  const providerName = input.providerName?.trim() || inferProviderName(input.sourceUrl, rawText);
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
  const starcampSource = isStarcampSource(input, rawText, providerName);
  const starcampCamps = starcampSource ? extractStarcampCamps(rawText, input, sourceMethod) : [];
  const bricksCamps = /bricks\s*4\s*kidz|profile\.php|selected_schedule|south county dublin/i.test(`${rawText} ${input.sourceUrl} ${providerName}`) ? extractBricksBookingCamps(rawText, input, providerName, providerId, county, sourceMethod) : [];
  const camps = dedupeDiscoveryCamps(starcampSource ? starcampCamps : bricksCamps.length ? bricksCamps : genericCamps);
  const manualEmptyWarning = sourceMethod === "manual_paste" && rawText.trim() && camps.length === 0 ? "Manual text was added, but no camps could be extracted. Check extraction patterns or paste a more complete section." : "";
  const warnings = [providerName ? "" : "Provider name could not be determined.", starcampSource && !isStarcampProductSourceUrl(input.sourceUrl) ? "Starcamp listing/index page skipped for camp extraction; product pages are required." : "", manualEmptyWarning || (camps.length ? "" : "No high-confidence camp offerings found; generic navigation items were ignored."), camps.length && camps.every((camp) => !camp.price) ? "No prices detected" : "", camps.some((camp) => !camp.start_date) ? `${camps.filter((camp) => !camp.start_date).length} camp(s) missing dates` : "", camps.some((camp) => !camp.booking_url) ? "Booking links not detected for all camps" : ""].filter(Boolean);
  return { providers: provider.provider_id || provider.provider_name ? [provider] : [], camps, warnings, textLength: text.length };
}

export function dedupeDiscoveryCamps(camps: DiscoveryCamp[]) {
  const seen = new Set<string>();
  return camps.filter((camp) => {
    const keys = [
      camp.camp_id ? `id:${camp.camp_id}` : "",
      camp.provider_id && camp.address && camp.town && camp.start_date ? `provider-venue:${camp.provider_id}:${camp.address.toLowerCase()}:${camp.town.toLowerCase()}:${camp.start_date}:${camp.holiday_type}` : "",
      camp.provider_id && camp.camp_name && camp.town && camp.start_date ? `provider:${camp.provider_id}:${camp.camp_name.toLowerCase()}:${camp.town.toLowerCase()}:${camp.start_date}` : "",
      camp.source_url && camp.camp_name ? `source:${camp.source_url}:${camp.camp_name.toLowerCase()}:${camp.town.toLowerCase()}:${camp.start_date}` : "",
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
