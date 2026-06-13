"use client";

import Link from "next/link";
import { ChangeEvent, useRef, useState } from "react";
import { buildCampImportReport, type CampImportReport } from "@/lib/campImportWizardUtils";
import type { Camp, Provider } from "@/lib/types";

type Props = {
  initialProviders: Provider[];
};

function SummaryList({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort(([, firstCount], [, secondCount]) => secondCount - firstCount);

  return (
    <article className="breakdown-card">
      <h3>{title}</h3>
      {entries.length > 0 ? (
        <ul>
          {entries.map(([label, count]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">Upload camps.csv to generate this breakdown.</p>
      )}
    </article>
  );
}

export function CampImportWizard({ initialProviders }: Props) {
  const [report, setReport] = useState<CampImportReport | null>(null);
  const [acceptedCamps, setAcceptedCamps] = useState<Camp[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAcceptedCamps([]);
      setReport(buildCampImportReport(String(reader.result ?? ""), initialProviders));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  function acceptImport() {
    if (!report || report.summary.totalErrors > 0) return;
    setAcceptedCamps(report.camps);
  }

  const summary = report?.summary ?? {
    totalCamps: 0,
    totalErrors: 0,
    totalWarnings: 0,
    campsByProvider: {},
    campsByCounty: {},
    campsByActivityType: {},
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Internal admin · camps import wizard</p>
          <h1>Camps Import Wizard</h1>
          <p>Upload camps.csv, review validation results, then accept clean imports locally in browser memory.</p>
        </div>
        <div className="hero-actions">
          <Link className="button-link secondary" href="/">
            Back to camps
          </Link>
          <Link className="button-link secondary" href="/providers">
            Provider import
          </Link>
        </div>
      </header>

      <section className="panel import-panel">
        <div>
          <h2>Upload camps.csv</h2>
          <p>
            The wizard validates provider relationships, duplicate camp IDs, likely duplicate records, required fields,
            age ranges and date ranges before any local import is accepted.
          </p>
        </div>
        <label className="file-input">
          <span>Choose camps.csv</span>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleUpload} />
        </label>
      </section>

      <section className="stats-grid import-stats" aria-label="Camp import metrics">
        <article><span>Total camps imported</span><strong>{summary.totalCamps}</strong></article>
        <article><span>Total validation errors</span><strong>{summary.totalErrors}</strong></article>
        <article><span>Total warnings</span><strong>{summary.totalWarnings}</strong></article>
      </section>

      <section className="breakdown-grid" aria-label="Camp import breakdowns">
        <SummaryList title="Camps by provider" values={summary.campsByProvider} />
        <SummaryList title="Camps by county" values={summary.campsByCounty} />
        <SummaryList title="Camps by activity type" values={summary.campsByActivityType} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Validation report</h2>
            <p>
              Review this report before import. Imports can only be accepted locally when there are no validation errors.
            </p>
          </div>
          <button type="button" disabled={!report || summary.totalErrors > 0} onClick={acceptImport}>
            Accept import locally
          </button>
        </div>

        {acceptedCamps.length > 0 ? (
          <div className="success-box" role="status">
            Accepted {acceptedCamps.length} camp records locally for this page session. No database was updated.
          </div>
        ) : null}

        {!report ? (
          <p className="empty-state">Upload a camps.csv file to generate a validation report.</p>
        ) : report.issues.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Row</th>
                  <th>Field</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {report.issues.map((issue, index) => (
                  <tr key={`${issue.row}-${issue.message}-${index}`}>
                    <td><span className={issue.level === "error" ? "badge danger" : "badge warning"}>{issue.level}</span></td>
                    <td>{issue.row || "File"}</td>
                    <td>{issue.field ?? "—"}</td>
                    <td>{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="success-box" role="status">
            No validation errors or warnings found. This import is ready to accept locally.
          </div>
        )}
      </section>
    </main>
  );
}
