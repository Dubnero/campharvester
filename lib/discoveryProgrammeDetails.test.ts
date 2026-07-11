import assert from "node:assert/strict";
import test from "node:test";
import { extractLinksWithText, isProgrammeDetailLink, isSportsKeyEventDetailPage } from "./discoveryProgrammeDetails";
import { mapAiExtraction, selectAiReadableText } from "./aiDiscoveryExtraction";

const listingUrl = "https://portal.sportskey.com/venues/trinity-sports-programs/events?q%5Bany_cont%5D=summer";
const detailUrl = "https://portal.sportskey.com/venues/trinity-sports-programs/events/MM4ENH";
const secondDetailUrl = "https://portal.sportskey.com/venues/trinity-sports-programs/events/H29ZYJ";

test("SportsKey listing cards expose and prioritise programme detail links", () => {
  const html = `
    <article><h2>Trinity Sport - Bravehearts Summer Camp 2026 - 6–13 years old</h2><a href="/venues/trinity-sports-programs/events/MM4ENH">View Details &amp; Book</a></article>
    <article><h2>Trinity Sport - Bravehearts Summer Camp 2026 - Bumblebees - 4–5 year olds</h2><a href="/venues/trinity-sports-programs/events/H29ZYJ">View Details</a></article>
    <article><h2>Trinity Sport - Bravehearts Summer Camp 2026 - Wolves - 14–16 year olds</h2><a href="/venues/trinity-sports-programs/events/WOLF26">Book Now</a></article>`;
  const detailLinks = extractLinksWithText(html, listingUrl).filter(isProgrammeDetailLink);

  assert.equal(detailLinks.length, 3);
  assert.deepEqual(detailLinks.map((link) => link.label), ["View Details & Book", "View Details", "Book Now"]);
  assert.equal(isSportsKeyEventDetailPage(new URL(detailLinks[0].url)), true);
});

test("AI input preparation prefers detail page text over programme listing summaries", () => {
  const readableText = `Source URL: ${listingUrl}\nTrinity Sport - Bravehearts Summer Camp 2026 - Wolves - 14–16 year olds\nView Details & Book\n\nSource URL: ${detailUrl}\nTrinity Sport - Bravehearts Summer Camp 2026 - Wolves\nWeek 1: 6 July 2026 to 10 July 2026\nWeek 2: 13 July 2026 to 17 July 2026\n€150\n10am - 3pm`;
  const selected = selectAiReadableText(readableText, listingUrl);

  assert.equal(selected.text.startsWith(`Source URL: ${detailUrl}`), true);
  assert.match(selected.text, /Week 1/);
});

test("detail page with multiple sessions maps to multiple draft camp rows", () => {
  const mapped = mapAiExtraction({ providers: [{ provider_name: "Trinity Sport" }], camps: [{ camp_name: "Trinity Sport - Bravehearts Summer Camp 2026 - Wolves", start_date: "6 July", end_date: "10 July", age_min: 14, age_max: 16, booking_url: detailUrl }, { camp_name: "Trinity Sport - Bravehearts Summer Camp 2026 - Wolves", start_date: "13 July", end_date: "17 July", age_min: 14, age_max: 16, booking_url: detailUrl }], warnings: [] }, { source_url: listingUrl, readable_text: "Summer Camp 2026" });

  assert.equal(mapped.camps.length, 2);
  assert.deepEqual(mapped.camps.map((camp) => camp.start_date), ["2026-07-06", "2026-07-13"]);
  assert.equal(mapped.camps.every((camp) => camp.status === "draft" && camp.verified === false && camp.featured === false), true);
});

test("clean detail URL is preserved as booking_url instead of long listing URL", () => {
  const mapped = mapAiExtraction({ providers: [], camps: [{ camp_name: "Trinity Sport - Bravehearts Summer Camp 2026", start_date: "6 July 2026", end_date: "10 July 2026", booking_url: secondDetailUrl }] }, { source_url: listingUrl, readable_text: "Summer Camp 2026" });

  assert.equal(mapped.camps[0].booking_url, secondDetailUrl);
  assert.notEqual(mapped.camps[0].booking_url, listingUrl);
});

test("missing detail pages warning survives AI mapping without crashing", () => {
  const mapped = mapAiExtraction({ providers: [], camps: [{ camp_name: "Trinity Sport - Bravehearts Summer Camp 2026 - Bumblebees", start_date: "6 July 2026" }], warnings: ["Only programme summary found; detail sessions may be missing."] }, { source_url: listingUrl, readable_text: "programme card only" });

  assert.deepEqual(mapped.warnings, ["Only programme summary found; detail sessions may be missing."]);
  assert.equal(mapped.camps.length, 1);
});

async function withMockFetch<T>(handler: (url: string) => Response | Promise<Response>, run: () => Promise<T>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) => handler(String(input))) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("additional detail URLs are fetched, included in AI input, and prioritised before listing text", async () => {
  const { POST } = await import("../app/api/discovery/fetch/route");
  const fetched: string[] = [];
  await withMockFetch((url) => {
    fetched.push(url);
    if (url === detailUrl) return new Response("<html><body><h1>Trinity Sport - Bravehearts Summer Camp 2026 - Wolves</h1><p>Week 1: 6 July 2026 to 10 July 2026</p><p>€150</p></body></html>");
    return new Response("<html><body><p>No Events Available</p></body></html>");
  }, async () => {
    const response = await POST(new Request("https://example.test/api/discovery/fetch", { method: "POST", body: JSON.stringify({ url: listingUrl, additionalDetailUrls: `${detailUrl}\n` }) }));
    const result = await response.json() as { text: string; pages: Array<{ url: string; status: string }> };

    assert.deepEqual(fetched, [listingUrl, detailUrl]);
    assert.equal(result.pages[0].url, detailUrl);
    assert.equal(result.text.startsWith(`Source URL: ${detailUrl}`), true);
    assert.match(result.text, /Week 1: 6 July 2026 to 10 July 2026/);
  });
});

test("failed additional detail URLs produce warnings without crashing", async () => {
  const { POST } = await import("../app/api/discovery/fetch/route");
  await withMockFetch((url) => {
    if (url === secondDetailUrl) return new Response("Missing", { status: 404 });
    return new Response("<html><body><p>No Events Available</p></body></html>");
  }, async () => {
    const response = await POST(new Request("https://example.test/api/discovery/fetch", { method: "POST", body: JSON.stringify({ url: listingUrl, additionalDetailUrls: [secondDetailUrl] }) }));
    const result = await response.json() as { warnings: string[]; pages: Array<{ url: string; status: string; failureReason?: string }> };

    assert.equal(response.ok, true);
    assert.equal(result.pages.some((page) => page.url === secondDetailUrl && page.status === "failed" && page.failureReason === "HTTP 404"), true);
    assert.equal(result.warnings.some((warning) => warning.includes(`Additional detail URL failed: ${secondDetailUrl}`) && warning.includes("HTTP 404")), true);
  });
});

test("care options collapse to one weekly camp row with base package price and notes", () => {
  const mapped = mapAiExtraction({ providers: [{ provider_name: "Trinity Sport" }], camps: [
    { camp_name: "Trinity Sport - Bravehearts Summer Camp 2026 - Bumblebees Week 3", start_date: "13 July", end_date: "17 July", start_time: "08:45", end_time: "15:45", price: "€220.00", booking_url: detailUrl },
    { camp_name: "Trinity Sport - Bravehearts Summer Camp 2026 - Bumblebees Week 3 + Pre Care", start_date: "13 July", end_date: "17 July", price: "€250.00", booking_url: detailUrl },
    { camp_name: "Trinity Sport - Bravehearts Summer Camp 2026 - Bumblebees Week 3 + Post Care", start_date: "13 July", end_date: "17 July", price: "€250.00", booking_url: detailUrl },
    { camp_name: "Trinity Sport - Bravehearts Summer Camp 2026 - Bumblebees Week 3 + Pre+Post Care", start_date: "13 July", end_date: "17 July", price: "€280.00", booking_url: detailUrl },
  ], warnings: [] }, { source_url: listingUrl, readable_text: "BraveHearts Childrens Camps 2026" }, "BraveHearts Childrens Camps 2026");

  assert.equal(mapped.camps.length, 1);
  assert.equal(mapped.camps[0].camp_name, "Trinity Sport - Bravehearts Summer Camp 2026 - Bumblebees Week 3");
  assert.equal(mapped.camps[0].price, "€220.00");
  assert.equal(mapped.camps[0].booking_url, detailUrl);
  assert.equal(mapped.camps[0].activity_type, "Children's Camps");
  assert.equal(mapped.camps[0].extractionWarnings.includes("Pre-care, post-care and individual day options available on booking page."), true);
});

test("individual day care variants do not create duplicate week rows", () => {
  const mapped = mapAiExtraction({ providers: [], camps: [
    { camp_name: "Bumblebees Week 4", start_date: "20 July 2026", end_date: "24 July 2026", price: "€220.00", booking_url: detailUrl },
    { camp_name: "Bumblebees Week 4 - Individual Day", start_date: "20 July 2026", end_date: "24 July 2026", price: "€55.00", booking_url: detailUrl },
    { camp_name: "Bumblebees Week 4 - Individual Day + Pre Care", start_date: "20 July 2026", end_date: "24 July 2026", price: "€65.00", booking_url: detailUrl },
  ], warnings: [] }, { source_url: listingUrl, readable_text: "BraveHearts 2026" });

  assert.equal(mapped.camps.length, 1);
  assert.equal(mapped.camps[0].camp_name, "Bumblebees Week 4");
  assert.equal(mapped.camps[0].price, "€220.00");
});

test("4-day week wording is preserved while retaining one row per week date range", () => {
  const mapped = mapAiExtraction({ providers: [], camps: [
    { camp_name: "Wolves Week 6 (4 Day Week)", start_date: "4 August", end_date: "7 August", price: "€170.00", booking_url: secondDetailUrl },
    { camp_name: "Wolves Week 6 (4 Day Week) + Pre Care", start_date: "4 August", end_date: "7 August", price: "€200.00", booking_url: secondDetailUrl },
    { camp_name: "Wolves Week 7", start_date: "10 August", end_date: "14 August", price: "€220.00", booking_url: secondDetailUrl },
  ], warnings: [] }, { source_url: listingUrl, readable_text: "Summer 2026" });

  assert.equal(mapped.camps.length, 2);
  assert.deepEqual(mapped.camps.map((camp) => camp.start_date), ["2026-08-04", "2026-08-10"]);
  assert.match(mapped.camps[0].camp_name, /4 Day Week/);
  assert.equal(mapped.camps[0].price, "€170.00");
});
