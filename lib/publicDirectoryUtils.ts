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
  startDate: string;
  endDate: string;
  dayLength: string;
  priceStatus: string;
  verifiedOnly: boolean;
  featuredOnly: boolean;
};

export type PublicSort = "start-date" | "price-asc" | "town-az" | "provider-az";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function campPublicSlug(camp: Camp) {
  const base = slugify(`${camp.camp_name} ${camp.town}`) || slugify(camp.camp_name) || "camp";
  return `${base}-${camp.camp_id}`;
}

export function buildPublicCamps(camps: Camp[], providers: Provider[]): PublicCamp[] {
  const providerLookup = providersById(providers);
  return camps
    .filter((camp) => camp.status === "approved")
    .map((camp) => ({ ...camp, provider: providerLookup[camp.provider_id], publicSlug: campPublicSlug(camp) }));
}

export function findPublicCamp(camps: PublicCamp[], campIdOrSlug: string) {
  return camps.find((camp) => camp.camp_id === campIdOrSlug || camp.publicSlug === campIdOrSlug);
}

export function getUniquePublicValues(camps: PublicCamp[], key: keyof Pick<Camp, "county" | "town" | "activity_type" | "holiday_type">) {
  return Array.from(new Set(camps.map((camp) => String(camp[key]).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function hasPrice(camp: PublicCamp) {
  return camp.price.trim().length > 0;
}

function dateToTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function overlapsDateRange(camp: PublicCamp, startDate: string, endDate: string) {
  if (!startDate && !endDate) return true;

  const selectedStart = dateToTime(startDate) ?? dateToTime(endDate);
  const selectedEnd = dateToTime(endDate) ?? dateToTime(startDate);
  const campStart = dateToTime(camp.start_date);
  const campEnd = dateToTime(camp.end_date) ?? campStart;

  if (selectedStart === null || selectedEnd === null || campStart === null || campEnd === null) return true;
  return campStart <= selectedEnd && campEnd >= selectedStart;
}

export function filterPublicCamps(camps: PublicCamp[], filters: PublicFilters) {
  const search = filters.search.trim().toLowerCase();
  const requestedAge = Number(filters.age);

  return camps.filter((camp) => {
    const providerVerified = Boolean(camp.verified || camp.provider?.verified);
    const providerFeatured = Boolean(camp.featured || camp.provider?.featured);
    const matchesSearch = search
      ? [camp.camp_name, camp.provider?.provider_name ?? "", camp.town, camp.county, camp.address, camp.activity_type].some((value) =>
          value.toLowerCase().includes(search),
        )
      : true;
    const matchesAge = filters.age ? Number.isFinite(requestedAge) && camp.age_min <= requestedAge && camp.age_max >= requestedAge : true;
    const matchesPrice =
      filters.priceStatus === "present" ? hasPrice(camp) : filters.priceStatus === "missing" ? !hasPrice(camp) : true;

    return (
      matchesSearch &&
      (!filters.county || camp.county === filters.county) &&
      (!filters.town || camp.town === filters.town) &&
      (!filters.activity || camp.activity_type === filters.activity) &&
      (!filters.holiday || camp.holiday_type === filters.holiday) &&
      (!filters.dayLength || camp.half_day_or_full_day === filters.dayLength) &&
      (!filters.verifiedOnly || providerVerified) &&
      (!filters.featuredOnly || providerFeatured) &&
      matchesPrice &&
      matchesAge &&
      overlapsDateRange(camp, filters.startDate, filters.endDate)
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

function providerName(camp: PublicCamp) {
  return camp.provider?.provider_name ?? "";
}

export function sortPublicCamps(camps: PublicCamp[], sort: PublicSort) {
  return [...camps].sort((a, b) => {
    if (sort === "price-asc") return priceValue(a.price) - priceValue(b.price) || a.town.localeCompare(b.town);
    if (sort === "town-az") return a.town.localeCompare(b.town) || dateValue(a.start_date) - dateValue(b.start_date);
    if (sort === "provider-az") return providerName(a).localeCompare(providerName(b)) || dateValue(a.start_date) - dateValue(b.start_date);
    return dateValue(a.start_date) - dateValue(b.start_date) || a.town.localeCompare(b.town);
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
