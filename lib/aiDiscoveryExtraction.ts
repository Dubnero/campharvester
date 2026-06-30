import type { Camp, DayLength, HolidayType, Provider } from "./types";
import type { ConfidenceBreakdown, DiscoveryCamp, DiscoveryProvider } from "./discoveryUtils";

export const missingOpenAIKeyMessage = "AI extraction is not configured. Add OPENAI_API_KEY to the server environment.";
export const maxAiReadableTextLength = 24000;

type AiProviderInput = Partial<Provider>;
type AiCampInput = Partial<Camp>;
export type AiExtractionRequest = { source_url: string; readable_text: string; default_provider_id?: string; default_provider_name?: string; default_county?: string; default_activity_type?: string; holiday_type?: string };
export type AiExtractionResult = { providers: DiscoveryProvider[]; camps: DiscoveryCamp[]; warnings: string[]; extraction_notes: string };
export type RawAiExtraction = { providers?: AiProviderInput[]; camps?: AiCampInput[]; warnings?: string[]; extraction_notes?: string };

const holidayTypes: HolidayType[] = ["Summer", "Easter", "Halloween", "February Midterm", "October Midterm", "Christmas", "Other"];
const dayLengths: DayLength[] = ["Half day", "Full day", "Both", "Unknown"];

function today() { return new Date().toISOString().slice(0, 10); }
function text(value: unknown) { return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim(); }
function boolFalse() { return false; }
export function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96); }
function fieldConfidence(fields: string[], row: Record<string, unknown>): ConfidenceBreakdown { return Object.fromEntries(fields.map((field) => [field, text(row[field]) ? 90 : 0])); }
function normalizedHoliday(value: unknown): HolidayType { const found = holidayTypes.find((holiday) => holiday.toLowerCase() === text(value).toLowerCase()); return found ?? "Other"; }
function normalizedDayLength(value: unknown): DayLength { const found = dayLengths.find((day) => day.toLowerCase() === text(value).toLowerCase()); return found ?? "Unknown"; }
function numberOrBlank(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : ("" as unknown as number); }

export function normalizeAiDate(value: unknown, sourceText = "") {
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const has2026Context = /\b2026\b/.test(`${sourceText} ${raw}`);
  const months: Record<string, string> = { jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03", apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09", oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12" };
  const match = raw.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?\b/i) || raw.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i);
  if (match) {
    const day = /^\d/.test(match[1]) ? match[1] : match[2];
    const monthName = /^\d/.test(match[1]) ? match[2] : match[1];
    const year = match[3] || (has2026Context ? "2026" : "");
    const month = months[monthName.toLowerCase()];
    if (year && month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }
  return raw;
}

export function selectAiReadableText(readableText: string) {
  const cleanedLines = readableText.split(/\n+/).map((line) => line.trim()).filter((line) => line && !/^(home|about|contact|privacy|cookie|terms|facebook|instagram|menu|search)$/i.test(line));
  const campLike = cleanedLines.filter((line, index, lines) => /camp|summer|easter|midterm|halloween|age|date|week|€|book|venue|location|time/i.test(`${lines[index - 1] ?? ""} ${line} ${lines[index + 1] ?? ""}`));
  const candidate = (campLike.length > 20 ? campLike : cleanedLines).join("\n");
  const trimmed = candidate.length > maxAiReadableTextLength ? candidate.slice(0, maxAiReadableTextLength) : candidate;
  return { text: trimmed, wasTrimmed: readableText.length > trimmed.length };
}

export function mapAiExtraction(raw: RawAiExtraction, request: AiExtractionRequest, sourceText = request.readable_text): AiExtractionResult {
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(text).filter(Boolean) : [];
  const providers = (Array.isArray(raw.providers) ? raw.providers : []).map((provider, index): DiscoveryProvider => {
    const providerName = text(provider.provider_name) || text(request.default_provider_name);
    const providerId = text(provider.provider_id) || text(request.default_provider_id) || slugify(providerName || `ai-provider-${index + 1}`);
    return { provider_id: providerId, provider_name: providerName, website: text(provider.website), source_url: request.source_url, primary_email: text(provider.primary_email), primary_phone: text(provider.primary_phone), description: "", primary_county: text(provider.primary_county) || text(request.default_county), activity_category: text(provider.activity_category) || text(request.default_activity_type), provider_type: text(provider.provider_type), status: "draft", verified: boolFalse(), featured: boolFalse(), last_checked: today(), notes: text(provider.notes), selected: Boolean(providerName), needs_review: true, duplicateWarnings: [], confidence: 85, fieldConfidence: fieldConfidence(["provider_name", "website", "primary_email", "primary_phone", "primary_county", "activity_category"], provider as Record<string, unknown>), extractionWarnings: [], source_method: "ai" };
  });
  const fallbackProviderId = providers[0]?.provider_id || text(request.default_provider_id) || slugify(text(request.default_provider_name) || "ai-provider");
  const camps = (Array.isArray(raw.camps) ? raw.camps : []).map((camp, index): DiscoveryCamp => {
    const start = normalizeAiDate(camp.start_date, sourceText);
    const end = normalizeAiDate(camp.end_date, sourceText);
    const campName = text(camp.camp_name);
    const providerId = text(camp.provider_id) || fallbackProviderId;
    const row = { ...camp, start_date: start, end_date: end } as Record<string, unknown>;
    const extractionWarnings = [!campName ? "Missing camp name" : "", !start ? "Missing start date" : "", !text(camp.county || request.default_county) ? "Missing county" : ""].filter(Boolean);
    return { camp_id: text(camp.camp_id) || slugify(`${providerId}-${campName || "camp"}-${text(camp.town)}-${start || index + 1}`), provider_id: providerId, camp_name: campName, county: text(camp.county) || text(request.default_county), town: text(camp.town), address: text(camp.address), eircode: text(camp.eircode), activity_type: text(camp.activity_type) || text(request.default_activity_type), holiday_type: normalizedHoliday(camp.holiday_type || request.holiday_type), age_min: numberOrBlank(camp.age_min), age_max: numberOrBlank(camp.age_max), start_date: start, end_date: end, start_time: text(camp.start_time), end_time: text(camp.end_time), half_day_or_full_day: normalizedDayLength(camp.half_day_or_full_day), price: text(camp.price), booking_url: text(camp.booking_url) || request.source_url, status: "draft", verified: false, featured: false, source_url: request.source_url, last_checked: today(), selected: true, needs_review: true, duplicateWarnings: [], confidence: 85, fieldConfidence: fieldConfidence(["camp_name", "county", "town", "start_date", "end_date", "age_min", "age_max", "price", "booking_url", "activity_type"], row), extractionWarnings, source_method: "ai" };
  });
  return { providers, camps, warnings, extraction_notes: text(raw.extraction_notes) };
}

export function parseOpenAIJson(content: string): RawAiExtraction {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(stripped) as RawAiExtraction;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.providers) || !Array.isArray(parsed.camps)) throw new Error("AI response did not include providers[] and camps[].");
  return parsed;
}
