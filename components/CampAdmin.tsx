"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  campFields,
  campsToCsv,
  createBlankCamp,
  csvToCamps,
  filterCamps,
  getDashboardStats,
  getUniqueValues,
  providersById,
  requiredCampFields,
  validateCamp,
} from "@/lib/campUtils";
import { clearStoredCamps, loadStoredCamps } from "@/lib/campStorage";
import { getCamps, getProviders } from "@/lib/dataRepository";
import { migrateLocalStorageToSupabaseIfEmpty } from "@/lib/localStorageMigration";
import { loadStoredProviders } from "@/lib/providerStorage";
import { Camp, Provider, campStatuses, dayLengths, holidayTypes } from "@/lib/types";

type Filters = {
  search: string;
  county: string;
  activityType: string;
  holidayType: string;
  status: string;
};

type Props = {
  initialCamps: Camp[];
  initialProviders: Provider[];
};

const selectFields = new Set<keyof Camp>(["provider_id", "holiday_type", "half_day_or_full_day", "status"]);
const numberFields = new Set<keyof Camp>(["age_min", "age_max"]);
const dateFields = new Set<keyof Camp>(["start_date", "end_date", "last_checked"]);
const timeFields = new Set<keyof Camp>(["start_time", "end_time"]);
const booleanFields = new Set<keyof Camp>(["verified", "featured"]);
const longTextFields = new Set<keyof Camp>(["address"]);

function formatLabel(field: string) {
  return field.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function badgeClass(status: Camp["status"]) {
  if (status === "approved") return "badge success";
  if (status === "needs_review") return "badge warning";
  return "badge muted";
}

export function CampAdmin({ initialCamps, initialProviders }: Props) {
  const [camps, setCamps] = useState<Camp[]>(initialCamps);
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [dataSourceMessage, setDataSourceMessage] = useState("Loading Supabase data…");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCampId, setSelectedCampId] = useState(initialCamps[0]?.id ?? "");
  const [filters, setFilters] = useState<Filters>({
    search: "",
    county: "",
    activityType: "",
    holidayType: "",
    status: "",
  });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboardData() {
      setIsLoading(true);
      await migrateLocalStorageToSupabaseIfEmpty();
      const [remoteProviders, remoteCamps] = await Promise.all([getProviders(), getCamps()]);
      if (!active) return;

      if (!remoteProviders.error && !remoteCamps.error && (remoteProviders.data.length > 0 || remoteCamps.data.length > 0)) {
        setProviders(remoteProviders.data.length > 0 ? remoteProviders.data : initialProviders);
        const nextCamps = remoteCamps.data.length > 0 ? remoteCamps.data : initialCamps;
        setCamps(nextCamps);
        setSelectedCampId(nextCamps[0]?.id ?? "");
        setDataSourceMessage("Showing Supabase data.");
      } else {
        const storedProviders = loadStoredProviders();
        if (storedProviders) setProviders(storedProviders);
        const storedCamps = loadStoredCamps();
        if (storedCamps) {
          setCamps(storedCamps);
          setSelectedCampId(storedCamps[0]?.id ?? "");
        }
        setDataSourceMessage(`Showing local fallback data${remoteProviders.error || remoteCamps.error ? ` (${remoteProviders.error ?? remoteCamps.error})` : ""}.`);
      }
      setIsLoading(false);
    }

    loadDashboardData();
    return () => { active = false; };
  }, [initialCamps, initialProviders]);

  const providerLookup = useMemo(() => providersById(providers), [providers]);
  const stats = useMemo(() => getDashboardStats(camps, providers), [camps, providers]);
  const filteredCamps = useMemo(() => filterCamps(camps, providers, filters), [camps, providers, filters]);
  const selectedCamp = camps.find((camp) => camp.id === selectedCampId) ?? camps[0] ?? createBlankCamp(providers[0]?.provider_id ?? "");
  const selectedProvider = providerLookup[selectedCamp.provider_id];
  const counties = useMemo(() => getUniqueValues(camps, "county"), [camps]);
  const activityTypes = useMemo(() => getUniqueValues(camps, "activity_type"), [camps]);

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateCamp(field: keyof Camp, value: string | number | boolean) {
    setCamps((currentCamps) =>
      currentCamps.map((camp) => (camp.id === selectedCamp.id ? { ...camp, [field]: value } : camp)),
    );
  }

  function handleClearImportedCamps() {
    const confirmed = window.confirm("Clear imported camps and revert to mock camp data?");
    if (!confirmed) return;

    clearStoredCamps();
    setCamps(initialCamps);
    setSelectedCampId(initialCamps[0]?.id ?? "");
    setDataSourceMessage("Showing bundled mock data after clearing local fallback camps.");
    setFilters({ search: "", county: "", activityType: "", holidayType: "", status: "" });
    setImportErrors([]);
    setFormErrors([]);
  }

  function addCamp() {
    const blankCamp = createBlankCamp(providers[0]?.provider_id ?? "");
    setCamps((currentCamps) => [blankCamp, ...currentCamps]);
    setSelectedCampId(blankCamp.id);
    setFormErrors([]);
  }

  function handleValidateSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormErrors(validateCamp(selectedCamp, providers));
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = csvToCamps(String(reader.result ?? ""), providers);
      setImportErrors(result.errors);
      if (result.errors.length === 0) {
        setCamps(result.camps);
        setSelectedCampId(result.camps[0]?.id ?? "");
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  function handleExport() {
    const csv = campsToCsv(filteredCamps);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "campharvester-camps.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderField(field: keyof Camp) {
    const value = selectedCamp[field];
    const isRequired = requiredCampFields.includes(field);

    if (selectFields.has(field)) {
      if (field === "provider_id") {
        return (
          <label key={field}>
            Provider <span className="required">*</span>
            <select value={String(value)} onChange={(event) => updateCamp(field, event.target.value)} required>
              {providers.map((provider) => (
                <option key={provider.provider_id} value={provider.provider_id}>
                  {provider.provider_name}
                </option>
              ))}
            </select>
          </label>
        );
      }

      const options =
        field === "holiday_type" ? holidayTypes : field === "half_day_or_full_day" ? dayLengths : campStatuses;
      return (
        <label key={field}>
          {formatLabel(field)} {isRequired ? <span className="required">*</span> : null}
          <select value={String(value)} onChange={(event) => updateCamp(field, event.target.value)} required={isRequired}>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (longTextFields.has(field)) {
      return (
        <label key={field} className="wide-field">
          {formatLabel(field)} {isRequired ? <span className="required">*</span> : null}
          <textarea value={String(value)} onChange={(event) => updateCamp(field, event.target.value)} required={isRequired} />
        </label>
      );
    }

    if (booleanFields.has(field)) {
      return (
        <label key={field} className="checkbox-field">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateCamp(field, event.target.checked)}
          />
          {formatLabel(field)}
        </label>
      );
    }

    const type = numberFields.has(field)
      ? "number"
      : dateFields.has(field)
        ? "date"
        : timeFields.has(field)
          ? "time"
          : field.includes("email")
            ? "email"
            : field.includes("url")
              ? "url"
              : "text";

    return (
      <label key={field}>
        {formatLabel(field)} {isRequired ? <span className="required">*</span> : null}
        <input
          type={type}
          value={String(value)}
          onChange={(event) =>
            updateCamp(field, numberFields.has(field) ? Number(event.target.value) : event.target.value)
          }
          required={isRequired}
        />
      </label>
    );
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Internal admin · Supabase primary data</p>
          <h1>CampHarvester</h1>
          <p>
            Collect, review and manage Irish kids&apos; camp listings for Wicklow and Dublin before the public
            directory launch.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button-link public-directory-link" href="/camps">
            View Public Directory
          </Link>
          <Link className="button-link" href="/providers">
            Provider Import
          </Link>
          <Link className="button-link" href="/camps/import">
            Camps import wizard
          </Link>
          <button type="button" onClick={addCamp}>
            Add draft camp
          </button>
          <button type="button" className="secondary" onClick={handleExport}>
            Export visible CSV
          </button>
        </div>
      </header>

      <section className="panel data-source-banner" aria-live="polite">
        <p>
          {isLoading ? "Loading providers and camps from Supabase…" : dataSourceMessage}
        </p>
        <button type="button" className="secondary" onClick={handleClearImportedCamps}>
          Clear local fallback camps
        </button>
      </section>

      <section className="stats-grid" aria-label="Dashboard metrics">
        <article><span>Total camps</span><strong>{stats.total}</strong></article>
        <article><span>Draft camps</span><strong>{stats.draft}</strong></article>
        <article><span>Approved camps</span><strong>{stats.approved}</strong></article>
        <article><span>Needs review</span><strong>{stats.needsReview}</strong></article>
        <article><span>Camps from featured providers</span><strong>{stats.featured}</strong></article>
        <article><span>Camps from verified providers</span><strong>{stats.verified}</strong></article>
      </section>

      <section className="panel import-panel">
        <div>
          <h2>CSV import</h2>
          <p>
            Import camp CSV rows that reference an existing provider_id. Use the Camps Import Wizard to persist accepted imports to the dashboard.
          </p>
        </div>
        <label className="file-input">
          <span>Choose CSV file</span>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImport} />
        </label>
        {importErrors.length > 0 ? (
          <div className="error-box" role="alert">
            <strong>Import errors</strong>
            <ul>{importErrors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Camp listings</h2>
            <p>{filteredCamps.length} of {camps.length} camps shown · {providers.length} providers available</p>
          </div>
        </div>
        <div className="filters">
          <label>
            Search
            <input
              placeholder="Camp, provider, town, address or county"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />
          </label>
          <label>
            County
            <select value={filters.county} onChange={(event) => updateFilter("county", event.target.value)}>
              <option value="">All counties</option>
              {counties.map((county) => <option key={county}>{county}</option>)}
            </select>
          </label>
          <label>
            Activity type
            <select value={filters.activityType} onChange={(event) => updateFilter("activityType", event.target.value)}>
              <option value="">All activities</option>
              {activityTypes.map((activityType) => <option key={activityType}>{activityType}</option>)}
            </select>
          </label>
          <label>
            Holiday type
            <select value={filters.holidayType} onChange={(event) => updateFilter("holidayType", event.target.value)}>
              <option value="">All holidays</option>
              {holidayTypes.map((holidayType) => <option key={holidayType}>{holidayType}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="">All statuses</option>
              {campStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Camp</th>
                <th>Provider</th>
                <th>Town</th>
                <th>County</th>
                <th>Activity</th>
                <th>Holiday</th>
                <th>Status</th>
                <th>Provider flags</th>
              </tr>
            </thead>
            <tbody>
              {filteredCamps.map((camp) => {
                const provider = providerLookup[camp.provider_id];

                return (
                  <tr
                    key={camp.id}
                    className={camp.id === selectedCamp.id ? "selected-row" : ""}
                    onClick={() => {
                      setSelectedCampId(camp.id);
                      setFormErrors([]);
                    }}
                  >
                    <td><strong>{camp.camp_name}</strong><small>{camp.start_date} → {camp.end_date}</small></td>
                    <td>
                      <strong>{provider?.provider_name ?? "Unknown provider"}</strong>
                      <small>{provider?.primary_email ?? camp.provider_id}</small>
                    </td>
                    <td>{camp.town}</td>
                    <td>{camp.county}</td>
                    <td>{camp.activity_type}</td>
                    <td>{camp.holiday_type}</td>
                    <td><span className={badgeClass(camp.status)}>{camp.status}</span></td>
                    <td className="flags">
                      {provider?.verified ? <span className="flag verified">Verified</span> : null}
                      {provider?.featured ? <span className="flag featured">Featured</span> : null}
                      {!provider?.verified && !provider?.featured ? <span className="empty-state">—</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Edit camp</h2>
            <p>Camp records store provider_id only; provider details below are resolved from the active provider data.</p>
          </div>
          <span className={badgeClass(selectedCamp.status)}>{selectedCamp.status}</span>
        </div>
        {selectedProvider ? (
          <aside className="provider-card" aria-label="Selected provider details">
            <div>
              <strong>{selectedProvider.provider_name}</strong>
              <p>{selectedProvider.description}</p>
            </div>
            <div className="provider-meta">
              <a href={selectedProvider.website}>{selectedProvider.website}</a>
              <span>{[selectedProvider.primary_email, selectedProvider.secondary_email].filter(Boolean).join(", ")}</span>
              <span>{[selectedProvider.primary_phone, selectedProvider.secondary_phone].filter(Boolean).join(", ")}</span>
              <span className="flags">
                {selectedProvider.verified ? <span className="flag verified">Verified provider</span> : null}
                {selectedProvider.featured ? <span className="flag featured">Featured provider</span> : null}
              </span>
            </div>
          </aside>
        ) : null}
        <form className="edit-form" onSubmit={handleValidateSelected}>
          {campFields.map(renderField)}
          {formErrors.length > 0 ? (
            <div className="error-box wide-field" role="alert">
              <strong>Validation issues</strong>
              <ul>{formErrors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          ) : null}
          <div className="form-actions wide-field">
            <button type="submit">Validate camp</button>
            <button type="button" className="secondary" onClick={() => setFormErrors([])}>
              Clear validation
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
