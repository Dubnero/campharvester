"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { getCamps, getProviders, upsertCamps, upsertProviders } from "@/lib/dataRepository";
import { DiscoveryCamp, DiscoveryPageAnalysis, DiscoveryProvider, extractDiscoveryRecords, recordsToCsv } from "@/lib/discoveryUtils";
import type { Camp, Provider } from "@/lib/types";

type FormState = { sourceUrl: string; providerId: string; providerName: string; county: string; activityType: string; holidayType: string; notes: string };
type AnalysisLog = { sourceUrl: string; discoveredUrls: string[]; crawledUrls: string[]; skippedUrls: Array<{ url: string; reason: string }> };
const blankForm: FormState = { sourceUrl: "", providerId: "", providerName: "", county: "", activityType: "", holidayType: "", notes: "" };
const providerFields: Array<keyof DiscoveryProvider> = ["selected", "needs_review", "confidence", "provider_id", "provider_name", "website", "primary_email", "primary_phone", "primary_county", "activity_category", "provider_type", "status"];
const campFields: Array<keyof DiscoveryCamp> = ["selected", "needs_review", "camp_id", "provider_id", "camp_name", "county", "town", "address", "eircode", "activity_type", "holiday_type", "age_min", "age_max", "start_date", "end_date", "start_time", "end_time", "half_day_or_full_day", "price", "booking_url", "status"];

function label(field: string) { return field.replaceAll("_", " "); }
function asImportProvider(provider: DiscoveryProvider): Provider { const { selected, needs_review, duplicateWarnings, confidence, fieldConfidence, extractionWarnings, ...row } = provider; return { ...row, status: "draft", verified: false, featured: false }; }
function asImportCamp(camp: DiscoveryCamp): Camp { const { selected, needs_review, duplicateWarnings, confidence, fieldConfidence, extractionWarnings, ...row } = camp; return { ...row, status: "draft", verified: false, featured: false }; }

export function DiscoveryAssistant() {
  const [form, setForm] = useState<FormState>(blankForm);
  const [pageText, setPageText] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [providers, setProviders] = useState<DiscoveryProvider[]>([]);
  const [camps, setCamps] = useState<DiscoveryCamp[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analysisLog, setAnalysisLog] = useState<AnalysisLog | null>(null);
  const [pageAnalyses, setPageAnalyses] = useState<DiscoveryPageAnalysis[]>([]);
  const [fetchMessage, setFetchMessage] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const selectedProviders = useMemo(() => providers.filter((provider) => provider.selected && !provider.duplicateWarnings.some((warning) => warning.startsWith("Existing provider found"))), [providers]);
  const selectedCamps = useMemo(() => camps.filter((camp) => camp.selected && camp.duplicateWarnings.length === 0), [camps]);

  async function analyse(event: FormEvent) {
    event.preventDefault();
    setImportSummary("");
    setWarnings([]);
    setAnalysisLog(null);
    setPageAnalyses([]);
    let text = pageText;
    if (!manualMode) {
      const response = await fetch("/api/discovery/fetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: form.sourceUrl }) });
      const result = await response.json();
      if (!response.ok) { setManualMode(true); setFetchMessage(result.error ?? "Fetch failed. Paste page text instead."); return; }
      text = result.text;
      setPageText(text);
      setAnalysisLog(result.analysisLog ?? null);
      setPageAnalyses(result.pages ?? []);
      setWarnings(result.warnings ?? []);
      setFetchMessage(`Fetched ${result.pages?.length ?? 1} page(s) successfully (${text.length} readable characters).`);
    }
    const extraction = extractDiscoveryRecords({ sourceUrl: form.sourceUrl, providerId: form.providerId, providerName: form.providerName, county: form.county, activityType: form.activityType, holidayType: form.holidayType, notes: form.notes }, text);
    setProviders(extraction.providers);
    setCamps(extraction.camps);
    setWarnings((current) => Array.from(new Set([...current, ...extraction.warnings])));
    await detectDuplicates(extraction.providers, extraction.camps);
  }

  async function detectDuplicates(nextProviders = providers, nextCamps = camps) {
    const [existingProviders, existingCamps] = await Promise.all([getProviders(), getCamps()]);
    const flaggedProviders = nextProviders.map((provider) => {
      const match = existingProviders.data.find((existing) => existing.provider_id === provider.provider_id || (provider.provider_name && existing.provider_name.toLowerCase() === provider.provider_name.toLowerCase()) || (provider.website && existing.website === provider.website));
      if (!match) return provider;
      return { ...provider, provider_id: match.provider_id, duplicateWarnings: [`Existing provider found: ${match.provider_id} / ${match.provider_name}`], selected: false };
    });
    const flaggedCamps = nextCamps.map((camp) => {
      const providerId = flaggedProviders.find((provider) => provider.provider_id === camp.provider_id || provider.provider_name === nextProviders[0]?.provider_name)?.provider_id ?? camp.provider_id;
      const updatedCamp = { ...camp, provider_id: providerId };
      const warnings = existingCamps.data.filter((existing) => existing.camp_id === updatedCamp.camp_id || (existing.provider_id === updatedCamp.provider_id && existing.camp_name.toLowerCase() === updatedCamp.camp_name.toLowerCase() && existing.town.toLowerCase() === updatedCamp.town.toLowerCase() && existing.start_date === updatedCamp.start_date)).map((existing) => `Existing camp found: ${existing.camp_id} / ${existing.camp_name}`);
      return { ...updatedCamp, duplicateWarnings: warnings, selected: warnings.length === 0 && updatedCamp.selected };
    });
    setProviders(flaggedProviders);
    setCamps(flaggedCamps);
    const repoWarnings = [existingProviders.error, existingCamps.error].filter(Boolean) as string[];
    if (repoWarnings.length) setWarnings((current) => [...current, ...repoWarnings.map((warning) => `Duplicate check warning: ${warning}`)]);
  }

  function updateProvider(index: number, field: keyof DiscoveryProvider, value: string | boolean | number) { setProviders((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)); }
  function updateCamp(index: number, field: keyof DiscoveryCamp, value: string | boolean | number) { setCamps((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)); }
  function downloadCsv() {
    const csv = recordsToCsv([...providers, ...camps]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "discovery-assistant-export.csv"; link.click(); URL.revokeObjectURL(url);
  }
  async function importSelected() {
    const [providerResult, campResult] = await Promise.all([selectedProviders.length ? upsertProviders(selectedProviders.map(asImportProvider)) : Promise.resolve({ data: [], error: null }), selectedCamps.length ? upsertCamps(selectedCamps.map(asImportCamp)) : Promise.resolve({ data: [], error: null })]);
    setImportSummary(`Imported ${providerResult.data.length} provider(s) and ${campResult.data.length} camp(s). ${[providerResult.error, campResult.error].filter(Boolean).join(" ")}`);
  }

  return <main className="app-shell"><header className="hero"><div><p className="eyebrow">Internal admin · draft discovery</p><h1>Discovery Assistant</h1><p>Analyse provider and camp pages, review deterministic draft records, then import selected unverified drafts.</p></div><div className="hero-actions"><Link className="button-link" href="/">Dashboard</Link></div></header>
    <section className="panel"><h2>Analyse source</h2><form className="edit-form" onSubmit={analyse}>{Object.keys(blankForm).map((key) => <label key={key}>{label(key)}<input value={form[key as keyof FormState]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={key === "sourceUrl"} /></label>)}<div className="form-actions wide-field"><button type="submit">Analyse page</button><button type="button" className="secondary" onClick={() => setManualMode(true)}>Paste page text instead</button></div></form>{manualMode ? <label className="wide-field">Paste page text instead<textarea rows={8} value={pageText} onChange={(event) => setPageText(event.target.value)} /></label> : null}<p>{fetchMessage}</p></section>
    <section className="stats-grid"><article><span>Source URL analysed</span><strong>{form.sourceUrl || "—"}</strong></article><article><span>Text extracted length</span><strong>{pageText.length}</strong></article><article><span>Possible providers</span><strong>{providers.length}</strong></article><article><span>Possible camps</span><strong>{camps.length}</strong></article></section>
    <AnalysisLogPanel log={analysisLog} pages={pageAnalyses} />
    <ExtractionSummary providers={providers} camps={camps} warnings={warnings} />
    <ReviewTable title="Providers" fields={providerFields} rows={providers} update={updateProvider} remove={(index) => setProviders((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} />
    <CampCards camps={camps} update={updateCamp} remove={(index) => setCamps((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} />
    <details className="panel"><summary>Advanced spreadsheet view</summary><ReviewTable title="Camps" fields={campFields} rows={camps} update={updateCamp} remove={(index) => setCamps((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} /></details>
    <section className="panel"><div className="form-actions"><button type="button" className="secondary" onClick={downloadCsv} disabled={!providers.length && !camps.length}>Export CSV</button><button type="button" onClick={importSelected} disabled={!selectedProviders.length && !selectedCamps.length}>Import selected drafts</button></div>{importSummary ? <p>{importSummary}</p> : null}</section></main>;
}

function AnalysisLogPanel({ log, pages }: { log: AnalysisLog | null; pages: DiscoveryPageAnalysis[] }) {
  if (!log && pages.length === 0) return null;
  return <section className="panel"><h2>URL analysis log</h2>{log ? <div className="summary-list"><p><strong>Source URL:</strong> {log.sourceUrl}</p><p><strong>URLs discovered:</strong> {log.discoveredUrls.length}</p><ul>{log.discoveredUrls.slice(0, 20).map((url) => <li key={url}>{url}</li>)}</ul><p><strong>URLs crawled:</strong> {log.crawledUrls.length}</p><ul>{log.crawledUrls.map((url) => <li key={url}>{url}</li>)}</ul><p><strong>URLs skipped:</strong> {log.skippedUrls.length}</p><ul>{log.skippedUrls.slice(0, 30).map((item) => <li key={item.url}>{item.url} — {item.reason}</li>)}</ul></div> : null}<div className="table-wrap"><table><thead><tr><th>URL</th><th>Readable text length</th><th>Camp candidates</th><th>Dynamic warning</th></tr></thead><tbody>{pages.map((page) => <tr key={page.url}><td>{page.url}</td><td>{page.readableTextLength}</td><td>{page.candidateCount}</td><td>{page.dynamicWarning ? "Yes" : "No"}</td></tr>)}</tbody></table></div></section>;
}

function ReviewTable<T extends DiscoveryProvider | DiscoveryCamp>({ title, fields, rows, update, remove }: { title: string; fields: Array<keyof T>; rows: T[]; update: (index: number, field: keyof T, value: string | boolean | number) => void; remove: (index: number) => void }) {
  return <section className="panel"><h2>{title}</h2><div className="table-wrap"><table><thead><tr>{fields.map((field) => <th key={String(field)}>{label(String(field))}</th>)}<th>Duplicates</th><th>Delete</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{fields.map((field) => { const value = row[field]; const checkbox = typeof value === "boolean"; return <td key={String(field)}>{checkbox ? <input type="checkbox" checked={Boolean(value)} onChange={(event) => update(index, field, event.target.checked)} /> : <input value={String(value ?? "")} onChange={(event) => update(index, field, field === "age_min" || field === "age_max" ? Number(event.target.value) : event.target.value)} />}</td>; })}<td>{row.duplicateWarnings.map((warning) => <small key={warning}>{warning}</small>)}</td><td><button type="button" className="secondary" onClick={() => remove(index)}>Delete</button></td></tr>)}</tbody></table></div></section>;
}

function confidenceClass(score: number) {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

function ConfidenceBadge({ score }: { score: number }) {
  return <span className={`badge ${confidenceClass(score)}`}>{score}%</span>;
}

function ExtractionSummary({ providers, camps, warnings }: { providers: DiscoveryProvider[]; camps: DiscoveryCamp[]; warnings: string[] }) {
  if (!providers.length && !camps.length && !warnings.length) return null;
  const providerConfidence = providers[0]?.confidence ?? 0;
  const duplicateProvider = providers.some((provider) => provider.duplicateWarnings.some((warning) => warning.startsWith("Existing provider found")));
  const summaryWarnings = [...warnings, duplicateProvider ? "Existing provider found" : "", ...camps.flatMap((camp) => camp.duplicateWarnings), ...camps.flatMap((camp) => camp.extractionWarnings.map((warning) => `${camp.camp_name}: ${warning}`))].filter(Boolean);
  return <section className="panel extraction-summary"><h2>Extraction Summary</h2><div className="summary-pills"><span>Provider confidence <ConfidenceBadge score={providerConfidence} /></span><span>{camps.length} camp(s) found</span></div>{summaryWarnings.length ? <div className="warning-box"><strong>Warnings</strong><ul>{Array.from(new Set(summaryWarnings)).map((warning) => <li key={warning}>⚠ {warning}</li>)}</ul></div> : null}</section>;
}

function CampCards({ camps, update, remove }: { camps: DiscoveryCamp[]; update: (index: number, field: keyof DiscoveryCamp, value: string | boolean | number) => void; remove: (index: number) => void }) {
  return <section className="panel"><h2>Camp review cards</h2>{camps.length === 0 ? <p className="empty-state">No high-confidence camp offerings found. Generic navigation items are ignored.</p> : <div className="camp-review-grid">{camps.map((camp, index) => <article className="camp-review-card" key={`${camp.camp_id}-${index}`}><div className="camp-card-header"><label className="checkbox-row"><input type="checkbox" checked={camp.selected} onChange={(event) => update(index, "selected", event.target.checked)} /> Select</label><ConfidenceBadge score={camp.confidence} /></div><h3>{camp.camp_name}</h3><div className="review-fields"><ReviewItem label="Location" value={[camp.town, camp.county].filter(Boolean).join(", ") || "—"} confidence={Math.max(camp.fieldConfidence.town ?? 0, camp.fieldConfidence.county ?? 0)} /><ReviewItem label="Dates" value={[camp.start_date, camp.end_date].filter(Boolean).join(" - ") || "—"} confidence={camp.fieldConfidence.start_date ?? 0} /><ReviewItem label="Age" value={camp.age_min || camp.age_max ? `${camp.age_min || "?"}-${camp.age_max || "?"}` : "—"} confidence={camp.fieldConfidence.age ?? 0} /><ReviewItem label="Price" value={camp.price || "—"} confidence={camp.fieldConfidence.price ?? 0} /><ReviewItem label="Activity" value={camp.activity_type || "—"} confidence={camp.fieldConfidence.activity_type ?? 0} /><ReviewItem label="Booking" value={camp.booking_url || "—"} confidence={camp.fieldConfidence.booking_url ?? 0} /></div>{camp.extractionWarnings.length || camp.duplicateWarnings.length ? <div className="warning-box compact"><strong>Warnings</strong>{[...camp.duplicateWarnings, ...camp.extractionWarnings].map((warning) => <small key={warning}>⚠ {warning}</small>)}</div> : null}<details><summary>Edit</summary><div className="edit-form card-edit">{campFields.map((field) => { const value = camp[field]; const checkbox = typeof value === "boolean"; return <label key={String(field)}>{label(String(field))}{checkbox ? <input type="checkbox" checked={Boolean(value)} onChange={(event) => update(index, field, event.target.checked)} /> : <input value={String(value ?? "")} onChange={(event) => update(index, field, field === "age_min" || field === "age_max" || field === "confidence" ? Number(event.target.value) : event.target.value)} />}</label>; })}</div></details><button type="button" className="secondary" onClick={() => remove(index)}>Delete</button></article>)}</div>}</section>;
}

function ReviewItem({ label, value, confidence }: { label: string; value: string; confidence: number }) {
  return <div><span>{label}</span><strong>{value}</strong><ConfidenceBadge score={confidence} /></div>;
}
