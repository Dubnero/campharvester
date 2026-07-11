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
