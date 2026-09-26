/**
 * Parse Gemini / OpenRouter grounded search into real 1688/Alibaba listing photos.
 */

import { extractOfferImages, extractOfferImagesFromHtml } from "@/lib/alibaba/images";
import {
  collectImagesFromListingText,
  detectSourcePlatform,
  extractAlibabaListingUrls,
  normalizeAlibabaListingUrl,
  type SourceImageCandidate,
  type SourcePlatform,
} from "@/lib/alibaba/listing-urls";

export type UrlCitation = {
  url: string;
  title?: string;
  content?: string;
};

const MAX_CANDIDATES = 12;

export function parseGeminiSearchJson(raw: string): SourceImageCandidate[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const rows = Array.isArray(parsed.results) ? parsed.results : [];
    const out: SourceImageCandidate[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const pageUrl = normalizeAlibabaListingUrl(String(rec.pageUrl || rec.url || ""));
      const imageUrl = extractOfferImages(String(rec.imageUrl || rec.image || "")).at(0);
      if (!pageUrl || !imageUrl) continue;
      const platform =
        rec.platform === "1688" || rec.platform === "alibaba"
          ? rec.platform
          : detectSourcePlatform(pageUrl);
      if (!platform) continue;
      out.push({
        title: String(rec.title || "").trim() || pageUrl,
        platform,
        pageUrl,
        imageUrl,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function candidatesFromCitations(citations: UrlCitation[]): SourceImageCandidate[] {
  const out: SourceImageCandidate[] = [];
  for (const citation of citations) {
    const pageUrl = normalizeAlibabaListingUrl(citation.url);
    const blob = `${citation.url}\n${citation.title || ""}\n${citation.content || ""}`;
    if (pageUrl) {
      out.push(
        ...collectImagesFromListingText(pageUrl, citation.title || pageUrl, blob),
      );
      continue;
    }
    const imageUrl = extractOfferImagesFromHtml(blob, 1).at(0);
    const listings = extractAlibabaListingUrls(blob, 1);
    if (imageUrl && listings[0]) {
      const platform = detectSourcePlatform(listings[0]) as SourcePlatform;
      out.push({
        title: citation.title || listings[0],
        platform,
        pageUrl: listings[0],
        imageUrl,
      });
    }
  }
  return out;
}

export function mergeSourceImageCandidates(
  groups: SourceImageCandidate[][],
): SourceImageCandidate[] {
  const seen = new Set<string>();
  const out: SourceImageCandidate[] = [];
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.pageUrl}|${item.imageUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= MAX_CANDIDATES) return out;
    }
  }
  return out;
}
