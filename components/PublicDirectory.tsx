"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadStoredCamps } from "@/lib/campStorage";
import { loadStoredProviders } from "@/lib/providerStorage";
import {
  buildPublicCamps,
  filterPublicCamps,
  formatAgeRange,
  formatDateRange,
  getUniquePublicValues,
  sortPublicCamps,
  type PublicFilters,
  type PublicSort,
} from "@/lib/publicDirectoryUtils";
import type { Camp, Provider } from "@/lib/types";

type Props = { initialCamps: Camp[]; initialProviders: Provider[] };

type FilterChip = { key: keyof PublicFilters; label: string };

const initialFilters: PublicFilters = { search: "", county: "", town: "", activity: "", holiday: "", age: "" };
const ageOptions = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16+"];

export function PublicDirectory({ initialCamps, initialProviders }: Props) {
  const [camps, setCamps] = useState(initialCamps);
  const [providers, setProviders] = useState(initialProviders);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState<PublicSort>("soonest");

  useEffect(() => {
    setProviders(loadStoredProviders() ?? initialProviders);
    setCamps(loadStoredCamps() ?? initialCamps);
  }, [initialCamps, initialProviders]);

  const publicCamps = useMemo(() => buildPublicCamps(camps, providers), [camps, providers]);
  const filteredCamps = useMemo(() => filterPublicCamps(publicCamps, filters), [publicCamps, filters]);
  const sortedCamps = useMemo(() => sortPublicCamps(filteredCamps, sort), [filteredCamps, sort]);
  const counties = useMemo(() => getUniquePublicValues(publicCamps, "county"), [publicCamps]);
  const towns = useMemo(() => getUniquePublicValues(publicCamps, "town"), [publicCamps]);
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
    return chips;
  }, [filters]);
  const hasActiveFilters = activeChips.length > 0;

  function updateFilter(key: keyof PublicFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilter(key: keyof PublicFilters) {
    updateFilter(key, "");
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
          <div><h2>{filteredCamps.length} camps found</h2><p>Listings update automatically when new camp data is imported.</p></div>
          <label className="sort-control">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as PublicSort)}><option value="soonest">Soonest start date</option><option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option><option value="age-youngest">Age youngest first</option><option value="age-oldest">Age oldest first</option></select></label>
        </div>
        {sortedCamps.length > 0 ? (
          <div className="camp-card-grid">
            {sortedCamps.map((camp) => (
              <article className="camp-card" key={camp.id}>
                <div className="camp-card-main">
                  <div className="card-badges"><span className="badge success">{camp.activity_type}</span><span className="badge muted">{camp.holiday_type}</span></div>
                  <h3>{camp.camp_name}</h3>
                  <p className="provider-name">{camp.provider?.provider_name ?? "Provider details coming soon"}</p>
                  <p className="location-line">{camp.town}, {camp.county}</p>
                </div>
                <dl className="camp-card-meta">
                  <div><dt>Dates</dt><dd>{formatDateRange(camp.start_date, camp.end_date)}</dd></div>
                  <div><dt>Ages</dt><dd>{formatAgeRange(camp.age_min, camp.age_max)}</dd></div>
                  <div><dt>Price</dt><dd>{camp.price || "Price to be confirmed"}</dd></div>
                </dl>
                <Link className="button-link" href={`/camps/${camp.publicSlug}`}>View details</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="public-empty-state"><p>No camps found. Try removing a filter or searching a nearby town.</p><button type="button" onClick={clearAllFilters}>Clear filters</button></div>
        )}
      </section>
    </main>
  );
}
