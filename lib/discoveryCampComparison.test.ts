import assert from "node:assert/strict";
import test from "node:test";
import { campHasImportChanges, compareExistingCamp, findExistingCampMatch, normalizeUrlForDuplicate } from "./discoveryCampComparison";
import { mergeCampForUpdate, splitCampsByExisting } from "./dataRepository";
import type { Camp } from "./types";

function camp(overrides: Partial<Camp> = {}): Camp {
  return {
    camp_id: "techkidz-blackrock-2026-07-27",
    provider_id: "techkidz",
    camp_name: "Blackrock - Summer Camp",
    county: "Dublin",
    town: "Blackrock",
    address: "Blackrock College",
    eircode: "",
    activity_type: "STEM",
    holiday_type: "Summer",
    age_min: 7,
    age_max: 12,
    start_date: "2026-07-27",
    end_date: "2026-07-31",
    start_time: "09:00",
    end_time: "14:00",
    half_day_or_full_day: "Full day",
    price: "€165",
    booking_url: "https://techkidz.ie/book/blackrock/?utm_source=newsletter",
    status: "approved",
    verified: true,
    featured: true,
    source_url: "https://techkidz.ie/camps/blackrock/",
    last_checked: "2026-07-01",
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

test("AI row with same provider_id, camp_name, and start_date is detected as duplicate", () => {
  const existing = camp();
  const extracted = camp({ camp_id: "draft-row", camp_name: "Blackrock Summer Camp", booking_url: "" });
  assert.equal(findExistingCampMatch(extracted, [existing])?.camp_id, existing.camp_id);
});

test("AI row with same normalized booking_url and start_date is detected as duplicate", () => {
  const existing = camp();
  const extracted = camp({ camp_id: "draft-row", provider_id: "other", camp_name: "Other", booking_url: "https://techkidz.ie/book/blackrock/" });
  assert.equal(findExistingCampMatch(extracted, [existing])?.camp_id, existing.camp_id);
});

test("AI row with same provider, town, date, and similar camp name is detected as duplicate", () => {
  const existing = camp();
  const extracted = camp({ camp_id: "draft-row", camp_name: "TechKidz Blackrock STEM Camp" });
  assert.equal(findExistingCampMatch(extracted, [existing])?.camp_id, existing.camp_id);
});

test("duplicate with no differences is skipped on import", () => {
  const existing = camp();
  const extracted = camp({ camp_id: "draft-row", booking_url: "https://techkidz.ie/book/blackrock/" });
  const split = splitCampsByExisting([extracted], [existing]);
  assert.equal(split.insertRows.length, 0);
  assert.equal(split.updateRows.length, 0);
  assert.equal(split.unchangedRows.length, 1);
});

test("duplicate with differences can be selected for update and reports changed fields", () => {
  const existing = camp();
  const extracted = camp({ camp_id: "draft-row", price: "€175", booking_url: "https://techkidz.ie/book/blackrock-2026" });
  const split = splitCampsByExisting([extracted], [existing]);
  assert.equal(split.updateRows.length, 1);
  assert.deepEqual(compareExistingCamp(existing, extracted).map((item) => item.field), ["price", "booking url"]);
});

test("updating existing duplicate preserves status, verified, and featured", () => {
  const existing = camp({ status: "approved", verified: true, featured: true });
  const extracted = camp({ status: "draft", verified: false, featured: false, price: "€175" });
  const merged = mergeCampForUpdate(existing, extracted);
  assert.equal(merged.status, "approved");
  assert.equal(merged.verified, true);
  assert.equal(merged.featured, true);
});

test("new AI row still imports as draft, unverified, and unfeatured", () => {
  const extracted = camp({ camp_id: "new-ai-row", status: "draft", verified: false, featured: false });
  const split = splitCampsByExisting([extracted], []);
  assert.equal(split.insertRows[0].status, "draft");
  assert.equal(split.insertRows[0].verified, false);
  assert.equal(split.insertRows[0].featured, false);
});

test("URL normalization removes tracking parameters and trailing slash", () => {
  assert.equal(normalizeUrlForDuplicate("https://example.com/book/?utm_source=x&slot=1#top"), "https://example.com/book?slot=1");
});

test("TechKidz-style duplicate is detected as existing instead of new", () => {
  const existing = camp();
  const extracted = camp({ camp_id: "techkidz-blackrock-ai", camp_name: "Blackrock Summer Camp", town: "Blackrock", start_date: "2026-07-27" });
  assert.equal(findExistingCampMatch(extracted, [existing])?.camp_id, "techkidz-blackrock-2026-07-27");
  assert.equal(campHasImportChanges(existing, extracted), false);
});

test("updating price on an existing camp does not overwrite curated camp_name", () => {
  const existing = camp({ camp_id: "techkidz-malahide", camp_name: "Malahide - Summer Camp", town: "Malahide", price: "€165" });
  const extracted = camp({ camp_id: "draft-malahide", camp_name: "MALAHIDE - SUMMER CAMP", town: "Malahide", price: "€175" });
  const split = splitCampsByExisting([extracted], [existing]);
  assert.equal(split.updateRows.length, 1);
  assert.equal(split.updateRows[0].camp_name, "Malahide - Summer Camp");
  assert.equal(split.updateRows[0].price, "€175");
});

test("casing-only camp_name differences are ignored as meaningful differences", () => {
  const existing = camp({ camp_name: "Malahide - Summer Camp", price: "€165" });
  const extracted = camp({ camp_name: "MALAHIDE - SUMMER CAMP", price: "€165" });
  assert.equal(campHasImportChanges(existing, extracted), false);
  assert.equal(compareExistingCamp(existing, extracted).some((item) => item.field === "camp name"), false);
});

test("existing blank camp_name can be filled from AI row", () => {
  const existing = camp({ camp_name: "" });
  const extracted = camp({ camp_name: "Blackrock - Summer Camp" });
  const merged = mergeCampForUpdate(existing, extracted);
  assert.equal(campHasImportChanges(existing, extracted), true);
  assert.equal(merged.camp_name, "Blackrock - Summer Camp");
});

test("operational fields update while descriptive fields are preserved", () => {
  const existing = camp({ town: "Blackrock", county: "Dublin", address: "Curated address", activity_type: "STEM", price: "€165", booking_url: "https://techkidz.ie/book/blackrock/" });
  const extracted = camp({ town: "BLACKROCK", county: "DUBLIN", address: "AI address", activity_type: "Technology", price: "€180", booking_url: "https://techkidz.ie/book/blackrock-2026/", source_url: "https://techkidz.ie/new-source", last_checked: "2026-07-11" });
  const merged = mergeCampForUpdate(existing, extracted);
  assert.equal(merged.town, "Blackrock");
  assert.equal(merged.county, "Dublin");
  assert.equal(merged.address, "Curated address");
  assert.equal(merged.activity_type, "STEM");
  assert.equal(merged.price, "€180");
  assert.equal(merged.booking_url, "https://techkidz.ie/book/blackrock-2026/");
  assert.equal(merged.source_url, "https://techkidz.ie/new-source");
  assert.equal(merged.last_checked, "2026-07-11");
});

test("status, verified, featured, and created_at remain preserved on curated-field-safe updates", () => {
  const existing = camp({ status: "approved", verified: true, featured: true, created_at: "2026-01-01T00:00:00Z" });
  const extracted = camp({ status: "draft", verified: false, featured: false, created_at: "2026-07-11T00:00:00Z", price: "€190" });
  const merged = mergeCampForUpdate(existing, extracted);
  assert.equal(merged.status, "approved");
  assert.equal(merged.verified, true);
  assert.equal(merged.featured, true);
  assert.equal(merged.created_at, "2026-01-01T00:00:00Z");
});
