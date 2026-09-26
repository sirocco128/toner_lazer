/**
 * Fetch a real 1688 / Alibaba listing page and keep only https HTML.
 */

import { normalizeAlibabaListingUrl } from "@/lib/alibaba/listing-urls";

const MAX_HTML_BYTES = 1_500_000;
const FETCH_MS = 12_000;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchListingPageHtml(pageUrl: string): Promise<string | null> {
  const listing = normalizeAlibabaListingUrl(pageUrl);
  if (!listing) return null;
  try {
    const response = await fetch(listing, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": BROWSER_UA,
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,th;q=0.7",
      },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (type && !type.includes("text/html") && !type.includes("application/xhtml")) {
      return null;
    }
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_HTML_BYTES) return null;
    return buf.toString("utf8");
  } catch {
    return null;
  }
}
