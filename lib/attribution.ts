/**
 * First-party campaign attribution (UTM + landing path + referrer).
 *
 * Matches /privacy: capture first-touch in sessionStorage for the RFQ,
 * never third-party ad click IDs, never referrer search queries.
 */

import { isAnalyticsSkippedPath } from "@/lib/analytics";
import { cleanText } from "@/lib/sanitize";

export const ATTRIBUTION_STORAGE_KEY = "giftpro:attribution:v1";

export const LANDING_PATH_MAX = 500;
export const REFERRER_MAX = 1000;
export const UTM_SHORT_MAX = 200;
export const UTM_LONG_MAX = 300;

export type CampaignAttribution = {
  landingPath: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
};

const UTM_PARAMS = {
  utm_source: { field: "utmSource", max: UTM_SHORT_MAX },
  utm_medium: { field: "utmMedium", max: UTM_SHORT_MAX },
  utm_campaign: { field: "utmCampaign", max: UTM_LONG_MAX },
  utm_term: { field: "utmTerm", max: UTM_LONG_MAX },
  utm_content: { field: "utmContent", max: UTM_LONG_MAX },
} as const;

type UtmField = (typeof UTM_PARAMS)[keyof typeof UTM_PARAMS]["field"];

/** Third-party ad click IDs — not listed in the privacy policy; do not persist. */
const BLOCKED_QUERY_KEYS = new Set([
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "gclsrc",
  "fbclid",
  "msclkid",
  "ttclid",
  "li_fat_id",
  "twclid",
  "email",
  "e-mail",
  "phone",
  "tel",
  "name",
  "token",
  "access_token",
  "code",
]);

export const EMPTY_ATTRIBUTION: CampaignAttribution = {
  landingPath: "",
  referrer: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmTerm: "",
  utmContent: "",
};

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function clipUtm(value: string, max: number): string {
  return clip(cleanText(value), max);
}

export function sanitizeExternalReferrer(
  referrer: string,
  pageOrigin: string,
): string {
  const raw = referrer.trim();
  if (!raw) return "";
  const url = parseUrl(raw);
  if (!url) return "";
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  const origin = pageOrigin.trim();
  if (origin && url.origin === origin) return "";
  return clip(`${url.origin}${url.pathname || "/"}`, REFERRER_MAX);
}

export function parseCampaignAttribution(input: {
  href: string;
  referrer?: string;
  pageOrigin?: string;
}): CampaignAttribution {
  const result: CampaignAttribution = { ...EMPTY_ATTRIBUTION };
  const url = parseUrl(input.href);
  if (!url) return result;

  const path = url.pathname || "/";
  if (isAnalyticsSkippedPath(path)) return result;

  result.landingPath = clip(path, LANDING_PATH_MAX);

  for (const [param, meta] of Object.entries(UTM_PARAMS)) {
    const raw = url.searchParams.get(param);
    if (!raw) continue;
    result[meta.field] = clipUtm(raw, meta.max);
  }

  result.referrer = sanitizeExternalReferrer(
    input.referrer || "",
    input.pageOrigin || url.origin,
  );
  return result;
}

export function mergeFirstTouch(
  stored: CampaignAttribution | null | undefined,
  incoming: CampaignAttribution,
): CampaignAttribution {
  const base: CampaignAttribution = stored
    ? { ...EMPTY_ATTRIBUTION, ...stored }
    : { ...EMPTY_ATTRIBUTION };
  if (!base.landingPath && incoming.landingPath) {
    base.landingPath = incoming.landingPath;
  }
  if (!base.referrer && incoming.referrer) {
    base.referrer = incoming.referrer;
  }
  (Object.keys(UTM_PARAMS) as Array<keyof typeof UTM_PARAMS>).forEach(
    (param) => {
      const field: UtmField = UTM_PARAMS[param].field;
      if (!base[field] && incoming[field]) {
        base[field] = incoming[field];
      }
    },
  );
  return base;
}

function asTrimmedString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return clip(cleanText(value), max);
}

export function parseStoredAttribution(
  raw: string | null | undefined,
): CampaignAttribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    return {
      landingPath: asTrimmedString(record.landingPath, LANDING_PATH_MAX),
      referrer: asTrimmedString(record.referrer, REFERRER_MAX),
      utmSource: asTrimmedString(record.utmSource, UTM_SHORT_MAX),
      utmMedium: asTrimmedString(record.utmMedium, UTM_SHORT_MAX),
      utmCampaign: asTrimmedString(record.utmCampaign, UTM_LONG_MAX),
      utmTerm: asTrimmedString(record.utmTerm, UTM_LONG_MAX),
      utmContent: asTrimmedString(record.utmContent, UTM_LONG_MAX),
    };
  } catch {
    return null;
  }
}

type AttributionStore = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): AttributionStore | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStoredAttribution(
  storage?: AttributionStore | null,
): CampaignAttribution | null {
  const store = storage === undefined ? defaultStore() : storage;
  if (!store) return null;
  try {
    return parseStoredAttribution(store.getItem(ATTRIBUTION_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistAttribution(
  value: CampaignAttribution,
  storage?: AttributionStore | null,
): void {
  const store = storage === undefined ? defaultStore() : storage;
  if (!store) return;
  try {
    store.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* private mode / quota */
  }
}

export function captureFirstPartyAttribution(
  input: { href: string; referrer?: string; pageOrigin?: string },
  storage?: AttributionStore | null,
): CampaignAttribution {
  const incoming = parseCampaignAttribution(input);
  const store = storage === undefined ? defaultStore() : storage;
  const merged = mergeFirstTouch(readStoredAttribution(store), incoming);
  persistAttribution(merged, store);
  return merged;
}

export function referrerDisplayHost(referrer?: string | null): string {
  const raw = (referrer || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function isInternalTrafficHost(
  host: string,
  pageOrigin?: string,
): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return false;
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  ) {
    return true;
  }
  const origin =
    pageOrigin ||
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SITE_URL || ""
      : "");
  if (!origin) return false;
  try {
    const siteHost = new URL(origin).hostname.replace(/^www\./i, "").toLowerCase();
    return normalized === siteHost;
  } catch {
    return false;
  }
}

/** Leads from smg-ui / smartgift.next-dev.net public brief. */
export function isSmartgiftWebLead(input: {
  utmSource?: string | null;
  landingPath?: string | null;
  detail?: string | null;
}): boolean {
  const source = (input.utmSource || "").trim().toLowerCase();
  if (
    source === "smg-ui" ||
    source === "smartgift" ||
    source.includes("smartgift")
  ) {
    return true;
  }
  const landing = (input.landingPath || "").toLowerCase();
  if (landing.includes("smartgift.next-dev.net")) return true;
  const detail = (input.detail || "").toLowerCase();
  return detail.includes("[smg-ui brief]");
}

export const SMART_GIFT_LEAD_BADGE = "Smart Gift";

export function formatCampaignSourceLabel(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  landingPath?: string | null;
  pageOrigin?: string;
  detail?: string | null;
}): string {
  if (isSmartgiftWebLead(input)) {
    const medium = (input.utmMedium || "").trim();
    const campaign = (input.utmCampaign || "").trim();
    const extras = [medium, campaign].filter(Boolean);
    return extras.length
      ? `${SMART_GIFT_LEAD_BADGE} · ${extras.join(" · ")}`
      : SMART_GIFT_LEAD_BADGE;
  }

  const parts = [input.utmSource, input.utmMedium, input.utmCampaign]
    .map((value) => (value || "").trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");

  const host = referrerDisplayHost(input.referrer);
  if (host && !isInternalTrafficHost(host, input.pageOrigin)) return host;

  const landing = (input.landingPath || "").trim();
  if (landing && landing !== "/") return landing;

  return "ตรงเว็บ";
}

export function listCampaignAttributionRows(input: {
  landingPath?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  pageOrigin?: string;
}): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: "แหล่งแคมเปญ", value: formatCampaignSourceLabel(input) },
  ];
  const landing = (input.landingPath || "").trim();
  if (landing) rows.push({ label: "หน้าแรกของเซสชัน", value: landing });
  const referrer = (input.referrer || "").trim();
  if (referrer) {
    const host = referrerDisplayHost(referrer);
    if (!isInternalTrafficHost(host, input.pageOrigin)) {
      rows.push({ label: "เว็บที่ส่งต่อมา", value: referrer });
    }
  }

  const utm: Array<[string, string | null | undefined]> = [
    ["utm_source", input.utmSource],
    ["utm_medium", input.utmMedium],
    ["utm_campaign", input.utmCampaign],
    ["utm_term", input.utmTerm],
    ["utm_content", input.utmContent],
  ];
  for (const [label, value] of utm) {
    const trimmed = (value || "").trim();
    if (trimmed) rows.push({ label, value: trimmed });
  }
  return rows;
}

export function hasBlockedTrackingParam(href: string): boolean {
  const url = parseUrl(href);
  if (!url) return false;
  for (const key of url.searchParams.keys()) {
    if (BLOCKED_QUERY_KEYS.has(key.toLowerCase())) return true;
  }
  return false;
}
