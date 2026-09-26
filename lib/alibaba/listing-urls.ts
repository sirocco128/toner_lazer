/**
 * Allowlisted 1688 / Alibaba listing URLs. Ops-only — never show offer IDs on public pages.
 */

import { extractOfferImagesFromHtml } from "@/lib/alibaba/images";

export type SourcePlatform = "1688" | "alibaba";

const MAX_LISTINGS = 8;

export function unwrapRedirectCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const out: string[] = [trimmed];
  try {
    const href = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
    const parsed = new URL(href);
    for (const key of ["imgrefurl", "imgurl", "url", "u", "q"]) {
      const inner = parsed.searchParams.get(key);
      if (inner && /^https?:\/\//i.test(inner) && !out.includes(inner)) {
        out.push(inner);
      }
    }
  } catch {
    return out;
  }
  return out;
}

export function unwrapRedirectUrl(raw: string): string {
  return unwrapRedirectCandidates(raw)[0] || raw.trim();
}

function isListingHost(hostname: string): SourcePlatform | null {
  const host = hostname.toLowerCase();
  if (host === "1688.com" || host.endsWith(".1688.com")) return "1688";
  if (host === "alibaba.com" || host.endsWith(".alibaba.com")) return "alibaba";
  return null;
}

function isBlockedListingHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.startsWith("passport.") ||
    host.startsWith("login.") ||
    host.startsWith("auth.") ||
    host.startsWith("member.")
  );
}

function isProductPath(pathname: string, platform: SourcePlatform): boolean {
  const path = pathname.toLowerCase();
  if (platform === "1688") {
    return /\/offer\/\d{6,}/.test(path);
  }
  return path.includes("/product-detail/") || /\/product\/[^/]+/.test(path);
}

export function detectSourcePlatform(href: string): SourcePlatform | null {
  try {
    const parsed = new URL(unwrapRedirectUrl(href));
    return isListingHost(parsed.hostname);
  } catch {
    return null;
  }
}

function normalizeOneListing(raw: string): string | null {
  let href = raw.trim();
  if (!href) return null;
  if (href.startsWith("//")) href = `https:${href}`;
  if (href.startsWith("http://")) href = `https://${href.slice("http://".length)}`;

  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "https:") return null;
    if (isBlockedListingHost(parsed.hostname)) return null;
    const platform = isListingHost(parsed.hostname);
    if (!platform) return null;
    if (!isProductPath(parsed.pathname, platform)) return null;
    parsed.hash = "";
    parsed.search = "";
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeAlibabaListingUrl(raw: string): string | null {
  for (const candidate of unwrapRedirectCandidates(raw)) {
    const normalized = normalizeOneListing(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export function extract1688OfferId(href: string): string | null {
  const normalized = normalizeAlibabaListingUrl(href) ?? unwrapRedirectUrl(href);
  try {
    const parsed = new URL(normalized);
    const match = parsed.pathname.match(/\/offer\/(\d{6,})/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

const ANY_HTTPS = /https?:\/\/[^\s"'<>\\)]+/gi;

export function extractAlibabaListingUrls(text: string, cap = MAX_LISTINGS): string[] {
  const matches = text.match(ANY_HTTPS) ?? [];
  const found: string[] = [];
  const seen = new Set<string>();
  for (const raw of matches) {
    const url = normalizeAlibabaListingUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    found.push(url);
    if (found.length >= cap) break;
  }
  return found;
}

export type SourceImageCandidate = {
  title: string;
  platform: SourcePlatform;
  pageUrl: string;
  imageUrl: string;
};

export function candidateKey(item: SourceImageCandidate): string {
  return `${item.pageUrl}|${item.imageUrl}`;
}

export function collectImagesFromListingText(
  pageUrl: string,
  title: string,
  blob: string,
  cap = 6,
): SourceImageCandidate[] {
  const listing = normalizeAlibabaListingUrl(pageUrl);
  if (!listing) return [];
  const platform = detectSourcePlatform(listing);
  if (!platform) return [];
  const images = extractOfferImagesFromHtml(blob, cap);
  const seen = new Set<string>();
  const out: SourceImageCandidate[] = [];
  for (const imageUrl of images) {
    if (seen.has(imageUrl)) continue;
    seen.add(imageUrl);
    out.push({
      title: title.trim() || listing,
      platform,
      pageUrl: listing,
      imageUrl,
    });
    if (out.length >= cap) break;
  }
  return out;
}
