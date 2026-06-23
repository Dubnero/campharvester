"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { getCamps, getProviders, upsertCamps, upsertProviders } from "@/lib/dataRepository";
import { DiscoveryCamp, DiscoveryPageAnalysis, DiscoveryProvider, ExtractionPipelineDebug, buildExtractionDebug, dedupeDiscoveryCamps, extractDiscoveryRecords, recordsToCsv } from "@/lib/discoveryUtils";
import type { Camp, Provider } from "@/lib/types";

type FormState = { sourceUrl: string; providerId: string; providerName: string; county: string; activityType: string; holidayType: string; notes: string };
type AnalysisLog = { sourceUrl: string; discoveredUrls: string[]; crawledUrls: string[]; skippedUrls: Array<{ url: string; reason: string }>; starcamp?: { listingPagesCrawled: number; paginationPagesDiscovered: number; productUrlsDiscovered: number; productUrlsCrawled: number; productUrlsSkipped: number } };
type ManualPage = { url: string; text: string };
type DebugCounts = { productPagesCrawled: number; rawCampRecordsExtracted: number; uniqueCampSchedulesAfterDedupe: number; duplicateCampRecordsRemoved: number };
type DebugExportPayload = { sourceUrl: string; generatedAt: string; crawlMetrics: AnalysisLog | null; urlStatus: DiscoveryPageAnalysis[]; pagesCrawled: string[]; debugCounts: DebugCounts; productUrls: { discovered: string[]; crawled: string[]; skipped: Array<{ url: string; reason: string }>; skipped_product_urls_due_to_limit: string[] }; debugItems: ExtractionPipelineDebug[] };
type CampReviewFilters = { county: string; town: string; provider: string; holidayType: string; activityType: string; startDate: string; endDate: string; priceStatus: "" | "present" | "missing"; needsReview: "" | "yes" | "no"; confidence: string; sourceMethod: "" | "crawler" | "manual_paste"; search: string };
const blankForm: FormState = { sourceUrl: "", providerId: "", providerName: "", county: "", activityType: "", holidayType: "", notes: "" };
const blankDebugCounts: DebugCounts = { productPagesCrawled: 0, rawCampRecordsExtracted: 0, uniqueCampSchedulesAfterDedupe: 0, duplicateCampRecordsRemoved: 0 };
const blankCampReviewFilters: CampReviewFilters = { county: "", town: "", provider: "", holidayType: "", activityType: "", startDate: "", endDate: "", priceStatus: "", needsReview: "", confidence: "", sourceMethod: "", search: "" };
const providerFields: Array<keyof DiscoveryProvider> = ["selected", "needs_review", "confidence", "provider_id", "provider_name", "website", "primary_email", "primary_phone", "primary_county", "activity_category", "provider_type", "status"];
const campFields: Array<keyof DiscoveryCamp> = ["selected", "needs_review", "camp_id", "provider_id", "camp_name", "county", "town", "address", "eircode", "activity_type", "holiday_type", "age_min", "age_max", "start_date", "end_date", "start_time", "end_time", "half_day_or_full_day", "price", "booking_url", "status"];

function label(field: string) { return field.replaceAll("_", " "); }
function uniqueOptions(values: string[]) { return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)); }
function normalizedIncludes(value: string | number | boolean | undefined, search: string) { return String(value ?? "").toLowerCase().includes(search.trim().toLowerCase()); }
function campStableKey(camp: Pick<DiscoveryCamp, "camp_id" | "provider_id" | "camp_name" | "town" | "start_date" | "end_date" | "booking_url">) { return [camp.camp_id, camp.provider_id, camp.camp_name, camp.town, camp.start_date, camp.end_date, camp.booking_url].map((value) => String(value ?? "").trim().toLowerCase()).join("|"); }
function methodBadge(method: DiscoveryProvider["source_method"] | DiscoveryCamp["source_method"]) { return method === "manual_paste" ? "📋 Manual" : "🕷 Crawled"; }
function asImportProvider(provider: DiscoveryProvider): Provider { const { selected, needs_review, duplicateWarnings, confidence, fieldConfidence, extractionWarnings, source_method, ...row } = provider; return { ...row, status: "draft", verified: false, featured: false }; }
const developerDebug = true;

function normalizeProviderMatchValue(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function providerMatches(existing: Provider, provider: DiscoveryProvider) {
  const existingName = normalizeProviderMatchValue(existing.provider_name || "");
  const providerName = normalizeProviderMatchValue(provider.provider_name || "");
  const existingWebsite = normalizeProviderMatchValue(existing.website || "");
  const providerWebsite = normalizeProviderMatchValue(provider.website || "");
  return existing.provider_id === provider.provider_id || Boolean(providerName && existingName === providerName) || Boolean(provider.provider_name === "Bricks4Kidz" && existingName.includes("bricks4kidz")) || Boolean(providerWebsite && existingWebsite === providerWebsite);
}
function nextProviderId(existingProviders: Provider[], draftProviders: DiscoveryProvider[]) {
  const ids = [...existingProviders.map((provider) => provider.provider_id), ...draftProviders.map((provider) => provider.provider_id)].map((id) => id.match(/^P(\d{4})$/)?.[1]).filter(Boolean).map(Number);
  return `P${String((ids.length ? Math.max(...ids) : 0) + 1).padStart(4, "0")}`;
}

function asImportCamp(camp: DiscoveryCamp): Camp { const { selected, needs_review, duplicateWarnings, confidence, fieldConfidence, extractionWarnings, source_method, ...row } = camp; return { ...row, status: "draft", verified: false, featured: false }; }
function downloadTextFile(filename: string, text: string, type = "text/plain;charset=utf-8") { const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function debugHostSlug(sourceUrl: string) { try { return new URL(sourceUrl).hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "source"; } catch { return "source"; } }
function debugTimestamp(date = new Date()) { const pad = (value: number) => String(value).padStart(2, "0"); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`; }
function debugFilename(sourceUrl: string, extension: "json" | "txt") { return `discovery-debug-${debugHostSlug(sourceUrl)}-${debugTimestamp()}.${extension}`; }
function isProductCampUrl(url: string) { try { return /\/product\/[^/]*-camp\/?$/i.test(new URL(url).pathname); } catch { return false; } }
function buildDebugExportPayload(sourceUrl: string, analysisLog: AnalysisLog | null, pages: DiscoveryPageAnalysis[], items: ExtractionPipelineDebug[], debugCounts: DebugCounts): DebugExportPayload {
  const skipped = analysisLog?.skippedUrls ?? [];
  return { sourceUrl, generatedAt: new Date().toISOString(), crawlMetrics: analysisLog, urlStatus: pages, pagesCrawled: pages.filter((page) => page.status === "analysed").map((page) => page.url), debugCounts, productUrls: { discovered: (analysisLog?.discoveredUrls ?? []).filter(isProductCampUrl), crawled: (analysisLog?.crawledUrls ?? []).filter(isProductCampUrl), skipped: skipped.filter((item) => isProductCampUrl(item.url)), skipped_product_urls_due_to_limit: skipped.filter((item) => isProductCampUrl(item.url) && /limit/i.test(item.reason)).map((item) => item.url) }, debugItems: items };
}
function formatDebugTxt(payload: DebugExportPayload) {
  const lines: string[] = [];
  lines.push("Discovery Assistant Developer Debug", `Generated: ${payload.generatedAt}`, `Source URL: ${payload.sourceUrl}`, "");
  lines.push("Crawl metrics", JSON.stringify(payload.crawlMetrics, null, 2), "", "Debug counts", JSON.stringify(payload.debugCounts, null, 2), "");
  lines.push("Product URLs", `Discovered (${payload.productUrls.discovered.length}):`, ...payload.productUrls.discovered.map((url) => `- ${url}`), `Fetched (${payload.productUrls.crawled.length}):`, ...payload.productUrls.crawled.map((url) => `- ${url}`), `Skipped (${payload.productUrls.skipped.length}):`, ...payload.productUrls.skipped.map((item) => `- ${item.url} (${item.reason})`), `Skipped due to limit (${payload.productUrls.skipped_product_urls_due_to_limit.length}):`, ...payload.productUrls.skipped_product_urls_due_to_limit.map((url) => `- ${url}`), "");
  lines.push("URL status", ...payload.urlStatus.map((page) => `- ${page.status.toUpperCase()} ${page.url} | text=${page.readableTextLength} | candidates=${page.candidateCount} | ${page.extractionBlocked ? "extraction blocked" : "extractable"}${page.failureReason ? ` | ${page.failureReason}` : ""}`), "");
  for (const item of payload.debugItems) {
    lines.push("==============================", `Debug page: ${item.sourceUrl}`, `Method: ${item.sourceMethod}`, "1. Raw extracted text", item.rawTextPreview || "—", "", "2. Extraction pipeline", ...item.stages.map((stage) => `${stage.passed ? "✓" : "✗"} ${stage.label}: ${stage.count}`), "", "3. Regex matches");
    lines.push(...(item.regexMatches.length ? item.regexMatches.map((match) => `- ${match.type}: ${match.value}`) : ["No regex matches found."]), "", "4. Candidate rows");
    lines.push(...(item.candidateRows.length ? item.candidateRows.map((row, index) => `Candidate ${index + 1}\n${row.extractedText}\nParsed fields:\n${JSON.stringify(row.parsedFields, null, 2)}\nConfidence: ${row.confidence}%\nValidation failures: ${row.validationFailures.join(", ") || "none"}`) : ["No candidate rows created."]), "", "5. Validation failures");
    lines.push(...(item.validationFailures.length ? item.validationFailures.map((failure) => `Rejected: ${failure}`) : ["No validation failures recorded."]), "", "6. Final camp objects", JSON.stringify(item.finalCampObjects, null, 2), "");
  }
  return lines.join("\n");
}

export function DiscoveryAssistant() {
  const [form, setForm] = useState<FormState>(blankForm);
  const [pageText, setPageText] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualPages, setManualPages] = useState<Record<string, ManualPage>>({});
  const [activeManualUrl, setActiveManualUrl] = useState("");
  const [manualDraft, setManualDraft] = useState("");
  const [providers, setProviders] = useState<DiscoveryProvider[]>([]);
  const [camps, setCamps] = useState<DiscoveryCamp[]>([]);
  const [selectedCampKeys, setSelectedCampKeys] = useState<Set<string>>(new Set());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analysisLog, setAnalysisLog] = useState<AnalysisLog | null>(null);
  const [pageAnalyses, setPageAnalyses] = useState<DiscoveryPageAnalysis[]>([]);
  const [fetchMessage, setFetchMessage] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const [debugItems, setDebugItems] = useState<ExtractionPipelineDebug[]>([]);
  const [debugCounts, setDebugCounts] = useState<DebugCounts>(blankDebugCounts);
  const selectedProviders = useMemo(() => providers.filter((provider) => provider.selected && !provider.duplicateWarnings.some((warning) => warning.startsWith("Existing provider found"))), [providers]);
  const campsWithSelection = useMemo(() => camps.map((camp) => ({ ...camp, selected: selectedCampKeys.has(campStableKey(camp)) })), [camps, selectedCampKeys]);
  const selectedCamps = useMemo(() => campsWithSelection.filter((camp) => selectedCampKeys.has(campStableKey(camp)) && camp.duplicateWarnings.length === 0), [campsWithSelection, selectedCampKeys]);

  function mergeExtraction(pages: DiscoveryPageAnalysis[], manual: Record<string, ManualPage>) {
    const inputs = [
      ...pages.filter((page) => page.status === "analysed" && page.text && !page.extractionBlocked).map((page) => ({ url: page.url, text: page.text ?? "", method: page.sourceMethod })),
      ...Object.values(manual).filter((page) => page.text.trim()).map((page) => ({ url: page.url, text: page.text, method: "manual_paste" as const })),
    ];
    const debugInputs = [
      ...pages.filter((page) => page.status === "analysed" && page.text).map((page) => ({ url: page.url, text: page.text ?? "", method: page.sourceMethod })),
      ...Object.values(manual).filter((page) => page.text.trim()).map((page) => ({ url: page.url, text: page.text, method: "manual_paste" as const })),
    ];
    if (developerDebug) setDebugItems(debugInputs.map((input) => buildExtractionDebug({ sourceUrl: input.url, providerId: form.providerId, providerName: form.providerName, county: form.county, activityType: form.activityType, holidayType: form.holidayType, notes: form.notes }, input.text, input.method)));
    const extracted = inputs.map((input) => extractDiscoveryRecords({ sourceUrl: input.url, providerId: form.providerId, providerName: form.providerName, county: form.county, activityType: form.activityType, holidayType: form.holidayType, notes: form.notes }, input.text, input.method));
    const providerMap = new Map<string, DiscoveryProvider>();
    for (const provider of extracted.flatMap((item) => item.providers)) {
      const key = provider.provider_id || provider.provider_name.toLowerCase() || provider.website;
      const existing = providerMap.get(key);
      if (!existing || provider.confidence > existing.confidence || existing.source_method === "crawler") providerMap.set(key, existing ? { ...provider, duplicateWarnings: existing.duplicateWarnings } : provider);
    }
    const rawCamps = extracted.flatMap((item) => item.camps);
    const mergedCamps = dedupeDiscoveryCamps(rawCamps);
    const mergedWarnings = Array.from(new Set(extracted.flatMap((item) => item.warnings))).filter((warning) => !(mergedCamps.some((camp) => camp.provider_id === "starcamp" && camp.confidence >= 60) && warning === "No high-confidence camp offerings found; generic navigation items were ignored."));
    return { providers: Array.from(providerMap.values()), camps: mergedCamps, warnings: mergedWarnings, rawCampCount: rawCamps.length };
  }

  async function applyExtraction(pages = pageAnalyses, manual = manualPages) {
    const extraction = mergeExtraction(pages, manual);
    setDebugCounts({ productPagesCrawled: pages.filter((page) => page.status === "analysed" && isProductCampUrl(page.url)).length, rawCampRecordsExtracted: extraction.rawCampCount, uniqueCampSchedulesAfterDedupe: extraction.camps.length, duplicateCampRecordsRemoved: Math.max(0, extraction.rawCampCount - extraction.camps.length) });
    setWarnings((current) => Array.from(new Set([...current, ...extraction.warnings])));
    await detectDuplicates(extraction.providers, extraction.camps);
  }

  async function analyse(event: FormEvent) {
    event.preventDefault();
    setImportSummary("");
    setWarnings([]);
    setAnalysisLog(null);
    setPageAnalyses([]);
    setManualPages({});
    setActiveManualUrl("");
    setDebugItems([]);
    setDebugCounts(blankDebugCounts);
    setSelectedCampKeys(new Set());
    if (!manualMode) {
      const response = await fetch("/api/discovery/fetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: form.sourceUrl }) });
      const result = await response.json();
      if (!response.ok) { setManualMode(true); setFetchMessage(result.error ?? "Fetch failed. Paste page text instead."); return; }
      const pages = (result.pages ?? []) as DiscoveryPageAnalysis[];
      const text = result.text ?? "";
      setPageText(text);
      setAnalysisLog(result.analysisLog ?? null);
      setPageAnalyses(pages);
      setWarnings(result.warnings ?? []);
      setFetchMessage(`Fetched ${pages.filter((page) => page.status === "analysed").length} page(s); ${pages.filter((page) => page.status === "failed").length} need manual paste (${text.length} readable characters).`);
      await applyExtraction(pages, {});
      return;
    }
    const pages: DiscoveryPageAnalysis[] = [{ url: form.sourceUrl, text: pageText, readableTextLength: pageText.length, candidateCount: 0, dynamicWarning: false, status: "analysed", sourceMethod: "manual_paste" }];
    setPageAnalyses(pages);
    await applyExtraction(pages, {});
  }

  async function submitManualPage() {
    if (!activeManualUrl || !manualDraft.trim()) return;
    const nextManual = { ...manualPages, [activeManualUrl]: { url: activeManualUrl, text: manualDraft } };
    const nextPages = pageAnalyses.map((page) => page.url === activeManualUrl ? { ...page, status: "extracted" as const } : page);
    setManualPages(nextManual);
    setPageAnalyses(nextPages);
    setManualDraft("");
    setActiveManualUrl("");
    setFetchMessage(`Manual paste added for ${activeManualUrl}; extraction refreshed.`);
    await applyExtraction(nextPages, nextManual);
  }

  async function detectDuplicates(nextProviders = providers, nextCamps = camps) {
    const [existingProviders, existingCamps] = await Promise.all([getProviders(), getCamps()]);
    let nextDraftProviderId = nextProviderId(existingProviders.data, nextProviders);
    const providerIdMap = new Map<string, string>();
    const flaggedProviders = nextProviders.map((provider) => {
      const match = existingProviders.data.find((existing) => providerMatches(existing, provider));
      const originalProviderId = provider.provider_id;
      if (match) {
        providerIdMap.set(originalProviderId, match.provider_id);
        return { ...provider, ...match, duplicateWarnings: [`Existing provider found: ${match.provider_id} / ${match.provider_name}`], selected: false, needs_review: provider.needs_review, confidence: provider.confidence, fieldConfidence: provider.fieldConfidence, extractionWarnings: provider.extractionWarnings, source_method: provider.source_method };
      }
      const assignedProviderId = /^P\d{4}$/.test(provider.provider_id) ? provider.provider_id : nextDraftProviderId;
      providerIdMap.set(originalProviderId, assignedProviderId);
      if (assignedProviderId === nextDraftProviderId) nextDraftProviderId = `P${String(Number(nextDraftProviderId.slice(1)) + 1).padStart(4, "0")}`;
      return { ...provider, provider_id: assignedProviderId };
    });
    const flaggedCamps = nextCamps.map((camp) => {
      const providerId = providerIdMap.get(camp.provider_id) ?? flaggedProviders.find((provider) => provider.provider_name === nextProviders[0]?.provider_name)?.provider_id ?? camp.provider_id;
      const updatedCamp = { ...camp, provider_id: providerId };
      const duplicateWarnings = existingCamps.data.filter((existing) => existing.camp_id === updatedCamp.camp_id || (existing.provider_id === updatedCamp.provider_id && existing.camp_name.toLowerCase() === updatedCamp.camp_name.toLowerCase() && existing.town.toLowerCase() === updatedCamp.town.toLowerCase() && existing.start_date === updatedCamp.start_date)).map((existing) => `Existing camp found: ${existing.camp_id} / ${existing.camp_name}`);
      return { ...updatedCamp, duplicateWarnings, selected: duplicateWarnings.length === 0 && updatedCamp.selected };
    });
    setProviders(flaggedProviders);
    setCamps(flaggedCamps.map((camp) => ({ ...camp, selected: false })));
    setSelectedCampKeys(new Set());
    const repoWarnings = [existingProviders.error, existingCamps.error].filter(Boolean) as string[];
    if (repoWarnings.length) setWarnings((current) => [...current, ...repoWarnings.map((warning) => `Duplicate check warning: ${warning}`)]);
  }

  function updateProvider(index: number, field: keyof DiscoveryProvider, value: string | boolean | number) { setProviders((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)); }
  function updateCamp(index: number, field: keyof DiscoveryCamp, value: string | boolean | number) {
    const currentCamp = camps[index];
    if (!currentCamp) return;
    const currentKey = campStableKey(currentCamp);
    if (field === "selected") {
      setSelectedCampKeys((keys) => { const next = new Set(keys); if (value) next.add(currentKey); else next.delete(currentKey); return next; });
      return;
    }
    const updatedCamp = { ...currentCamp, [field]: value };
    const nextKey = campStableKey(updatedCamp);
    setCamps((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
    if (currentKey !== nextKey) setSelectedCampKeys((keys) => { if (!keys.has(currentKey)) return keys; const next = new Set(keys); next.delete(currentKey); next.add(nextKey); return next; });
  }
  function bulkUpdateCamps(keys: string[], selected: boolean) { setSelectedCampKeys((current) => { const next = new Set(current); for (const key of keys) { if (selected) next.add(key); else next.delete(key); } return next; }); }
  function removeCamp(index: number) { const key = campStableKey(camps[index]); setCamps((rows) => rows.filter((_, rowIndex) => rowIndex !== index)); setSelectedCampKeys((keys) => { const next = new Set(keys); next.delete(key); return next; }); }
  function downloadCsv() { downloadTextFile("discovery-assistant-export.csv", recordsToCsv([...providers, ...campsWithSelection]), "text/csv;charset=utf-8"); }
  async function importSelected() { const [providerResult, campResult] = await Promise.all([selectedProviders.length ? upsertProviders(selectedProviders.map(asImportProvider)) : Promise.resolve({ data: [], error: null }), selectedCamps.length ? upsertCamps(selectedCamps.map(asImportCamp)) : Promise.resolve({ data: [], error: null })]); setImportSummary(`Imported ${providerResult.data.length} provider(s) and ${campResult.data.length} camp(s). ${[providerResult.error, campResult.error].filter(Boolean).join(" ")}`); }

  return <main className="app-shell"><header className="hero"><div><p className="eyebrow">Internal admin · draft discovery</p><h1>Discovery Assistant</h1><p>Analyse provider and camp pages, review deterministic draft records, then import selected unverified drafts.</p></div><div className="hero-actions"><Link className="button-link" href="/">Dashboard</Link></div></header>
    <section className="panel"><h2>Analyse source</h2><form className="edit-form" onSubmit={analyse}>{Object.keys(blankForm).map((key) => <label key={key}>{label(key)}<input value={form[key as keyof FormState]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={key === "sourceUrl"} /></label>)}<div className="form-actions wide-field"><button type="submit">Analyse page</button><button type="button" className="secondary" onClick={() => setManualMode(true)}>Paste page text instead</button></div></form>{manualMode ? <label className="wide-field">Paste page text instead<textarea rows={8} value={pageText} onChange={(event) => setPageText(event.target.value)} /></label> : null}<p>{fetchMessage}</p></section>
    <section className="stats-grid"><article><span>Source URL analysed</span><strong>{form.sourceUrl || "—"}</strong></article><article><span>Text extracted length</span><strong>{pageText.length + Object.values(manualPages).reduce((sum, page) => sum + page.text.length, 0)}</strong></article><article><span>Possible providers</span><strong>{providers.length}</strong></article><article><span>Unique camp schedules found</span><strong>{camps.length}</strong></article></section>
    <AnalysisLogPanel log={analysisLog} pages={pageAnalyses} activeManualUrl={activeManualUrl} manualDraft={manualDraft} onPaste={(url) => { setActiveManualUrl(url); setManualDraft(manualPages[url]?.text ?? ""); }} onDraftChange={setManualDraft} onSubmitManual={submitManualPage} />
    {developerDebug ? <DeveloperExtractionDebug items={debugItems} sourceUrl={form.sourceUrl} analysisLog={analysisLog} pages={pageAnalyses} debugCounts={debugCounts} /> : null}
    <ExtractionSummary providers={providers} camps={campsWithSelection} warnings={warnings} />
    <ReviewTable title="Providers" fields={providerFields} rows={providers} update={updateProvider} remove={(index) => setProviders((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} />
    <CampCards camps={campsWithSelection} update={updateCamp} bulkUpdate={bulkUpdateCamps} remove={removeCamp} />
    <details className="panel"><summary>Advanced spreadsheet view</summary><ReviewTable title="Camps" fields={campFields} rows={campsWithSelection} update={updateCamp} remove={removeCamp} /></details>
    <section className="panel"><div className="form-actions"><button type="button" className="secondary" onClick={downloadCsv} disabled={!providers.length && !camps.length}>Export CSV</button><button type="button" onClick={importSelected} disabled={!selectedProviders.length && !selectedCamps.length}>Import selected drafts</button></div>{importSummary ? <p>{importSummary}</p> : null}</section></main>;
}

function AnalysisLogPanel({ log, pages, activeManualUrl, manualDraft, onPaste, onDraftChange, onSubmitManual }: { log: AnalysisLog | null; pages: DiscoveryPageAnalysis[]; activeManualUrl: string; manualDraft: string; onPaste: (url: string) => void; onDraftChange: (value: string) => void; onSubmitManual: () => void }) {
  if (!log && pages.length === 0) return null;
  return <section className="panel"><h2>URL status</h2>{log ? <p className="empty-state">{log.discoveredUrls.length} discovered URL(s). Failed or blocked pages can be extended with manual paste.</p> : null}{log?.starcamp ? <div className="warning-box compact"><strong>Starcamp listing-to-product crawl</strong><small>Listing pages crawled: {log.starcamp.listingPagesCrawled}</small><small>Pagination pages discovered: {log.starcamp.paginationPagesDiscovered}</small><small>Product URLs discovered: {log.starcamp.productUrlsDiscovered}</small><small>Product URLs crawled: {log.starcamp.productUrlsCrawled}</small><small>Product URLs skipped: {log.starcamp.productUrlsSkipped}</small></div> : null}<div className="summary-list"><ul>{pages.map((page) => <li key={page.url}>{page.status === "failed" ? "✗" : "✓"} {page.url} {page.failureReason ? `(${page.failureReason})` : page.extractionBlocked ? "analysed as Starcamp listing index" : page.dynamicWarning ? "(possible JavaScript-rendered content)" : "analysed"} {page.status === "extracted" ? <><br />📋 Manual paste added<br />✓ Page extracted</> : null} {page.status !== "extracted" && (page.status === "failed" || page.dynamicWarning) ? <button type="button" className="secondary" onClick={() => onPaste(page.url)}>Paste page text</button> : null}</li>)}</ul></div>{activeManualUrl ? <div className="manual-paste-box"><h3>Paste page text</h3><p><strong>Source URL:</strong> {activeManualUrl}</p><textarea rows={12} value={manualDraft} onChange={(event) => onDraftChange(event.target.value)} /><div className="form-actions"><button type="button" onClick={onSubmitManual} disabled={!manualDraft.trim()}>Extract pasted page</button></div></div> : null}</section>;
}


function DeveloperExtractionDebug({ items, sourceUrl, analysisLog, pages, debugCounts }: { items: ExtractionPipelineDebug[]; sourceUrl: string; analysisLog: AnalysisLog | null; pages: DiscoveryPageAnalysis[]; debugCounts: DebugCounts }) {
  if (!items.length) return null;
  const payload = buildDebugExportPayload(sourceUrl, analysisLog, pages, items, debugCounts);
  return <details className="panel developer-debug" open><summary>Developer Extraction Debug</summary><div className="summary-pills"><span>Product pages crawled: {debugCounts.productPagesCrawled}</span><span>Raw camp records extracted: {debugCounts.rawCampRecordsExtracted}</span><span>Unique camp schedules after dedupe: {debugCounts.uniqueCampSchedulesAfterDedupe}</span><span>Duplicate camp records removed: {debugCounts.duplicateCampRecordsRemoved}</span></div><div className="form-actions"><button type="button" className="secondary" onClick={() => downloadTextFile(debugFilename(sourceUrl, "json"), JSON.stringify(payload, null, 2), "application/json;charset=utf-8")}>Download Debug JSON</button><button type="button" className="secondary" onClick={() => downloadTextFile(debugFilename(sourceUrl, "txt"), formatDebugTxt(payload))}>Download Debug TXT</button></div>{items.map((item) => <article className="debug-page" key={`${item.sourceUrl}-${item.sourceMethod}`}><h3>{item.sourceUrl}</h3><p><span className="badge">{methodBadge(item.sourceMethod)}</span></p><section><h4>1. Raw extracted text</h4><pre>{item.rawTextPreview}</pre></section><section><h4>2. Extraction pipeline</h4><ul className="debug-list">{item.stages.map((stage) => <li key={stage.label}>{stage.passed ? "✓" : "✗"} {stage.label}: {stage.count}</li>)}</ul></section><section><h4>3. Regex matches</h4>{item.regexMatches.length ? <div className="debug-grid">{item.regexMatches.map((match, index) => <div key={`${match.type}-${match.value}-${index}`}><strong>{match.type}:</strong><pre>{match.value}</pre></div>)}</div> : <p className="empty-state">No regex matches found.</p>}</section><section><h4>4. Candidate rows</h4>{item.candidateRows.length ? item.candidateRows.map((row, index) => <div className="debug-card" key={`${row.extractedText}-${index}`}><strong>Candidate {index + 1}</strong><pre>{row.extractedText}</pre><strong>Parsed fields</strong><dl className="debug-fields"><dt>Matched age string</dt><dd>{String(row.parsedFields.matched_age || "—")}</dd><dt>Parsed age_min</dt><dd>{String(row.parsedFields.age_min || "—")}</dd><dt>Parsed age_max</dt><dd>{String(row.parsedFields.age_max || "—")}</dd><dt>Matched time string</dt><dd>{String(row.parsedFields.matched_time || "—")}</dd><dt>Parsed start_time</dt><dd>{String(row.parsedFields.start_time || "—")}</dd><dt>Parsed end_time</dt><dd>{String(row.parsedFields.end_time || "—")}</dd><dt>Source product URL</dt><dd>{String(row.parsedFields.booking_url || item.sourceUrl || "—")}</dd><dt>Source text type</dt><dd>{String(row.parsedFields.booking_url) === item.sourceUrl && /\/product\//.test(item.sourceUrl) ? "product-page text" : /starcamp\.ie\/(summer|easter)-camps-list/i.test(item.sourceUrl) ? "listing text" : "page text"}</dd></dl><pre>{JSON.stringify(row.parsedFields, null, 2)}</pre><p>Confidence: {row.confidence}%</p></div>) : <p className="empty-state">No candidate rows created.</p>}</section><section><h4>5. Validation failures</h4>{item.validationFailures.length ? <ul className="debug-list">{item.validationFailures.map((failure, index) => <li key={`${failure}-${index}`}>Rejected: {failure}</li>)}</ul> : <p className="empty-state">No validation failures recorded.</p>}</section><section><h4>6. Final camp objects</h4><pre>{JSON.stringify(item.finalCampObjects, null, 2)}</pre></section></article>)}</details>;
}

function ReviewTable<T extends DiscoveryProvider | DiscoveryCamp>({ title, fields, rows, update, remove }: { title: string; fields: Array<keyof T>; rows: T[]; update: (index: number, field: keyof T, value: string | boolean | number) => void; remove: (index: number) => void }) {
  return <section className="panel"><h2>{title}</h2><div className="table-wrap"><table><thead><tr><th>Source</th>{fields.map((field) => <th key={String(field)}>{label(String(field))}</th>)}<th>Duplicates</th><th>Delete</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td><span className="badge">{methodBadge(row.source_method)}</span></td>{fields.map((field) => { const value = row[field]; const checkbox = typeof value === "boolean"; return <td key={String(field)}>{checkbox ? <input type="checkbox" checked={Boolean(value)} onChange={(event) => update(index, field, event.target.checked)} /> : <input value={String(value ?? "")} onChange={(event) => update(index, field, field === "age_min" || field === "age_max" ? Number(event.target.value) : event.target.value)} />}</td>; })}<td>{row.duplicateWarnings.map((warning) => <small key={warning}>{warning}</small>)}</td><td><button type="button" className="secondary" onClick={() => remove(index)}>Delete</button></td></tr>)}</tbody></table></div></section>;
}

function confidenceClass(score: number) { if (score >= 80) return "success"; if (score >= 60) return "warning"; return "danger"; }
function ConfidenceBadge({ score }: { score: number }) { return <span className={`badge ${confidenceClass(score)}`}>{score}%</span>; }

function ExtractionSummary({ providers, camps, warnings }: { providers: DiscoveryProvider[]; camps: DiscoveryCamp[]; warnings: string[] }) {
  if (!providers.length && !camps.length && !warnings.length) return null;
  const providerConfidence = providers[0]?.confidence ?? 0;
  const duplicateProvider = providers.some((provider) => provider.duplicateWarnings.some((warning) => warning.startsWith("Existing provider found")));
  const summaryWarnings = [...warnings, duplicateProvider ? "Existing provider found" : "", ...camps.flatMap((camp) => camp.duplicateWarnings), ...camps.flatMap((camp) => camp.extractionWarnings.map((warning) => `${camp.camp_name}: ${warning}`))].filter(Boolean);
  return <section className="panel extraction-summary"><h2>Extraction Summary</h2><div className="summary-pills"><span>Provider confidence <ConfidenceBadge score={providerConfidence} /></span><span>{camps.length} unique camp schedules found</span></div>{summaryWarnings.length ? <div className="warning-box"><strong>Warnings</strong><ul>{Array.from(new Set(summaryWarnings)).map((warning) => <li key={warning}>⚠ {warning}</li>)}</ul></div> : null}</section>;
}

function campMatchesFilters(camp: DiscoveryCamp, filters: CampReviewFilters) {
  if (filters.county && camp.county !== filters.county) return false;
  if (filters.town && camp.town !== filters.town) return false;
  if (filters.provider && camp.provider_id !== filters.provider) return false;
  if (filters.holidayType && camp.holiday_type !== filters.holidayType) return false;
  if (filters.activityType && camp.activity_type !== filters.activityType) return false;
  if (filters.startDate && (!camp.start_date || camp.start_date < filters.startDate)) return false;
  if (filters.endDate && (!camp.end_date || camp.end_date > filters.endDate)) return false;
  if (filters.priceStatus === "present" && !String(camp.price ?? "").trim()) return false;
  if (filters.priceStatus === "missing" && String(camp.price ?? "").trim()) return false;
  if (filters.needsReview === "yes" && !camp.needs_review) return false;
  if (filters.needsReview === "no" && camp.needs_review) return false;
  if (filters.confidence && camp.confidence < Number(filters.confidence)) return false;
  if (filters.sourceMethod && camp.source_method !== filters.sourceMethod) return false;
  const search = filters.search.trim().toLowerCase();
  if (search && ![camp.camp_name, camp.town, camp.county, camp.address, camp.booking_url].some((value) => normalizedIncludes(value, search))) return false;
  return true;
}

function CampCards({ camps, update, bulkUpdate, remove }: { camps: DiscoveryCamp[]; update: (index: number, field: keyof DiscoveryCamp, value: string | boolean | number) => void; bulkUpdate: (keys: string[], selected: boolean) => void; remove: (index: number) => void }) {
  const [filters, setFilters] = useState<CampReviewFilters>(blankCampReviewFilters);
  const visibleCamps = useMemo(() => camps.map((camp, index) => ({ camp, index })).filter(({ camp }) => campMatchesFilters(camp, filters)), [camps, filters]);
  const visibleKeys = visibleCamps.map(({ camp }) => campStableKey(camp));
  const selectedCount = camps.filter((camp) => campStableKey(camp) && camp.selected).length;
  const needsReviewCount = camps.filter((camp) => camp.needs_review).length;
  const selectedByCountyCount = filters.county ? camps.filter((camp) => camp.county === filters.county && camp.selected).length : 0;
  const options = useMemo(() => ({
    counties: uniqueOptions(camps.map((camp) => camp.county)),
    towns: uniqueOptions(camps.map((camp) => camp.town)),
    providers: uniqueOptions(camps.map((camp) => camp.provider_id)),
    holidayTypes: uniqueOptions(camps.map((camp) => camp.holiday_type)),
    activityTypes: uniqueOptions(camps.map((camp) => camp.activity_type)),
  }), [camps]);
  const updateFilter = (field: keyof CampReviewFilters) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters((current) => ({ ...current, [field]: event.target.value }));
  const countyKeys = (county: string) => camps.filter((camp) => camp.county === county).map(campStableKey);

  return <section className="panel"><h2>Camp review cards</h2>{camps.length === 0 ? <p className="empty-state">No high-confidence camp offerings found. Generic navigation items are ignored.</p> : <>
    <div className="review-filter-panel"><h3>Review filters</h3><div className="review-filter-grid">
      <label>County<select value={filters.county} onChange={updateFilter("county")}><option value="">All counties</option>{options.counties.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Town<select value={filters.town} onChange={updateFilter("town")}><option value="">All towns</option>{options.towns.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Provider<select value={filters.provider} onChange={updateFilter("provider")}><option value="">All providers</option>{options.providers.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Holiday type<select value={filters.holidayType} onChange={updateFilter("holidayType")}><option value="">All holiday types</option>{options.holidayTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Activity type<select value={filters.activityType} onChange={updateFilter("activityType")}><option value="">All activity types</option>{options.activityTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Date from<input type="date" value={filters.startDate} onChange={updateFilter("startDate")} /></label>
      <label>Date to<input type="date" value={filters.endDate} onChange={updateFilter("endDate")} /></label>
      <label>Price<select value={filters.priceStatus} onChange={updateFilter("priceStatus")}><option value="">Any price status</option><option value="present">Price present</option><option value="missing">Price missing</option></select></label>
      <label>Needs review<select value={filters.needsReview} onChange={updateFilter("needsReview")}><option value="">Any review status</option><option value="yes">Needs review</option><option value="no">Does not need review</option></select></label>
      <label>Confidence threshold<input type="number" min="0" max="100" value={filters.confidence} onChange={updateFilter("confidence")} placeholder="Minimum %" /></label>
      <label>Source method<select value={filters.sourceMethod} onChange={updateFilter("sourceMethod")}><option value="">Any source</option><option value="crawler">Crawled</option><option value="manual_paste">Manual</option></select></label>
      <label className="review-search">Search<input value={filters.search} onChange={updateFilter("search")} placeholder="Name, town, county, venue, booking URL" /></label>
    </div><div className="summary-pills review-counts"><span>{camps.length} total schedules</span><span>{visibleCamps.length} visible</span><span>{selectedCount} selected camp schedules</span><span>{camps.length - visibleCamps.length} hidden by filters</span><span>{needsReviewCount} needs review</span>{filters.county ? <span>{selectedByCountyCount} selected in {filters.county}</span> : null}</div><div className="form-actions review-bulk-actions"><button type="button" className="secondary" onClick={() => bulkUpdate(visibleKeys, true)}>Select all visible</button><button type="button" className="secondary" onClick={() => bulkUpdate(visibleKeys, false)}>Deselect all visible</button><button type="button" className="secondary" onClick={() => bulkUpdate(camps.map(campStableKey), true)}>Select all</button><button type="button" className="secondary" onClick={() => bulkUpdate(camps.map(campStableKey), false)}>Deselect all</button><button type="button" className="secondary" onClick={() => filters.county && bulkUpdate(countyKeys(filters.county), true)} disabled={!filters.county}>Select by county</button><button type="button" className="secondary" onClick={() => filters.county && bulkUpdate(countyKeys(filters.county), false)} disabled={!filters.county}>Deselect by county</button><button type="button" className="secondary" onClick={() => setFilters(blankCampReviewFilters)}>Clear filters</button></div></div>
    {visibleCamps.length === 0 ? <p className="empty-state">No camp cards match the active review filters.</p> : <div className="camp-review-grid">{visibleCamps.map(({ camp, index }) => <article className="camp-review-card" key={`${camp.camp_id}-${index}`}><div className="camp-card-header"><label className="checkbox-row"><input type="checkbox" checked={camp.selected} onChange={(event) => update(index, "selected", event.target.checked)} /> Select</label><span className="badge">{methodBadge(camp.source_method)}</span><ConfidenceBadge score={camp.confidence} /></div><h3>{camp.camp_name}</h3><div className="review-fields"><ReviewItem label="Location" value={[camp.town, camp.county].filter(Boolean).join(", ") || "—"} confidence={Math.max(camp.fieldConfidence.town ?? 0, camp.fieldConfidence.county ?? 0)} /><ReviewItem label="Dates" value={[camp.start_date, camp.end_date].filter(Boolean).join(" - ") || "—"} confidence={camp.fieldConfidence.start_date ?? 0} /><ReviewItem label="Age" value={camp.age_min || camp.age_max ? `${camp.age_min || "?"}-${camp.age_max || "?"}` : "—"} confidence={camp.fieldConfidence.age ?? 0} /><ReviewItem label="Price" value={camp.price || "—"} confidence={camp.fieldConfidence.price ?? 0} /><ReviewItem label="Activity" value={camp.activity_type || "—"} confidence={camp.fieldConfidence.activity_type ?? 0} /><ReviewItem label="Booking" value={camp.booking_url || "—"} confidence={camp.fieldConfidence.booking_url ?? 0} /></div>{camp.extractionWarnings.length || camp.duplicateWarnings.length ? <div className="warning-box compact"><strong>Warnings</strong>{[...camp.duplicateWarnings, ...camp.extractionWarnings].map((warning) => <small key={warning}>⚠ {warning}</small>)}</div> : null}<details><summary>Edit</summary><div className="edit-form card-edit">{campFields.map((field) => { const value = camp[field]; const checkbox = typeof value === "boolean"; return <label key={String(field)}>{label(String(field))}{checkbox ? <input type="checkbox" checked={Boolean(value)} onChange={(event) => update(index, field, event.target.checked)} /> : <input value={String(value ?? "")} onChange={(event) => update(index, field, field === "age_min" || field === "age_max" || field === "confidence" ? Number(event.target.value) : event.target.value)} />}</label>; })}</div></details><button type="button" className="secondary" onClick={() => remove(index)}>Delete</button></article>)}</div>}</>}</section>;
}

function ReviewItem({ label, value, confidence }: { label: string; value: string; confidence: number }) { return <div><span>{label}</span><strong>{value}</strong><ConfidenceBadge score={confidence} /></div>; }
