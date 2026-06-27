import assert from "node:assert/strict";
import test from "node:test";
import {
  bulkUpdateCampStatus,
  getAdminStatusOptions,
  selectAllVisibleCampIds,
} from "./adminCampUtils";
import type { Camp } from "./types";

function camp(camp_id: string, status: Camp["status"] = "draft"): Camp {
  return {
    camp_id,
    provider_id: "provider",
    camp_name: `${camp_id} Camp`,
    county: "Wicklow",
    town: "Bray",
    address: "",
    eircode: "",
    activity_type: "Multi-activity",
    holiday_type: "Summer",
    age_min: 5,
    age_max: 12,
    start_date: "2026-07-01",
    end_date: "2026-07-05",
    start_time: "09:00",
    end_time: "15:00",
    half_day_or_full_day: "Full day",
    price: "€100",
    booking_url: "",
    status,
    verified: false,
    featured: false,
    source_url: "",
    last_checked: "2026-06-27",
  };
}

test("admin status options include standard statuses and legacy statuses found in data", () => {
  assert.deepEqual(
    getAdminStatusOptions([camp("a", "approved"), camp("b", "needs_review")]),
    ["draft", "approved", "hidden", "archived", "needs_review"],
  );
});

test("select-all-visible only selects filtered visible rows", () => {
  assert.deepEqual(
    selectAllVisibleCampIds(
      ["outside"],
      [camp("visible-1"), camp("visible-2")],
      true,
    ).sort(),
    ["outside", "visible-1", "visible-2"],
  );
});

test("selected rows can be bulk updated to approved hidden draft and archived", () => {
  const camps = [camp("one"), camp("two"), camp("three")];
  assert.equal(
    bulkUpdateCampStatus(camps, ["one", "three"], "approved")[0].status,
    "approved",
  );
  assert.equal(
    bulkUpdateCampStatus(camps, ["one"], "hidden")[0].status,
    "hidden",
  );
  assert.equal(
    bulkUpdateCampStatus(camps, ["one"], "draft")[0].status,
    "draft",
  );
  assert.equal(
    bulkUpdateCampStatus(camps, ["one"], "archived")[0].status,
    "archived",
  );
  assert.equal(
    bulkUpdateCampStatus(camps, ["one"], "approved")[1].status,
    "draft",
  );
});

test("selection clears after successful bulk action", () => {
  const updated = bulkUpdateCampStatus([camp("one")], ["one"], "approved");
  const nextSelection: string[] = [];
  assert.equal(updated[0].status, "approved");
  assert.deepEqual(nextSelection, []);
});
