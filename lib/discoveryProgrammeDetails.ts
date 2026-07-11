export type ExtractedLink = { url: string; label: string };

function isSameOrSubdomain(hostname: string, domain: string) {
  const normalizedHost = hostname.replace(/^www\./, "").toLowerCase();
  const normalizedDomain = domain.replace(/^www\./, "").toLowerCase();
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function cleanLinkLabel(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

export function extractLinksWithText(html: string, baseUrl: string) {
  const links: ExtractedLink[] = [];
  const linkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>|<iframe\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const attrs = match[1] || match[3] || "";
    const href = attrs.match(/(?:href|src)=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      const link = new URL(href, baseUrl);
      link.hash = "";
      const aria = attrs.match(/(?:aria-label|title)=["']([^"']+)["']/i)?.[1] || "";
      links.push({ url: link.toString(), label: cleanLinkLabel(`${match[2] || ""} ${aria}`) });
    } catch {
      // Ignore malformed hrefs.
    }
  }
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

export function isSportsKeyEventDetailPage(url: URL) {
  return isSameOrSubdomain(url.hostname, "sportskey.com") && /^\/venues\/[^/]+\/events\/[A-Za-z0-9_-]{4,16}\/?$/i.test(url.pathname);
}

export function isProgrammeDetailLink(link: ExtractedLink) {
  return /^(?:view\s+)?details?(?:\s*&\s*book)?$|^book(?:\s+now)?$/i.test(link.label.trim()) || isSportsKeyEventDetailPage(new URL(link.url));
}
