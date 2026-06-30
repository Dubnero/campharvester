import assert from "node:assert/strict";
import test from "node:test";
import { campHasImportChanges, mergeCampForUpdate, splitCampsByExisting } from "./dataRepository";
import type { Camp } from "./types";

function camp(overrides: Partial<Camp> = {}): Camp {
  return {
    camp_id: "camp-1",
    provider_id: "provider-1",
    camp_name: "Original Camp",
    county: "Dublin",
    town: "Rathgar",
    address: "Old address",
    eircode: "",
    activity_type: "Outdoor",
    holiday_type: "Summer",
    age_min: 5,
    age_max: 12,
    start_date: "2026-07-06",
    end_date: "2026-07-10",
    start_time: "09:00",
    end_time: "17:30",
    half_day_or_full_day: "Full day",
    price: "€100",
    booking_url: "https://example.com/old",
    status: "approved",
    verified: true,
    featured: true,
    source_url: "https://example.com/source-old",
    last_checked: "2026-06-20",
    created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

test("selected new camps are classified for insert", () => {
  const incoming = camp({ camp_id: "new-camp" });
  const result = splitCampsByExisting([incoming], []);

  assert.deepEqual(result.insertRows.map((row) => row.camp_id), ["new-camp"]);
  assert.deepEqual(result.updateRows, []);
});

test("selected existing camps are classified for update and not duplicated", () => {
  const incoming = camp({ camp_name: "Updated Camp" });
  const result = splitCampsByExisting([incoming], [camp()]);

  assert.deepEqual(result.insertRows, []);
  assert.deepEqual(result.updateRows.map((row) => row.camp_id), ["camp-1"]);
  assert.equal(result.updateRows[0].camp_name, "Updated Camp");
});

test("mixed selected rows insert new camps and update existing camps", () => {
  const result = splitCampsByExisting(
    [camp({ camp_id: "camp-1", price: "€150" }), camp({ camp_id: "camp-2" })],
    [camp({ camp_id: "camp-1", price: "€100" })],
  );

  assert.deepEqual(result.updateRows.map((row) => row.camp_id), ["camp-1"]);
  assert.deepEqual(result.insertRows.map((row) => row.camp_id), ["camp-2"]);
});

test("existing status is preserved on update while extracted times are applied", () => {
  const existing = camp({ status: "hidden", start_time: "09:00", end_time: "17:30" });
  const extracted = camp({ status: "draft", start_time: "10:00", end_time: "15:00" });
  const merged = mergeCampForUpdate(existing, extracted);

  assert.equal(merged.status, "hidden");
  assert.equal(merged.start_time, "10:00");
  assert.equal(merged.end_time, "15:00");
  assert.equal(merged.verified, true);
  assert.equal(merged.featured, true);
});

test("update result summary counts can report inserted versus updated rows", () => {
  const result = splitCampsByExisting(
    [camp({ camp_id: "camp-1", price: "€150" }), camp({ camp_id: "camp-2" }), camp({ camp_id: "camp-3" })],
    [camp({ camp_id: "camp-1", price: "€100" }), camp({ camp_id: "camp-2" })],
  );

  assert.equal(result.insertRows.length, 1);
  assert.equal(result.updateRows.length, 1);
  assert.equal(result.unchangedRows.length, 1);
});

test("unchanged existing camps are skipped rather than counted as updates", () => {
  const existing = camp({ status: "approved", last_checked: "2026-06-01" });
  const extracted = camp({ status: "draft", last_checked: "2026-06-30" });
  const result = splitCampsByExisting([extracted], [existing]);

  assert.equal(campHasImportChanges(existing, extracted), false);
  assert.equal(result.updateRows.length, 0);
  assert.equal(result.unchangedRows.length, 1);
});
