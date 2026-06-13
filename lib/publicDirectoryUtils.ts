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
  const requestedAge = Number(filters.age);

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
