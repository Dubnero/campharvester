"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { csvToProviders, filterProviders, getProviderStats } from "@/lib/providerUtils";
import type { Provider } from "@/lib/types";

type Props = {
  initialProviders: Provider[];
};

export function ProviderImport({ initialProviders }: Props) {
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [search, setSearch] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => getProviderStats(providers), [providers]);
  const filteredProviders = useMemo(() => filterProviders(providers, search), [providers, search]);

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = csvToProviders(String(reader.result ?? ""));
      setImportErrors(result.errors);
      if (result.errors.length === 0) {
        setProviders(result.providers);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Internal admin · provider imports</p>
          <h1>Provider Import</h1>
          <p>Import and review local mock provider records before camps are linked to production data.</p>
        </div>
        <div className="hero-actions">
          <Link className="button-link secondary" href="/">
            Back to camps
          </Link>
        </div>
      </header>

      <section className="stats-grid provider-stats" aria-label="Provider metrics">
        <article><span>Total providers</span><strong>{stats.total}</strong></article>
        <article><span>Verified providers</span><strong>{stats.verified}</strong></article>
        <article><span>Featured providers</span><strong>{stats.featured}</strong></article>
      </section>

      <section className="panel import-panel">
        <div>
          <h2>Import providers.csv</h2>
          <p>
            Upload provider rows with provider_id, provider_name, website, email, phone, description, verified and featured
            columns. Imported providers replace the in-memory list only.
          </p>
        </div>
        <label className="file-input">
          <span>Choose providers.csv</span>
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
            <h2>Providers</h2>
            <p>{filteredProviders.length} of {providers.length} providers shown</p>
          </div>
        </div>
        <div className="filters provider-filters">
          <label>
            Search providers
            <input
              placeholder="Provider name, ID, website, email, phone or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Website</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Description</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {filteredProviders.map((provider) => (
                <tr key={provider.provider_id}>
                  <td><strong>{provider.provider_name}</strong><small>{provider.provider_id}</small></td>
                  <td><a href={provider.website}>{provider.website}</a></td>
                  <td>{provider.email}</td>
                  <td>{provider.phone}</td>
                  <td>{provider.description}</td>
                  <td className="flags">
                    {provider.verified ? <span className="flag verified">Verified</span> : null}
                    {provider.featured ? <span className="flag featured">Featured</span> : null}
                    {!provider.verified && !provider.featured ? <span className="empty-state">—</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
