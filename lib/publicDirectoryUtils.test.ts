import assert from "node:assert/strict";
import test from "node:test";
import { getPublicTownOptions, townForCountyOrBlank, type PublicCamp } from "./publicDirectoryUtils";

function camp(town: string, county: string): PublicCamp {
  return {
    camp_id: `${county}-${town}`,
    provider_id: "provider",
    camp_name: `${town} Camp`,
    county,
    town,
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
    status: "approved",
    verified: false,
    featured: false,
    source_url: "",
    last_checked: "2026-06-27",
    publicSlug: `${county}-${town}`,
  };
}

const camps = [
  camp("Bray", "Wicklow"),
  camp("Greystones", "Wicklow"),
  camp("Swords", "Dublin"),
  camp("Rathgar", "Dublin"),
  camp("Naas", "Kildare"),
  camp("", "Wicklow"),
  camp("---", "Wicklow"),
  camp("A98 W9F2", "Wicklow"),
  camp("To be confirmed", "Dublin"),
];

test("town options include all valid towns when no county is selected", () => {
  assert.deepEqual(getPublicTownOptions(camps), ["Bray", "Greystones", "Naas", "Rathgar", "Swords"]);
});

test("town options only include Wicklow towns when Wicklow is selected", () => {
  assert.deepEqual(getPublicTownOptions(camps, "Wicklow"), ["Bray", "Greystones"]);
});

test("town options only include Dublin towns when Dublin is selected", () => {
  assert.deepEqual(getPublicTownOptions(camps, "Dublin"), ["Rathgar", "Swords"]);
});

test("invalid town values are excluded", () => {
  assert.equal(getPublicTownOptions(camps).includes(""), false);
  assert.equal(getPublicTownOptions(camps).includes("---"), false);
  assert.equal(getPublicTownOptions(camps).includes("A98 W9F2"), false);
  assert.equal(getPublicTownOptions(camps).includes("To be confirmed"), false);
});

test("selected town is cleared when it is invalid for the selected county", () => {
  assert.equal(townForCountyOrBlank(camps, "Wicklow", "Swords"), "");
  assert.equal(townForCountyOrBlank(camps, "Wicklow", "Bray"), "Bray");
});
