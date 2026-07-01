import assert from "node:assert/strict";
import test from "node:test";
import { mapAiExtraction, missingOpenAIKeyMessage, normalizeAiDate, parseOpenAIJson, selectAiReadableText } from "./aiDiscoveryExtraction";

const request = { source_url: "https://example.com/camps", readable_text: "Summer Camps 2026" };

test("missing OPENAI_API_KEY admin error text is clear", () => {
  assert.equal(missingOpenAIKeyMessage, "AI extraction is not configured. Add OPENAI_API_KEY to the server environment.");
});

test("valid AI JSON response maps to provider and camp review rows", () => {
  const mapped = mapAiExtraction({ providers: [{ provider_name: "TechKidz", website: "https://techkidz.ie" }], camps: [{ camp_name: "Robotics Camp", county: "Dublin", town: "Dublin", start_date: "2026-07-06", end_date: "2026-07-10", price: "€160" }], warnings: [], extraction_notes: "One week found" }, request);
  assert.equal(mapped.providers[0].provider_name, "TechKidz");
  assert.equal(mapped.camps[0].camp_name, "Robotics Camp");
  assert.equal(mapped.camps[0].source_method, "ai");
  assert.equal(mapped.extraction_notes, "One week found");
});

test("malformed AI response handling rejects missing arrays", () => {
  assert.throws(() => parseOpenAIJson('{"providers":[]}'), /providers\[\] and camps\[\]/);
});

test("2026 date normalisation infers year only when source is clearly 2026", () => {
  assert.equal(normalizeAiDate("6 July", "Summer Camps 2026"), "2026-07-06");
  assert.equal(normalizeAiDate("6 July", "Summer Camps"), "6 July");
});

test("one camp type with multiple date ranges becomes multiple mapped rows", () => {
  const mapped = mapAiExtraction({ providers: [{ provider_id: "designer-minds", provider_name: "Designer Minds" }], camps: [{ camp_name: "Creative Camp", start_date: "6 July", end_date: "10 July" }, { camp_name: "Creative Camp", start_date: "13 July", end_date: "17 July" }], warnings: [] }, request);
  assert.equal(mapped.camps.length, 2);
  assert.deepEqual(mapped.camps.map((camp) => camp.start_date), ["2026-07-06", "2026-07-13"]);
});

test("AI rows enforce draft unverified unfeatured defaults", () => {
  const mapped = mapAiExtraction({ providers: [{ provider_name: "Provider", status: "approved", verified: true, featured: true }], camps: [{ camp_name: "Camp", status: "approved", verified: true, featured: true }] }, request);
  assert.equal(mapped.providers[0].status, "draft");
  assert.equal(mapped.providers[0].verified, false);
  assert.equal(mapped.providers[0].featured, false);
  assert.equal(mapped.camps[0].status, "draft");
  assert.equal(mapped.camps[0].verified, false);
  assert.equal(mapped.camps[0].featured, false);
});

test("AI input preparation prefers source URL, deduplicates noisy blocks, and caps at 40000 characters", () => {
  const sourceUrl = "https://www.techkidz.ie/camps/dublin/";
  const repeatedCamp = "SUMMER CAMP Dublin\nSt Mary's School Dublin\nBook now\n8 July 2026\n€160\n9am - 2pm";
  const huge = `Source URL: https://www.techkidz.ie/camps/cork/\nSUMMER CAMP Cork\nBook now\n9 July 2026\n€160\n\nSource URL: ${sourceUrl}\n${repeatedCamp}\n${repeatedCamp}\nprivacy policy\nhttps://www.googletagmanager.com/gtm.js\n${"footer cookie text\n".repeat(5000)}${"SUMMER CAMP Dublin Book now €160 9am - 2pm\n".repeat(2000)}`;
  const selected = selectAiReadableText(huge, sourceUrl);

  assert.equal(selected.text.length <= 40000, true);
  assert.match(selected.text, new RegExp(`Source URL: ${sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.equal(selected.text.includes("googletagmanager"), false);
  assert.equal((selected.text.match(/St Mary's School Dublin/g) ?? []).length <= 2, true);
  assert.equal(selected.wasTrimmed, true);
});
