/**
 * Gemini (via OpenRouter) searches live 1688 / Alibaba listings, then we keep
 * only allowlisted listing + alicdn URLs. Invented URLs are dropped.
 */

import { fetch1688Product, readAlibabaClientConfig } from "@/lib/alibaba/client";
import {
  candidatesFromCitations,
  mergeSourceImageCandidates,
  parseGeminiSearchJson,
} from "@/lib/alibaba/gemini-parse";
import {
  collectImagesFromListingText,
  extract1688OfferId,
  extractAlibabaListingUrls,
  normalizeAlibabaListingUrl,
  type SourceImageCandidate,
} from "@/lib/alibaba/listing-urls";
import { fetchListingPageHtml } from "@/lib/alibaba/source-page";
import {
  completeOpenRouterChatDetailed,
  isOpenRouterChatEnabled,
} from "@/lib/openrouter-chat";

const SEARCH_SYSTEM = [
  "You search the live web for REAL product listings on 1688.com and Alibaba.com.",
  "Use web_search then web_fetch on listing pages. Do not invent URLs.",
  "Only keep https listing pages (detail.1688.com/offer/… or alibaba.com/product-detail/…)",
  "and https image URLs on alicdn hosts (cbu01.alicdn.com, img.alicdn.com, sc04.alicdn.com, s.alicdn.com).",
  "If a URL is not from those sites, omit it.",
  "Do not include factory CNY, offer IDs as prices, or non-product pages.",
  'Reply JSON only: {"results":[{"title":"...","platform":"1688"|"alibaba","pageUrl":"https://...","imageUrl":"https://..."}]}',
].join("\n");

function searchUserPrompt(query: string): string {
  const q = query.trim();
  return [
    `Find current product photos for: ${q}`,
    "Search queries should include 1688 and Alibaba.com listing pages for custom-logo gift blanks",
    "(tumbler, notebook, pen, power bank, bag, gift box) matching the request.",
    "Prefer Chinese 1688 offer pages plus Alibaba.com product-detail pages.",
    "Return up to 8 distinct listings, each with one primary product photo URL from alicdn.",
  ].join("\n");
}

async function imagesFromLiveOffer(pageUrl: string, title: string): Promise<SourceImageCandidate[]> {
  const offerId = extract1688OfferId(pageUrl);
  const client = readAlibabaClientConfig();
  if (!offerId || !client) return [];
  try {
    const live = await fetch1688Product(offerId, client);
    const urls = live.imageUrls || [];
    return urls.slice(0, 4).map((imageUrl) => ({
      title: title || pageUrl,
      platform: "1688" as const,
      pageUrl,
      imageUrl,
    }));
  } catch {
    return [];
  }
}

async function imagesFromListingPage(
  pageUrl: string,
  title: string,
): Promise<SourceImageCandidate[]> {
  const html = await fetchListingPageHtml(pageUrl);
  if (!html) return [];
  return collectImagesFromListingText(pageUrl, title, html, 4);
}

export async function searchAlibabaImagesWithGemini(query: string): Promise<{
  ok: true;
  query: string;
  model: string;
  candidates: SourceImageCandidate[];
} | { ok: false; error: string }> {
  const trimmed = query.trim().slice(0, 200);
  if (trimmed.length < 2) {
    return { ok: false, error: "พิมพ์คำค้นอย่างน้อย 2 ตัวอักษร" };
  }
  if (!isOpenRouterChatEnabled()) {
    return { ok: false, error: "ยังไม่ได้ตั้ง OPENROUTER_API_KEY สำหรับ Gemini" };
  }

  const detailed = await completeOpenRouterChatDetailed(
    [
      { role: "system", content: SEARCH_SYSTEM },
      { role: "user", content: searchUserPrompt(trimmed) },
    ],
    {
      maxTokens: 1200,
      temperature: 0.1,
      timeoutMs: 55_000,
      maxToolCalls: 8,
      tools: [
        {
          type: "openrouter:web_search",
          parameters: {
            engine: "exa",
            max_results: 8,
            max_uses: 3,
            max_total_results: 16,
            allowed_domains: ["1688.com", "alibaba.com", "alicdn.com"],
          },
        },
        { type: "openrouter:web_fetch" },
      ],
    },
  );

  if (!detailed) {
    return { ok: false, error: "Gemini ค้นเว็บไม่สำเร็จ ลองใหม่ภายหลัง" };
  }

  const fromJson = parseGeminiSearchJson(detailed.content);
  const fromCitations = candidatesFromCitations(detailed.citations);
  const listingUrls = [
    ...fromJson.map((item) => item.pageUrl),
    ...extractAlibabaListingUrls(
      `${detailed.content}\n${detailed.citations.map((c) => c.url).join("\n")}`,
    ),
  ]
    .map((url) => normalizeAlibabaListingUrl(url))
    .filter((url): url is string => Boolean(url));

  const uniqueListings = [...new Set(listingUrls)].slice(0, 8);
  const titleByPage = new Map<string, string>();
  for (const item of fromJson) titleByPage.set(item.pageUrl, item.title);
  for (const citation of detailed.citations) {
    const page = normalizeAlibabaListingUrl(citation.url);
    if (page && citation.title) titleByPage.set(page, citation.title);
  }

  const liveGroups = await Promise.all(
    uniqueListings.map(async (pageUrl) => {
      const title = titleByPage.get(pageUrl) || pageUrl;
      const fromApi = await imagesFromLiveOffer(pageUrl, title);
      if (fromApi.length > 0) return fromApi;
      return imagesFromListingPage(pageUrl, title);
    }),
  );

  const candidates = mergeSourceImageCandidates([
    fromJson,
    fromCitations,
    liveGroups.flat(),
  ]);

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "ไม่พบรูปจากเว็บ 1688 หรือ Alibaba ที่ตรวจแล้วว่าเป็นลิงก์จริง",
    };
  }

  return {
    ok: true,
    query: trimmed,
    model: detailed.model,
    candidates,
  };
}
