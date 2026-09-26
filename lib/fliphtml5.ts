/**
 * Optional FlipHTML5 embed. Their conversion API is Enterprise-only;
 * we only allow a public book URL in an iframe.
 */

const ALLOWED_HOSTS = new Set(["fliphtml5.com", "online.fliphtml5.com"]);

function allowedFlipHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return ALLOWED_HOSTS.has(host) || host.endsWith(".fliphtml5.com");
}

export function flipHtml5EmbedUrl(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!allowedFlipHost(url.hostname)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** FlipHTML5 deep-link to a 1-based page (`#p=12`). */
export function flipHtml5PageUrl(
  raw: string | null | undefined,
  pageNumber?: number | null,
): string | null {
  const base = flipHtml5EmbedUrl(raw);
  if (!base) return null;
  const page = Number(pageNumber);
  if (!Number.isInteger(page) || page < 1) return base;
  try {
    const url = new URL(base);
    url.hash = `p=${page}`;
    return url.toString();
  } catch {
    return base;
  }
}

export function parseFlipPageParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(String(raw || "").replace(/^p=/i, "").trim());
  if (!Number.isInteger(page) || page < 1) return null;
  return page;
}

/** Public PDF catalog URL for procurement officers (https only). */
export function catalogPdfUrl(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
