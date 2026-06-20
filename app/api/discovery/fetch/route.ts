import { NextResponse } from "next/server";

const MAX_PAGES = 10;
const likelyCampLink = /\b(camps?|summer|easter|halloween|holiday|programme|program|book(?:ing)?|enrol|enroll|schedule|class)\b|profile\.php|selected_schedule|[?&]id=/i;
// TODO: Add Google Maps/search discovery, franchise-wide crawling, and LLM extraction in later phases.
const blockedLink = /\b(social|facebook|instagram|twitter|x\.com|linkedin|youtube|mailto:|tel:|maps?\.|google\.com\/maps|privacy|terms|cookie|login|account|cart|checkout|payment)\b/i;

type CrawlPage = { url: string; text: string; readableTextLength: number; candidateCount: number; dynamicWarning: boolean; status: "analysed" | "failed"; failureReason?: string; sourceMethod: "crawler" };
type SkippedUrl = { url: string; reason: string };

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractLinks(html: string, baseUrl: string) {
  const links: string[] = [];
  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const link = new URL(match[1], baseUrl);
      link.hash = "";
      links.push(link.toString());
    } catch {
      // Ignore malformed hrefs.
    }
  }
  return Array.from(new Set(links));
}

function rootDomain(hostname: string) {
  const parts = hostname.replace(/^www\./, "").split(".");
  return parts.slice(Math.max(0, parts.length - 2)).join(".");
}

function providerToken(hostname: string) {
  return hostname.replace(/^www\./, "").split(".")[0].replace(/\d+$/g, "").toLowerCase();
}

function isSameOrSubdomain(hostname: string, domain: string) {
  const normalizedHost = hostname.replace(/^www\./, "").toLowerCase();
  const normalizedDomain = domain.replace(/^www\./, "").toLowerCase();
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function isBricks4KidzBookingFlow(source: URL, target: URL) {
  return isSameOrSubdomain(source.hostname, "bricks4kidz.ie") && isSameOrSubdomain(target.hostname, "bricks4kidznow.com");
}

function isRelatedDomain(source: URL, target: URL) {
  if (source.hostname === target.hostname || rootDomain(source.hostname) === rootDomain(target.hostname)) return true;
  if (isBricks4KidzBookingFlow(source, target)) return true;
  const sourceToken = providerToken(source.hostname);
  return sourceToken.length >= 4 && target.hostname.toLowerCase().includes(sourceToken);
}

function hasBookingPathOrQuery(url: URL) {
  return likelyCampLink.test(`${url.pathname}${url.search}`);
}

function linkDecision(source: URL, link: string) {
  if (blockedLink.test(link)) return "Skipped unrelated/navigation/payment link";
  let parsed: URL;
  try { parsed = new URL(link); } catch { return "Invalid URL"; }
  if (!["http:", "https:"].includes(parsed.protocol)) return "Unsupported protocol";
  if (!isRelatedDomain(source, parsed)) return "External domain is not clearly related to provider";
  if (!hasBookingPathOrQuery(parsed) && !likelyCampLink.test(link)) return "No camp/booking keyword";
  return "crawl";
}

function campCandidateCount(text: string) {
  const lines = text.split(/\n+/).filter((line) => /\b(camp|academy|workshop|course|club)\b/i.test(line) && /\b(summer|easter|halloween|midterm|christmas|ages?|aged|€|book|date|time)\b/i.test(line));
  return lines.length;
}

function hasDynamicWarning(html: string, text: string) {
  const scriptCount = (html.match(/<script\b/gi) ?? []).length;
  return text.replace(/\s+/g, " ").trim().length < 700 && scriptCount >= 8;
}

async function fetchPage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { headers: { "user-agent": "CampHarvester Discovery Assistant" }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const text = htmlToText(html);
    if (text.replace(/\s+/g, " ").trim().length === 0) throw new Error("Zero readable text");
    return { html, text };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Timeout");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const { url } = await request.json();
  if (!url || typeof url !== "string") return NextResponse.json({ error: "Source URL is required." }, { status: 400 });

  try {
    const source = new URL(url);
    if (!["http:", "https:"].includes(source.protocol)) throw new Error("Only http and https URLs are supported.");

    const queue = [source.toString()];
    const queued = new Set(queue);
    const crawled = new Set<string>();
    const discovered = new Set<string>();
    const skipped = new Map<string, string>();
    const pages: CrawlPage[] = [];

    while (queue.length && pages.length < MAX_PAGES) {
      const currentUrl = queue.shift() as string;
      if (crawled.has(currentUrl)) continue;
      crawled.add(currentUrl);
      try {
        const { html, text } = await fetchPage(currentUrl);
        pages.push({ url: currentUrl, text, readableTextLength: text.length, candidateCount: campCandidateCount(text), dynamicWarning: hasDynamicWarning(html, text), status: "analysed", sourceMethod: "crawler" });
        for (const link of extractLinks(html, currentUrl)) {
          discovered.add(link);
          if (queued.has(link) || crawled.has(link)) continue;
          const decision = linkDecision(source, link);
          if (decision === "crawl") { queue.push(link); queued.add(link); }
          else skipped.set(link, decision);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Fetch failed";
        skipped.set(currentUrl, reason);
        pages.push({ url: currentUrl, text: "", readableTextLength: 0, candidateCount: 0, dynamicWarning: false, status: "failed", failureReason: reason, sourceMethod: "crawler" });
      }
    }

    for (const pending of queue) skipped.set(pending, `Safe crawl limit reached (${MAX_PAGES} pages).`);

    const text = pages.map((page) => `\n\nSource URL: ${page.url}\n${page.text}`).join("\n").trim();
    return NextResponse.json({
      text,
      length: text.length,
      pages,
      analysisLog: {
        sourceUrl: source.toString(),
        discoveredUrls: Array.from(discovered),
        crawledUrls: pages.filter((page) => page.status === "analysed").map((page) => page.url),
        skippedUrls: Array.from(skipped.entries()).map(([skippedUrl, reason]) => ({ url: skippedUrl, reason } satisfies SkippedUrl)),
      },
      warnings: pages.some((page) => page.dynamicWarning) ? ["This page may load camp data dynamically. Manual paste or future browser-rendered extraction may be needed."] : [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch URL." }, { status: 502 });
  }
}
