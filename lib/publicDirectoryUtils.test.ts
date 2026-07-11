import assert from "node:assert/strict";
import test from "node:test";
import {
  getPublicTownOptions,
  townForCountyOrBlank,
  type PublicCamp,
} from "./publicDirectoryUtils";

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
  assert.deepEqual(getPublicTownOptions(camps), [
    "Bray",
    "Greystones",
    "Naas",
    "Rathgar",
    "Swords",
  ]);
});

test("town options only include Wicklow towns when Wicklow is selected", () => {
  assert.deepEqual(getPublicTownOptions(camps, "Wicklow"), [
    "Bray",
    "Greystones",
  ]);
});

test("town options only include Dublin towns when Dublin is selected", () => {
  assert.deepEqual(getPublicTownOptions(camps, "Dublin"), [
    "Rathgar",
    "Swords",
  ]);
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

import {
  buildPublicCamps,
  filterPublicCamps,
  isPastPublicCamp,
  isUpcomingPublicCamp,
} from "./publicDirectoryUtils";
import type { Camp, Provider } from "./types";

const provider: Provider = {
  provider_id: "provider",
  provider_name: "Provider",
  website: "https://example.com",
  primary_email: "hello@example.com",
  primary_phone: "123",
  description: "Provider",
  verified: false,
  featured: false,
};

function rawCamp(id: string, status: string): Camp {
  return {
    ...camp("Bray", "Wicklow"),
    camp_id: id,
    status: status as Camp["status"],
  };
}

test("existing public status visibility behaviour is preserved", () => {
  const statuses = [
    "approved",
    "draft",
    "needs_review",
    "hidden",
    "archived",
    "deleted",
    "inactive",
    "rejected",
    "disabled",
    "cancelled",
    "canceled",
    "",
    "unknown",
  ];
  const publicCamps = buildPublicCamps(
    statuses.map((status, index) => rawCamp(`camp-${index}`, status)),
    [provider],
    { today: "2026-07-01" },
  );
  assert.deepEqual(
    publicCamps.map((publicCamp) => publicCamp.camp_id),
    statuses.map((_, index) => `camp-${index}`),
  );
});

test("public result count is not status-gated by date filtering changes", () => {
  const publicCamps = buildPublicCamps(
    [
      rawCamp("approved", "approved"),
      rawCamp("draft", "draft"),
      rawCamp("hidden", "hidden"),
    ],
    [provider],
    { today: "2026-07-01" },
  );
  const filtered = filterPublicCamps(publicCamps, {
    search: "",
    county: "",
    town: "",
    activity: "",
    holiday: "",
    age: "",
    startDate: "",
    endDate: "",
    dayLength: "",
    priceStatus: "",
    verifiedOnly: false,
    featuredOnly: false,
  });
  assert.equal(publicCamps.length, 3);
  assert.equal(filtered.length, 3);
});

test("camp with end_date yesterday is hidden from public list by default", () => {
  const publicCamps = buildPublicCamps(
    [
      {
        ...rawCamp("past-end", "approved"),
        start_date: "2026-07-01",
        end_date: "2026-07-10",
      },
    ],
    [provider],
    { today: "2026-07-11" },
  );
  assert.deepEqual(publicCamps.map((publicCamp) => publicCamp.camp_id), []);
});

test("camp with end_date today is shown in public list", () => {
  const publicCamps = buildPublicCamps(
    [
      {
        ...rawCamp("today-end", "approved"),
        start_date: "2026-07-01",
        end_date: "2026-07-11",
      },
    ],
    [provider],
    { today: "2026-07-11" },
  );
  assert.deepEqual(publicCamps.map((publicCamp) => publicCamp.camp_id), [
    "today-end",
  ]);
});

test("camp with future start and end dates is shown in public list", () => {
  const publicCamps = buildPublicCamps(
    [
      {
        ...rawCamp("future-range", "approved"),
        start_date: "2026-07-12",
        end_date: "2026-07-16",
      },
    ],
    [provider],
    { today: "2026-07-11" },
  );
  assert.deepEqual(publicCamps.map((publicCamp) => publicCamp.camp_id), [
    "future-range",
  ]);
});

test("camp with missing end_date but future start_date is shown in public list", () => {
  const publicCamps = buildPublicCamps(
    [
      {
        ...rawCamp("future-start", "approved"),
        start_date: "2026-07-12",
        end_date: "",
      },
    ],
    [provider],
    { today: "2026-07-11" },
  );
  assert.deepEqual(publicCamps.map((publicCamp) => publicCamp.camp_id), [
    "future-start",
  ]);
});

test("camp with missing end_date and past start_date is hidden from public list by default", () => {
  const publicCamps = buildPublicCamps(
    [
      {
        ...rawCamp("past-start", "approved"),
        start_date: "2026-07-10",
        end_date: "",
      },
    ],
    [provider],
    { today: "2026-07-11" },
  );
  assert.deepEqual(publicCamps.map((publicCamp) => publicCamp.camp_id), []);
});

test("public date comparison uses caller local date without time-zone parsing", () => {
  const currentCamp = { start_date: "2026-07-10", end_date: "2026-07-11" };
  assert.equal(
    isUpcomingPublicCamp(currentCamp, new Date(2026, 6, 11, 23, 30)),
    true,
  );
  assert.equal(
    isPastPublicCamp(currentCamp, new Date(2026, 6, 12, 0, 1)),
    true,
  );
});

test("past camps remain available to public builders when explicitly included", () => {
  const publicCamps = buildPublicCamps(
    [
      {
        ...rawCamp("past-visible-for-detail", "approved"),
        start_date: "2026-07-01",
        end_date: "2026-07-10",
      },
    ],
    [provider],
    { today: "2026-07-11", includePast: true },
  );
  assert.deepEqual(publicCamps.map((publicCamp) => publicCamp.camp_id), [
    "past-visible-for-detail",
  ]);
});

test("public directory empty state copy is neutral", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../components/PublicDirectory.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /No camps match your current filters\./);
  assert.doesNotMatch(source, /No approved camps are live yet/);
});
