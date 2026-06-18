"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { getCamps, getProviders, upsertCamps, upsertProviders } from "@/lib/dataRepository";
import { DiscoveryCamp, DiscoveryProvider, extractDiscoveryRecords, recordsToCsv } from "@/lib/discoveryUtils";
import type { Camp, Provider } from "@/lib/types";

type FormState = { sourceUrl: string; providerId: string; providerName: string; county: string; activityType: string; holidayType: string; notes: string };
const blankForm: FormState = { sourceUrl: "", providerId: "", providerName: "", county: "", activityType: "", holidayType: "", notes: "" };
const providerFields: Array<keyof DiscoveryProvider> = ["selected", "needs_review", "provider_id", "provider_name", "website", "primary_email", "primary_phone", "primary_county", "activity_category", "provider_type", "status"];
const campFields: Array<keyof DiscoveryCamp> = ["selected", "needs_review", "camp_id", "provider_id", "camp_name", "county", "town", "address", "eircode", "activity_type", "holiday_type", "age_min", "age_max", "start_date", "end_date", "start_time", "end_time", "half_day_or_full_day", "price", "booking_url", "status"];

function label(field: string) { return field.replaceAll("_", " "); }
function asImportProvider(provider: DiscoveryProvider): Provider { const { selected, needs_review, duplicateWarnings, ...row } = provider; return { ...row, status: "draft", verified: false, featured: false }; }
function asImportCamp(camp: DiscoveryCamp): Camp { const { selected, needs_review, duplicateWarnings, ...row } = camp; return { ...row, status: "draft", verified: false, featured: false }; }

export function DiscoveryAssistant() {
  const [form, setForm] = useState<FormState>(blankForm);
  const [pageText, setPageText] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [providers, setProviders] = useState<DiscoveryProvider[]>([]);
  const [camps, setCamps] = useState<DiscoveryCamp[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fetchMessage, setFetchMessage] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const selectedProviders = useMemo(() => providers.filter((provider) => provider.selected && provider.duplicateWarnings.length === 0), [providers]);
  const selectedCamps = useMemo(() => camps.filter((camp) => camp.selected && camp.duplicateWarnings.length === 0), [camps]);

  async function analyse(event: FormEvent) {
    event.preventDefault();
    setImportSummary("");
    setWarnings([]);
    let text = pageText;
    if (!manualMode) {
      const response = await fetch("/api/discovery/fetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: form.sourceUrl }) });
      const result = await response.json();
      if (!response.ok) { setManualMode(true); setFetchMessage(result.error ?? "Fetch failed. Paste page text instead."); return; }
      text = result.text;
      setPageText(text);
      setFetchMessage(`Fetched page successfully (${text.length} readable characters).`);
    }
    const extraction = extractDiscoveryRecords({ sourceUrl: form.sourceUrl, providerId: form.providerId, providerName: form.providerName, county: form.county, activityType: form.activityType, holidayType: form.holidayType, notes: form.notes }, text);
    setProviders(extraction.providers);
    setCamps(extraction.camps);
    setWarnings(extraction.warnings);
    await detectDuplicates(extraction.providers, extraction.camps);
  }

  async function detectDuplicates(nextProviders = providers, nextCamps = camps) {
    const [existingProviders, existingCamps] = await Promise.all([getProviders(), getCamps()]);
    const flaggedProviders = nextProviders.map((provider) => {
      const warnings = existingProviders.data.filter((existing) => existing.provider_id === provider.provider_id || (provider.provider_name && existing.provider_name.toLowerCase() === provider.provider_name.toLowerCase()) || (provider.website && existing.website === provider.website)).map((existing) => `Likely duplicate provider: ${existing.provider_id} / ${existing.provider_name}`);
      return { ...provider, duplicateWarnings: warnings, selected: warnings.length === 0 && provider.selected };
    });
    const flaggedCamps = nextCamps.map((camp) => {
      const warnings = existingCamps.data.filter((existing) => existing.camp_id === camp.camp_id || (existing.provider_id === camp.provider_id && existing.camp_name.toLowerCase() === camp.camp_name.toLowerCase() && existing.town.toLowerCase() === camp.town.toLowerCase() && existing.start_date === camp.start_date)).map((existing) => `Likely duplicate camp: ${existing.camp_id} / ${existing.camp_name}`);
      return { ...camp, duplicateWarnings: warnings, selected: warnings.length === 0 && camp.selected };
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
    {warnings.length ? <section className="panel error-box"><strong>Warnings</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}
    <ReviewTable title="Providers" fields={providerFields} rows={providers} update={updateProvider} remove={(index) => setProviders((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} />
    <ReviewTable title="Camps" fields={campFields} rows={camps} update={updateCamp} remove={(index) => setCamps((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} />
    <section className="panel"><div className="form-actions"><button type="button" className="secondary" onClick={downloadCsv} disabled={!providers.length && !camps.length}>Export CSV</button><button type="button" onClick={importSelected} disabled={!selectedProviders.length && !selectedCamps.length}>Import selected drafts</button></div>{importSummary ? <p>{importSummary}</p> : null}</section></main>;
}

function ReviewTable<T extends DiscoveryProvider | DiscoveryCamp>({ title, fields, rows, update, remove }: { title: string; fields: Array<keyof T>; rows: T[]; update: (index: number, field: keyof T, value: string | boolean | number) => void; remove: (index: number) => void }) {
  return <section className="panel"><h2>{title}</h2><div className="table-wrap"><table><thead><tr>{fields.map((field) => <th key={String(field)}>{label(String(field))}</th>)}<th>Duplicates</th><th>Delete</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{fields.map((field) => { const value = row[field]; const checkbox = typeof value === "boolean"; return <td key={String(field)}>{checkbox ? <input type="checkbox" checked={Boolean(value)} onChange={(event) => update(index, field, event.target.checked)} /> : <input value={String(value ?? "")} onChange={(event) => update(index, field, field === "age_min" || field === "age_max" ? Number(event.target.value) : event.target.value)} />}</td>; })}<td>{row.duplicateWarnings.map((warning) => <small key={warning}>{warning}</small>)}</td><td><button type="button" className="secondary" onClick={() => remove(index)}>Delete</button></td></tr>)}</tbody></table></div></section>;
}
