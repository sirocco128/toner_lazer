const ALICD_HOSTS = new Set([
  "cbu01.alicdn.com",
  "cbu02.alicdn.com",
  "img.alicdn.com",
  "sc01.alicdn.com",
  "sc02.alicdn.com",
  "sc03.alicdn.com",
  "sc04.alicdn.com",
  "ae01.alicdn.com",
  "s.alicdn.com",
]);

const MAX_IMAGES = 8;

export function isAllowlistedAlicdnHost(hostname: string): boolean {
  return ALICD_HOSTS.has(hostname.toLowerCase());
}

export function alicdnAllowlistOrigins(): string[] {
  return [...ALICD_HOSTS].map((host) => `https://${host}`);
}

/** Extract https alicdn URLs; drop javascript/data and unknown hosts. */
export function extractOfferImages(input: unknown, cap = MAX_IMAGES): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const visit = (value: unknown): void => {
    if (found.length >= cap) return;
    if (!value) return;
    if (typeof value === "string") {
      const url = normalizeImageUrl(value);
      if (url && !seen.has(url)) {
        seen.add(url);
        found.push(url);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      visit(record.imageUrls);
      visit(record.images);
      visit(record.image);
      visit(record.mainImage);
      visit(record.url);
      visit(record.imageUrl);
    }
  };

  visit(input);
  return found.slice(0, cap);
}

const ALICD_IN_TEXT =
  /https?:\/\/(?:cbu0[12]|img|sc0[1-4]|ae01|s)\.alicdn\.com\/[^\s"'<>\\)]+/gi;

/** Pull alicdn https URLs out of HTML or model text. */
export function extractOfferImagesFromHtml(html: string, cap = MAX_IMAGES): string[] {
  const matches = html.match(ALICD_IN_TEXT) ?? [];
  return extractOfferImages(matches, cap);
}

function looksLikeSiteChrome(url: string): boolean {
  const lower = url.toLowerCase();
  if (/-tps-\d+-\d+\.(png|gif|webp|jpg|jpeg)/.test(lower)) return true;
  const thumb = lower.match(/_(\d{1,4})x(\d{1,4})\./);
  if (thumb) {
    const w = Number(thumb[1]);
    const h = Number(thumb[2]);
    if (w > 0 && h > 0 && (w < 200 || h < 200)) return true;
  }
  if (lower.includes("/@img/imgextra/") && lower.endsWith(".png")) return true;
  return false;
}

function normalizeImageUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
    return null;
  }

  let href = trimmed;
  if (href.startsWith("//")) href = `https:${href}`;
  if (href.startsWith("http://")) {
    href = `https://${href.slice("http://".length)}`;
  }

  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "https:") return null;
    if (!isAllowlistedAlicdnHost(parsed.hostname)) return null;
    parsed.hash = "";
    const normalized = parsed.toString();
    if (looksLikeSiteChrome(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}
