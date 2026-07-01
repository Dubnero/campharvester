import { NextResponse } from "next/server";
import { mapAiExtraction, missingOpenAIKeyMessage, parseOpenAIJson, selectAiReadableText, type AiExtractionRequest } from "@/lib/aiDiscoveryExtraction";

export const runtime = "nodejs";

const model = "gpt-4.1-mini";

function prompt(request: AiExtractionRequest, readableText: string) {
  return `Extract Irish kids camp providers and camp rows from the page text. Return only JSON with providers[], camps[], warnings[], extraction_notes. Never invent data. Blank unknown values. Dates YYYY-MM-DD where possible; infer 2026 only if source is clearly about 2026. Create one camp row per venue/date range. status draft, verified false, featured false. source_url is ${request.source_url}.
Defaults: provider_id=${request.default_provider_id || ""}; provider_name=${request.default_provider_name || ""}; county=${request.default_county || ""}; activity_type=${request.default_activity_type || ""}; holiday_type=${request.holiday_type || ""}.
Provider fields: provider_id, provider_name, website, source_url, primary_email, primary_phone, primary_county, activity_category, provider_type, status, verified, featured, last_checked, notes.
Camp fields: camp_id, provider_id, camp_name, county, town, address, eircode, activity_type, holiday_type, age_min, age_max, start_date, end_date, start_time, end_time, half_day_or_full_day, price, booking_url, status, verified, featured, source_url, last_checked.
PAGE TEXT:\n${readableText}`;
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: missingOpenAIKeyMessage }, { status: 503 });
  try {
    const body = await req.json() as AiExtractionRequest;
    if (!body.source_url || !body.readable_text?.trim()) return NextResponse.json({ error: "source_url and readable_text are required." }, { status: 400 });
    const selected = selectAiReadableText(body.readable_text, body.source_url);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, temperature: 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: "You extract structured camp data for an admin review workflow." }, { role: "user", content: prompt(body, selected.text) }] }),
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 429 ? "AI extraction failed because the OpenAI API returned 429. This can mean quota/credits, rate limit, or too much text. Check OpenAI billing/credits and try a smaller extraction." : `AI extraction failed (${response.status}).` }, { status: 502 });
    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content || "";
    const raw = parseOpenAIJson(content);
    const mapped = mapAiExtraction(raw, body, selected.text);
    return NextResponse.json({ ...mapped, warnings: selected.wasTrimmed ? [...mapped.warnings, `AI input was trimmed from ${selected.originalLength} characters to ${selected.selectedLength} characters.`] : mapped.warnings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI extraction failed." }, { status: 500 });
  }
}
