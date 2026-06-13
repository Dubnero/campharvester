"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { campsToCsv } from "@/lib/campUtils";
import {
  buildCampImportSummary,
  campsFromImportSummary,
  getCampImportTemplateHeaders,
  type CampImportSummary,
} from "@/lib/campImportWizardUtils";
import { loadStoredProviders, type ProviderSource } from "@/lib/providerStorage";
import { Camp, Provider } from "@/lib/types";

type Props = {
  initialCamps: Camp[];
  providers: Provider[];
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function CampImportWizard({ initialCamps, providers }: Props) {
  const [summary, setSummary] = useState<CampImportSummary | null>(null);
  const [acceptedCamps, setAcceptedCamps] = useState<Camp[]>(initialCamps);
  const [validationProviders, setValidationProviders] = useState(providers);
  const [providerSource, setProviderSource] = useState<ProviderSource>("mock providers");
  const [acceptedAt, setAcceptedAt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedProviders = loadStoredProviders();
    if (!storedProviders) return;

    setValidationProviders(storedProviders);
    setProviderSource("imported providers");
  }, []);

  const canAccept = Boolean(summary && summary.totalRows > 0 && summary.errors.length === 0);
  const holidaySummary = useMemo(() => Object.entries(summary?.holidayTypeCounts ?? {}), [summary]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setAcceptedAt("");
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSummary(buildCampImportSummary(String(reader.result ?? ""), validationProviders));
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  }

  function handleAcceptImport() {
    if (!summary || summary.errors.length > 0) return;
    setAcceptedCamps(campsFromImportSummary(summary));
    setAcceptedAt(new Date().toLocaleString());
  }

  function handleDownloadTemplate() {
    downloadText("campharvester-camps-import-template.csv", `${getCampImportTemplateHeaders().join(",")}\n`);
  }

  function handleDownloadAccepted() {
    downloadText("campharvester-accepted-camps.csv", campsToCsv(acceptedCamps));
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Admin import wizard</p>
          <h1>Camps Import Wizard</h1>
          <p>
            Validate camp CSV files against existing providers, duplicate camp IDs, holiday values and age ranges before
            accepting an import.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button-link secondary" href="/">
            Back to dashboard
          </Link>
          <button type="button" className="secondary" onClick={handleDownloadTemplate}>
            Download CSV template
          </button>
        </div>
      </header>

      <section className="stats-grid" aria-label="Import context">
        <article><span>Existing camps</span><strong>{initialCamps.length}</strong></article>
        <article><span>Providers available</span><strong>{validationProviders.length}</strong><small>{providerSource}</small></article>
        <article><span>Rows parsed</span><strong>{summary?.totalRows ?? 0}</strong></article>
        <article><span>Valid rows</span><strong>{summary?.validRows ?? 0}</strong></article>
        <article><span>Rows with issues</span><strong>{summary?.invalidRows ?? 0}</strong></article>
        <article><span>Accepted camps</span><strong>{acceptedCamps.length}</strong></article>
      </section>

      <section className="panel import-panel">
        <div>
          <h2>1. Upload camps CSV</h2>
          <p>Use camp_id or id for the camp identifier column. Provider IDs must exist in the currently available imported providers or mock provider fallback.</p>
        </div>
        <label className="file-input">
          <span>Choose CSV file</span>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        </label>
      </section>

      {summary ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>2. Review import summary</h2>
              <p>
                {summary.totalRows} rows parsed · {summary.providerCount} provider IDs referenced · validating against {validationProviders.length} {providerSource} · review all issues
                before accepting.
              </p>
            </div>
            <button type="button" disabled={!canAccept} onClick={handleAcceptImport}>
              Accept import
            </button>
          </div>

          {summary.errors.length > 0 ? (
            <div className="error-box import-feedback" role="alert">
              <strong>Import blocked by validation issues</strong>
              <ul>{summary.errors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          ) : (
            <div className="success-box import-feedback" role="status">
              <strong>Ready to import</strong>
              <p>All rows passed provider_id, duplicate camp_id, holiday_type and age range validation.</p>
            </div>
          )}

          <div className="summary-grid">
            <article>
              <h3>Holiday types</h3>
              {holidaySummary.length > 0 ? (
                <ul>{holidaySummary.map(([holidayType, count]) => <li key={holidayType}>{holidayType}: {count}</li>)}</ul>
              ) : <p className="empty-state">No holiday data parsed.</p>}
            </article>
            <article>
              <h3>Accepted output</h3>
              <p>Accepted imports replace the wizard preview only; existing provider import flows are unchanged.</p>
              <button type="button" className="secondary" onClick={handleDownloadAccepted}>Export accepted CSV</button>
              {acceptedAt ? <p className="empty-state">Last accepted {acceptedAt}</p> : null}
            </article>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Row</th><th>camp_id</th><th>Camp</th><th>Provider ID</th><th>Holiday</th><th>Ages</th><th>Status</th></tr>
              </thead>
              <tbody>
                {summary.rows.map(({ rowNumber, camp }) => (
                  <tr key={`${rowNumber}-${camp.id}`}>
                    <td>{rowNumber}</td>
                    <td>{camp.id}</td>
                    <td><strong>{camp.camp_name}</strong><small>{camp.town || camp.address}, {camp.county}</small></td>
                    <td>{camp.provider_id}</td>
                    <td>{camp.holiday_type}</td>
                    <td>{camp.age_min}–{camp.age_max}</td>
                    <td><span className="badge muted">{camp.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
