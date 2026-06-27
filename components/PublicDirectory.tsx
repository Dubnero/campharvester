"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStoredCamps } from "@/lib/campStorage";
import { loadStoredProviders } from "@/lib/providerStorage";
import { getCamps, getProviders } from "@/lib/dataRepository";
import {
  buildPublicCamps,
  filterPublicCamps,
  formatAgeRange,
  formatDateRange,
  formatLocationLines,
  formatPublicTimeDetails,
  publicDayLengthLabel,
  getPublicTownOptions,
  getUniquePublicValues,
  townForCountyOrBlank,
  sortPublicCamps,
  type PublicFilters,
  type PublicSort,
} from "@/lib/publicDirectoryUtils";
import type { Camp, Provider } from "@/lib/types";

type Props = { initialCamps: Camp[]; initialProviders: Provider[] };

type FilterChip = { key: keyof PublicFilters; label: string };

const initialFilters: PublicFilters = {
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
};
const ageOptions = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"];

export function PublicDirectory({ initialCamps, initialProviders }: Props) {
  const [camps, setCamps] = useState(initialCamps);
  const [providers, setProviders] = useState(initialProviders);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<PublicSort>("start-date");

  useEffect(() => {
    let active = true;

    async function loadDirectoryData() {
      const [remoteProviders, remoteCamps] = await Promise.all([getProviders(), getCamps()]);
      if (!active) return;

      if (!remoteProviders.error && !remoteCamps.error && (remoteProviders.data.length > 0 || remoteCamps.data.length > 0)) {
        setProviders(remoteProviders.data.length > 0 ? remoteProviders.data : initialProviders);
        setCamps(remoteCamps.data.length > 0 ? remoteCamps.data : initialCamps);
      } else {
        setProviders(loadStoredProviders() ?? initialProviders);
        setCamps(loadStoredCamps() ?? initialCamps);
      }
    }

    loadDirectoryData();
    return () => { active = false; };
  }, [initialCamps, initialProviders]);

  const publicCamps = useMemo(() => buildPublicCamps(camps, providers), [camps, providers]);
  const filteredCamps = useMemo(() => filterPublicCamps(publicCamps, filters), [publicCamps, filters]);
  const sortedCamps = useMemo(() => sortPublicCamps(filteredCamps, sort), [filteredCamps, sort]);
  const counties = useMemo(() => getUniquePublicValues(publicCamps, "county"), [publicCamps]);
  const towns = useMemo(() => getPublicTownOptions(publicCamps, filters.county), [publicCamps, filters.county]);
  const activities = useMemo(() => getUniquePublicValues(publicCamps, "activity_type"), [publicCamps]);
  const holidays = useMemo(() => getUniquePublicValues(publicCamps, "holiday_type"), [publicCamps]);
  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (filters.search.trim()) chips.push({ key: "search", label: `Search: ${filters.search.trim()}` });
    if (filters.county) chips.push({ key: "county", label: filters.county });
    if (filters.town) chips.push({ key: "town", label: filters.town });
    if (filters.holiday) chips.push({ key: "holiday", label: filters.holiday });
    if (filters.age) chips.push({ key: "age", label: `Age ${filters.age}` });
    if (filters.activity) chips.push({ key: "activity", label: filters.activity });
    if (filters.startDate) chips.push({ key: "startDate", label: `From ${filters.startDate}` });
    if (filters.endDate) chips.push({ key: "endDate", label: `To ${filters.endDate}` });
    if (filters.dayLength) chips.push({ key: "dayLength", label: publicDayLengthLabel(filters.dayLength) });
    if (filters.priceStatus) chips.push({ key: "priceStatus", label: filters.priceStatus === "present" ? "Price shown" : "Price missing" });
    if (filters.verifiedOnly) chips.push({ key: "verifiedOnly", label: "Verified only" });
    if (filters.featuredOnly) chips.push({ key: "featuredOnly", label: "Featured only" });
    return chips;
  }, [filters]);
  const hasActiveFilters = activeChips.length > 0;

  function updateFilter(key: keyof PublicFilters, value: string | boolean) {
    setFilters((current) => {
      if (key === "county" && typeof value === "string") {
        return { ...current, county: value, town: townForCountyOrBlank(publicCamps, value, current.town) };
      }
      return { ...current, [key]: value };
    });
  }

  useEffect(() => {
    setFilters((current) => {
      const validTown = townForCountyOrBlank(publicCamps, current.county, current.town);
      return validTown === current.town ? current : { ...current, town: validTown };
    });
  }, [publicCamps]);

  function clearFilter(key: keyof PublicFilters) {
    updateFilter(key, typeof initialFilters[key] === "boolean" ? false : "");
  }

  function clearAllFilters() {
    setFilters(initialFilters);
  }

  return (
    <main className="public-shell">
      <section className="public-hero">
        <p className="eyebrow">Find kids&apos; camps in Ireland</p>
        <h1>Discover school holiday camps near you</h1>
        <p>Search by camp, provider, town or county and compare activities, ages, dates and prices.</p>
      </section>

      <section className="public-panel" aria-label="Search and filters">
        <div className="public-filters">
          <label className="public-search">
            Search camps
            <input placeholder="Camp, provider, town or county" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} />
          </label>
          <label>County<select value={filters.county} onChange={(event) => updateFilter("county", event.target.value)}><option value="">All counties</option>{counties.map((county) => <option key={county}>{county}</option>)}</select></label>
          <label>Town<select value={filters.town} onChange={(event) => updateFilter("town", event.target.value)}><option value="">All towns</option>{towns.map((town) => <option key={town}>{town}</option>)}</select></label>
          <label>Activity<select value={filters.activity} onChange={(event) => updateFilter("activity", event.target.value)}><option value="">All activities</option>{activities.map((activity) => <option key={activity}>{activity}</option>)}</select></label>
          <label>Holiday<select value={filters.holiday} onChange={(event) => updateFilter("holiday", event.target.value)}><option value="">All holidays</option>{holidays.map((holiday) => <option key={holiday}>{holiday}</option>)}</select></label>
          <label>Child age<select value={filters.age} onChange={(event) => updateFilter("age", event.target.value)}><option value="">Any age</option>{ageOptions.map((age) => <option key={age}>{age}</option>)}</select></label>
          <label>Start date from<input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} /></label>
          <label>Start date to<input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} /></label>
          <label>Half-day / full-day<select value={filters.dayLength} onChange={(event) => updateFilter("dayLength", event.target.value)}><option value="">Any length</option><option>Half day</option><option>Full day</option><option>Both</option><option value="Unknown">Length to be confirmed</option></select></label>
          <label>Price<select value={filters.priceStatus} onChange={(event) => updateFilter("priceStatus", event.target.value)}><option value="">Any price status</option><option value="present">Price present</option><option value="missing">Price missing</option></select></label>
          <label className="checkbox-row public-checkbox"><input type="checkbox" checked={filters.verifiedOnly} onChange={(event) => updateFilter("verifiedOnly", event.target.checked)} /> Verified only</label>
          <label className="checkbox-row public-checkbox"><input type="checkbox" checked={filters.featuredOnly} onChange={(event) => updateFilter("featuredOnly", event.target.checked)} /> Featured only</label>
        </div>
        {hasActiveFilters && (
          <div className="active-filter-row" aria-label="Active filters">
            {activeChips.map((chip) => (
              <button className="filter-chip" type="button" key={chip.key} onClick={() => clearFilter(chip.key)} aria-label={`Remove ${chip.label} filter`}>
                {chip.label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button className="clear-filters-button" type="button" onClick={clearAllFilters}>Clear all filters</button>
          </div>
        )}
      </section>

      <section className="directory-results" aria-live="polite">
        <div className="directory-heading">
          <div><h2>Showing {filteredCamps.length} of {publicCamps.length} camp schedules</h2><p>Listings update automatically when new camp data is imported.</p><p className="trust-note">Camp details can change. Always confirm dates, times, availability and pricing with the provider before booking.</p></div>
          <label className="sort-control">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as PublicSort)}><option value="start-date">Start date earliest first</option><option value="price-asc">Price low to high</option><option value="town-az">Town A-Z</option><option value="provider-az">Provider A-Z</option></select></label>
        </div>
        {sortedCamps.length > 0 ? (
          <div className="camp-card-grid">
            {sortedCamps.map((camp) => {
              const locationLines = formatLocationLines(camp);

              return (
              <article className="camp-card" key={camp.camp_id}>
                <div className="camp-card-main">
                  <div className="card-badges"><span className="badge success">{camp.activity_type}</span><span className="badge muted">{camp.holiday_type}</span></div>
                  <h3>{camp.camp_name}</h3>
                  <p className="provider-name">{camp.provider?.provider_name ?? "Provider details coming soon"}</p>
                  {locationLines.primary ? <p className="location-line">{locationLines.primary}</p> : null}
                  {locationLines.secondary ? <p className="address-line">{locationLines.secondary}</p> : null}
                  <div className="flags">
                    {camp.verified || camp.provider?.verified ? <span className="flag verified">Verified</span> : null}
                    {camp.featured || camp.provider?.featured ? <span className="flag featured">Featured</span> : null}
                  </div>
                </div>
                <dl className="camp-card-meta">
                  <div><dt>Dates</dt><dd>{formatDateRange(camp.start_date, camp.end_date)}</dd></div>
                  <div><dt>Times</dt><dd>{formatPublicTimeDetails(camp.start_time, camp.end_time, camp.half_day_or_full_day)}</dd></div>
                  <div><dt>Ages</dt><dd>{formatAgeRange(camp.age_min, camp.age_max)}</dd></div>
                  <div><dt>Price</dt><dd>{camp.price || "Price to be confirmed"}</dd></div>
                </dl>
                {camp.booking_url ? <a className="button-link" href={camp.booking_url} target="_blank" rel="noreferrer">View / book camp</a> : null}
              </article>
              );
            })}
          </div>
        ) : (
          <div className="public-empty-state"><p>No camps match those filters yet. Try clearing one or two filters.</p><button type="button" onClick={clearAllFilters}>Clear filters</button></div>
        )}
      </section>
    </main>
  );
}
