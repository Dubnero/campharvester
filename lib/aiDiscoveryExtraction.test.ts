import assert from "node:assert/strict";
import test from "node:test";
import { mapAiExtraction, missingOpenAIKeyMessage, normalizeAiDate, parseOpenAIJson } from "./aiDiscoveryExtraction";

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
