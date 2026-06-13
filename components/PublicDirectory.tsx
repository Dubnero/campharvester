"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadStoredCamps } from "@/lib/campStorage";
import { loadStoredProviders } from "@/lib/providerStorage";
import { buildPublicCamps, filterPublicCamps, formatAgeRange, formatDateRange, getUniquePublicValues, type PublicFilters } from "@/lib/publicDirectoryUtils";
import type { Camp, Provider } from "@/lib/types";

type Props = { initialCamps: Camp[]; initialProviders: Provider[] };

const initialFilters: PublicFilters = { search: "", county: "", town: "", activity: "", holiday: "", age: "" };

export function PublicDirectory({ initialCamps, initialProviders }: Props) {
  const [camps, setCamps] = useState(initialCamps);
  const [providers, setProviders] = useState(initialProviders);
  const [filters, setFilters] = useState(initialFilters);

  useEffect(() => {
    setProviders(loadStoredProviders() ?? initialProviders);
    setCamps(loadStoredCamps() ?? initialCamps);
  }, [initialCamps, initialProviders]);

  const publicCamps = useMemo(() => buildPublicCamps(camps, providers), [camps, providers]);
  const filteredCamps = useMemo(() => filterPublicCamps(publicCamps, filters), [publicCamps, filters]);
  const counties = useMemo(() => getUniquePublicValues(publicCamps, "county"), [publicCamps]);
  const towns = useMemo(() => getUniquePublicValues(publicCamps, "town"), [publicCamps]);
  const activities = useMemo(() => getUniquePublicValues(publicCamps, "activity_type"), [publicCamps]);
  const holidays = useMemo(() => getUniquePublicValues(publicCamps, "holiday_type"), [publicCamps]);

  function updateFilter(key: keyof PublicFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
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
          <label>Child age<input type="number" min="0" placeholder="Any age" value={filters.age} onChange={(event) => updateFilter("age", event.target.value)} /></label>
        </div>
      </section>

      <section className="directory-results" aria-live="polite">
        <div className="directory-heading"><h2>{filteredCamps.length} camps found</h2><p>Listings update automatically when new camp data is imported.</p></div>
        <div className="camp-card-grid">
          {filteredCamps.map((camp) => (
            <article className="camp-card" key={camp.id}>
              <div><p className="card-kicker">{camp.activity_type} · {camp.holiday_type}</p><h3>{camp.camp_name}</h3><p>{camp.provider?.provider_name ?? "Provider details coming soon"}</p></div>
              <dl className="camp-card-meta">
                <div><dt>Location</dt><dd>{camp.town}, {camp.county}</dd></div>
                <div><dt>Ages</dt><dd>{formatAgeRange(camp.age_min, camp.age_max)}</dd></div>
                <div><dt>Dates</dt><dd>{formatDateRange(camp.start_date, camp.end_date)}</dd></div>
                <div><dt>Price</dt><dd>{camp.price || "Price to be confirmed"}</dd></div>
              </dl>
              <Link className="button-link" href={`/camps/${camp.publicSlug}`}>View details</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
