"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { getProviders, upsertProviders } from "@/lib/dataRepository";
import { migrateLocalStorageToSupabaseIfEmpty } from "@/lib/localStorageMigration";
import { loadStoredProviders, saveStoredProviders } from "@/lib/providerStorage";
import type { Camp, Provider } from "@/lib/types";

type ProviderRow = Provider & {
  counties: string[];
  activityCategories: string[];
  reviewStatus: "Ready" | "Needs review";
};

type Filters = {
  search: string;
  county: string;
  activityCategory: string;
};

type CsvValidation = {
  providers: Provider[];
  errors: string[];
  warnings: string[];
  summary: {
    rows: number;
    validRows: number;
    errorCount: number;
    warningCount: number;
  };
};

const requiredProviderFields: Array<keyof Provider> = ["provider_id", "provider_name"];
const optionalProviderCsvFields = [
  { label: "website", headers: ["website"] },
  { label: "primary_email", headers: ["primary_email", "email"] },
  { label: "secondary_email", headers: ["secondary_email"] },
  { label: "primary_phone", headers: ["primary_phone", "phone"] },
  { label: "secondary_phone", headers: ["secondary_phone"] },
  { label: "description", headers: ["description"] },
  { label: "verified", headers: ["verified"] },
  { label: "featured", headers: ["featured"] },
];
const emptyValidation: CsvValidation = {
  providers: [],
  errors: [],
  warnings: [],
  summary: { rows: 0, validRows: 0, errorCount: 0, warningCount: 0 },
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += character;
    }
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function toBoolean(value: string) {
  return ["true", "yes", "1", "verified", "featured"].includes(value.trim().toLowerCase());
}

function isValidEmail(primaryEmail: string) {
  return primaryEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryEmail);
}

function isValidWebsite(website: string) {
  if (website.length === 0) return true;
  try {
    const url = new URL(website);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}

function validateProviderCsv(text: string): CsvValidation {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { ...emptyValidation, errors: ["CSV file is empty."], summary: { ...emptyValidation.summary, errorCount: 1 } };
  }

  const headers = rows[0].map((header) => header.trim());
  const missingFields = requiredProviderFields.filter((field) => !headers.includes(field));
  const errors: string[] = missingFields.map((field) => `Missing required CSV header: ${field}.`);
  const warnings: string[] = optionalProviderCsvFields
    .filter((field) => !field.headers.some((header) => headers.includes(header)))
    .map((field) => `Optional CSV header not found: ${field.label}. Blank values will be used.`);
  const seenProviderIds = new Map<string, number>();
  const providers: Provider[] = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));
    const providerId = record.provider_id ?? "";
    const providerName = record.provider_name ?? "";

    requiredProviderFields.forEach((field) => {
      if (!record[field]?.trim()) errors.push(`Row ${rowNumber}: ${field} is required.`);
    });

    if (providerId) {
      const firstSeen = seenProviderIds.get(providerId);
      if (firstSeen) errors.push(`Row ${rowNumber}: duplicate provider_id "${providerId}" also appears on row ${firstSeen}.`);
      seenProviderIds.set(providerId, rowNumber);
    }

    const primaryEmail = record.primary_email || record.email || "";
    const primaryPhone = record.primary_phone || record.phone || "";

    if (!isValidEmail(primaryEmail)) errors.push(`Row ${rowNumber}: invalid email format for "${primaryEmail}".`);
    if (!isValidWebsite(record.website ?? "")) errors.push(`Row ${rowNumber}: invalid website format for "${record.website}".`);

    providers.push({
      provider_id: providerId,
      provider_name: providerName,
      website: record.website ?? "",
      source_url: record.source_url ?? "",
      primary_email: primaryEmail,
      secondary_email: record.secondary_email ?? "",
      primary_phone: primaryPhone,
      secondary_phone: record.secondary_phone ?? "",
      description: record.description ?? "",
      primary_county: record.primary_county ?? "",
      activity_category: record.activity_category ?? "",
      provider_type: record.provider_type ?? "",
      status: record.status ?? "",
      verified: toBoolean(record.verified ?? ""),
      featured: toBoolean(record.featured ?? ""),
      last_checked: record.last_checked ?? "",
      notes: record.notes ?? "",
      created_at: record.created_at ?? "",
    });
  });

  return {
    providers,
    errors,
    warnings,
    summary: { rows: Math.max(rows.length - 1, 0), validRows: errors.length === 0 ? providers.length : 0, errorCount: errors.length, warningCount: warnings.length },
  };
}

function getProviderRows(providers: Provider[], camps: Camp[]): ProviderRow[] {
  return providers.map((provider) => {
    const providerCamps = camps.filter((camp) => camp.provider_id === provider.provider_id);
    const counties = Array.from(new Set([provider.primary_county, ...providerCamps.map((camp) => camp.county)].filter(isPresent))).sort();
    const activityCategories = Array.from(
      new Set([provider.activity_category, ...providerCamps.map((camp) => camp.activity_type)].filter(isPresent)),
    ).sort();
    const reviewStatus = provider.verified && isValidEmail(provider.primary_email) && isValidWebsite(provider.website) ? "Ready" : "Needs review";

    return { ...provider, counties, activityCategories, reviewStatus };
  });
}

function flagClass(value: boolean, activeClass: string) {
  return value ? `flag ${activeClass}` : "badge muted";
}

export function ProviderImport({ initialProviders, camps }: { initialProviders: Provider[]; camps: Camp[] }) {
  const [providers, setProviders] = useState(initialProviders);
  const [dataSourceMessage, setDataSourceMessage] = useState("Loading providers from Supabase…");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = useState<Filters>({ search: "", county: "", activityCategory: "" });
  const [validation, setValidation] = useState<CsvValidation>(emptyValidation);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const providerRows = useMemo(() => getProviderRows(providers, camps), [providers, camps]);
  const counties = useMemo(() => Array.from(new Set(providerRows.flatMap((provider) => provider.counties))).sort(), [providerRows]);
  const activityCategories = useMemo(
    () => Array.from(new Set(providerRows.flatMap((provider) => provider.activityCategories))).sort(),
    [providerRows],
  );
  const filteredProviders = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return providerRows.filter((provider) => {
      const matchesSearch =
        search.length === 0 ||
        [provider.provider_name, provider.provider_id, provider.primary_email, provider.secondary_email ?? "", provider.website]
          .some((value) => value.toLowerCase().includes(search));
      const matchesCounty = filters.county.length === 0 || provider.counties.includes(filters.county);
      const matchesActivity =
        filters.activityCategory.length === 0 || provider.activityCategories.includes(filters.activityCategory);
      return matchesSearch && matchesCounty && matchesActivity;
    });
  }, [filters, providerRows]);
  useEffect(() => {
    let active = true;

    async function loadProviderData() {
      setIsLoading(true);
      await migrateLocalStorageToSupabaseIfEmpty();
      const remoteProviders = await getProviders();
      if (!active) return;

      if (!remoteProviders.error && remoteProviders.data.length > 0) {
        setProviders(remoteProviders.data);
        setDataSourceMessage("Showing Supabase data.");
      } else {
        const storedProviders = loadStoredProviders();
        if (storedProviders) setProviders(storedProviders);
        setDataSourceMessage(`Showing local fallback data${remoteProviders.error ? ` (${remoteProviders.error})` : ""}.`);
      }
      setIsLoading(false);
    }

    loadProviderData();
    return () => { active = false; };
  }, []);

  const metrics = useMemo(
    () => ({
      total: providers.length,
      verified: providers.filter((provider) => provider.verified).length,
      featured: providers.filter((provider) => provider.featured).length,
      needsReview: providerRows.filter((provider) => provider.reviewStatus === "Needs review").length,
    }),
    [providerRows, providers],
  );

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setValidation(validateProviderCsv(String(reader.result ?? "")));
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function acceptImport() {
    if (validation.errors.length > 0 || validation.providers.length === 0) return;

    setIsSaving(true);
    saveStoredProviders(validation.providers);
    const upsertResult = await upsertProviders(validation.providers);
    if (upsertResult.error) {
      setProviders(validation.providers);
      setDataSourceMessage(`Showing local fallback data (${upsertResult.error}).`);
    } else {
      const refreshedProviders = await getProviders();
      setProviders(refreshedProviders.error ? validation.providers : refreshedProviders.data);
      setDataSourceMessage(refreshedProviders.error ? `Showing local fallback data (${refreshedProviders.error}).` : "Showing Supabase data.");
    }
    setIsSaving(false);
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Provider import · Supabase primary data</p>
          <h1>Provider Import</h1>
          <p>Upload, validate and review provider CSV data, then upsert accepted rows to Supabase with localStorage fallback.</p>
        </div>
        <div className="hero-actions">
          <Link className="button-link secondary" href="/">Dashboard</Link>
          <Link className="button-link secondary" href="/camps/import">Camps import wizard</Link>
        </div>
      </header>

      <section className="stats-grid" aria-label="Provider metrics">
        <article><span>Total Providers</span><strong>{metrics.total}</strong></article>
        <article><span>Verified Providers</span><strong>{metrics.verified}</strong></article>
        <article><span>Featured Providers</span><strong>{metrics.featured}</strong></article>
        <article><span>Providers Needing Review</span><strong>{metrics.needsReview}</strong></article>
      </section>

      <section className="panel import-feedback data-source-banner" aria-live="polite">
        <p className="empty-state">{isLoading ? "Loading providers from Supabase…" : dataSourceMessage}</p>
      </section>

      <section className="panel import-panel">
        <div>
          <h2>Upload providers.csv</h2>
          <p>Parse CSV locally in your browser and review validation results before accepting the import.</p>
        </div>
        <label className="file-input">
          <span>Choose providers.csv</span>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImport} />
        </label>
      </section>

      {validation.summary.rows > 0 || validation.errors.length > 0 ? (
        <section className="panel import-feedback">
          <div className="section-heading">
            <div>
              <h2>Validation results</h2>
              <p>{validation.summary.rows} rows checked · {validation.summary.errorCount} errors · {validation.summary.warningCount} warnings</p>
            </div>
            <button type="button" onClick={acceptImport} disabled={isSaving || validation.errors.length > 0 || validation.providers.length === 0}>
              {isSaving ? "Saving…" : "Accept import"}
            </button>
          </div>
          <div className="summary-grid">
            <article><h3>Import summary</h3><p>{validation.summary.validRows} provider rows ready to import.</p></article>
            <article><h3>Required fields</h3><p>provider_id and provider_name must be present and populated.</p></article>
          </div>
          {validation.errors.length > 0 ? <div className="error-box"><strong>Errors</strong><ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
          {validation.warnings.length > 0 ? <div className="warning-box"><strong>Warnings</strong><ul>{validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
          {validation.errors.length === 0 && validation.providers.length > 0 ? <div className="success-box"><strong>Ready to import</strong><p>No blocking validation errors found.</p></div> : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Provider review</h2>
            <p>{filteredProviders.length} of {providers.length} providers shown.</p>
          </div>
        </div>
        <div className="filters provider-filters">
          <label>Provider search<input placeholder="Provider, ID, website or email" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /></label>
          <label>County<select value={filters.county} onChange={(event) => updateFilter("county", event.target.value)}><option value="">All counties</option>{counties.map((county) => <option key={county}>{county}</option>)}</select></label>
          <label>Activity category<select value={filters.activityCategory} onChange={(event) => updateFilter("activityCategory", event.target.value)}><option value="">All activities</option>{activityCategories.map((activity) => <option key={activity}>{activity}</option>)}</select></label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Provider Name</th><th>County</th><th>Activity Category</th><th>Website</th><th>Email</th><th>Verified</th><th>Featured</th><th>Status</th></tr></thead>
            <tbody>
              {filteredProviders.map((provider) => (
                <tr key={provider.provider_id}>
                  <td><strong>{provider.provider_name}</strong><small>{provider.provider_id}</small></td>
                  <td>{provider.counties.join(", ") || "—"}</td>
                  <td>{provider.activityCategories.join(", ") || "—"}</td>
                  <td><a href={provider.website}>{provider.website || "—"}</a></td>
                  <td>{[provider.primary_email, provider.secondary_email].filter(Boolean).join(", ") || "—"}</td>
                  <td><span className={flagClass(provider.verified, "verified")}>{provider.verified ? "Yes" : "No"}</span></td>
                  <td><span className={flagClass(provider.featured, "featured")}>{provider.featured ? "Yes" : "No"}</span></td>
                  <td><span className={provider.reviewStatus === "Ready" ? "badge success" : "badge warning"}>{provider.reviewStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
