import { NextResponse } from "next/server";

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: Request) {
  const { url } = await request.json();
  if (!url || typeof url !== "string") return NextResponse.json({ error: "Source URL is required." }, { status: 400 });

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http and https URLs are supported.");
    const response = await fetch(parsed.toString(), { headers: { "user-agent": "CampHarvester Discovery Assistant" } });
    if (!response.ok) throw new Error(`Fetch failed with HTTP ${response.status}.`);
    const html = await response.text();
    return NextResponse.json({ text: htmlToText(html), length: html.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch URL." }, { status: 502 });
  }
}
