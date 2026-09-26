/** Google Analytics 4 helpers.
 * Keep `process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID` as a static member access
 * so Next.js inlines the same compile-time value into the client bundle and SSR.
 */

const GA_MEASUREMENT_ID_RAW = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

export const ANALYTICS_CONSENT_KEY = "giftpro:analytics-consent:v1";
export const ANALYTICS_CONSENT_EVENT = "giftpro:analytics-consent";

export type AnalyticsConsent = "granted" | "denied";
export type AnalyticsEventParams = Record<
  string,
  string | number | boolean | undefined
>;

const GA_ID_PATTERN = /^G-[A-Z0-9]+$/i;

export function parseGaMeasurementId(
  raw: string | undefined | null,
): string | null {
  const id = String(raw || "").trim();
  if (!GA_ID_PATTERN.test(id)) return null;
  return id.toUpperCase();
}

export function getGaMeasurementId(): string | null {
  return parseGaMeasurementId(GA_MEASUREMENT_ID_RAW);
}

export function isGaConfigured(): boolean {
  return getGaMeasurementId() !== null;
}

export function isAnalyticsSkippedPath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  return (
    path === "/ops" ||
    path.startsWith("/ops/") ||
    path === "/sop" ||
    path.startsWith("/sop/")
  );
}

export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (raw === "granted" || raw === "denied") return raw;
  } catch {
    /* private mode */
  }
  return null;
}

export function writeAnalyticsConsent(value: AnalyticsConsent): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}

export function bootGoogleAnalytics(measurementId: string): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false,
    anonymize_ip: true,
  });
}

function cleanEventParams(
  params?: AnalyticsEventParams,
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/** Public conversion events. Never pass email, phone, company, or request ids. */
export function trackEvent(name: string, params?: AnalyticsEventParams): void {
  if (typeof window === "undefined") return;
  if (!getGaMeasurementId()) return;
  if (readAnalyticsConsent() !== "granted") return;
  if (typeof window.gtag !== "function") return;
  const cleaned = cleanEventParams(params);
  if (cleaned) {
    window.gtag("event", name, cleaned);
    return;
  }
  window.gtag("event", name);
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
