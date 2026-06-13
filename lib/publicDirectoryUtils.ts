import type { Camp, Provider } from "./types";
import { providersById } from "./campUtils";

export type PublicCamp = Camp & {
  provider?: Provider;
  publicSlug: string;
};

export type PublicFilters = {
  search: string;
  county: string;
  town: string;
  activity: string;
  holiday: string;
  age: string;
};

export type PublicSort = "soonest" | "price-asc" | "price-desc" | "age-youngest" | "age-oldest";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function campPublicSlug(camp: Camp) {
  const base = slugify(`${camp.camp_name} ${camp.town}`) || slugify(camp.camp_name) || "camp";
  return `${base}-${camp.id}`;
}

export function buildPublicCamps(camps: Camp[], providers: Provider[]): PublicCamp[] {
  const providerLookup = providersById(providers);
  return camps.map((camp) => ({ ...camp, provider: providerLookup[camp.provider_id], publicSlug: campPublicSlug(camp) }));
}

export function findPublicCamp(camps: PublicCamp[], campIdOrSlug: string) {
  return camps.find((camp) => camp.id === campIdOrSlug || camp.publicSlug === campIdOrSlug);
}

export function getUniquePublicValues(camps: PublicCamp[], key: keyof Pick<Camp, "county" | "town" | "activity_type" | "holiday_type">) {
  return Array.from(new Set(camps.map((camp) => String(camp[key]).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function filterPublicCamps(camps: PublicCamp[], filters: PublicFilters) {
  const search = filters.search.trim().toLowerCase();
  const requestedAge = filters.age === "16+" ? 16 : Number(filters.age);

  return camps.filter((camp) => {
    const matchesSearch = search
      ? [camp.camp_name, camp.provider?.provider_name ?? "", camp.town, camp.county].some((value) =>
          value.toLowerCase().includes(search),
        )
      : true;
    const matchesAge = filters.age ? Number.isFinite(requestedAge) && camp.age_min <= requestedAge && camp.age_max >= requestedAge : true;

    return (
      matchesSearch &&
      (!filters.county || camp.county === filters.county) &&
      (!filters.town || camp.town === filters.town) &&
      (!filters.activity || camp.activity_type === filters.activity) &&
      (!filters.holiday || camp.holiday_type === filters.holiday) &&
      matchesAge
    );
  });
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function priceValue(value: string) {
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

export function sortPublicCamps(camps: PublicCamp[], sort: PublicSort) {
  return [...camps].sort((a, b) => {
    if (sort === "price-asc") return priceValue(a.price) - priceValue(b.price) || a.camp_name.localeCompare(b.camp_name);
    if (sort === "price-desc") return priceValue(b.price) - priceValue(a.price) || a.camp_name.localeCompare(b.camp_name);
    if (sort === "age-youngest") return a.age_min - b.age_min || a.age_max - b.age_max || a.camp_name.localeCompare(b.camp_name);
    if (sort === "age-oldest") return b.age_max - a.age_max || b.age_min - a.age_min || a.camp_name.localeCompare(b.camp_name);
    return dateValue(a.start_date) - dateValue(b.start_date) || a.camp_name.localeCompare(b.camp_name);
  });
}

export function formatDateRange(startDate: string, endDate: string) {
  if (!startDate && !endDate) return "Dates to be confirmed";
  if (!startDate) return `Until ${endDate}`;
  if (!endDate || startDate === endDate) return startDate;
  return `${startDate} to ${endDate}`;
}

export function formatAgeRange(min: number, max: number) {
  if (min === max) return `${min} years`;
  return `${min}–${max} years`;
}

export function formatTimeRange(startTime: string, endTime: string) {
  if (!startTime && !endTime) return "Times to be confirmed";
  if (!startTime) return `Until ${endTime}`;
  if (!endTime) return `From ${startTime}`;
  return `${startTime}–${endTime}`;
}
