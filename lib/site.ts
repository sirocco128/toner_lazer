import { COMPANY } from "@/lib/company";

export const LOCAL_BUSINESS_TYPES = [
  "LocalBusiness",
  "ProfessionalService",
  "Store",
  "WholesaleStore",
] as const;

export type LocalBusinessType = (typeof LOCAL_BUSINESS_TYPES)[number];

export type LocalBusinessConfig = {
  enabled: boolean;
  type: LocalBusinessType;
  streetAddress: string;
  locality: string;
  region: string;
  postalCode: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  openingHours: string;
};

export type SiteConfig = {
  url: string;
  name: string;
  legalName: string;
  description: string;
  phoneDisplay: string;
  phoneHref: string;
  email: string;
  lineId: string;
  lineUrl: string;
  allowIndexing: boolean;
  taxId: string;
  localBusiness: LocalBusinessConfig;
};

const FALLBACK_URL = "http://localhost:3000";
const FALLBACK_NAME = COMPANY.brandName;
const FALLBACK_DESCRIPTION = COMPANY.description;
const FALLBACK_PHONE_DISPLAY = "02-000-0000";
const FALLBACK_PHONE_HREF = "tel:+6620000000";
const FALLBACK_EMAIL = "sales@example.com";
const FALLBACK_LINE_ID = "@giftproasia";
const FALLBACK_LINE_URL = "https://line.me/R/ti/p/@giftproasia";

function readEnv(key: string): string {
  return (process.env[key] ?? "").trim();
}

function parseBoolean(value: string, fallback = false): boolean {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function isValidTelHref(value: string): boolean {
  return /^tel:\+?[0-9()\-\s]{8,20}$/.test(value);
}

function isValidPhoneDisplay(value: string): boolean {
  return /^[0-9+\-()\s]{6,30}$/.test(value);
}

function parseLocalBusinessType(value: string): LocalBusinessType {
  if ((LOCAL_BUSINESS_TYPES as readonly string[]).includes(value)) {
    return value as LocalBusinessType;
  }
  return "ProfessionalService";
}

function parseOptionalNumber(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveUrl(raw: string): string {
  if (isValidHttpUrl(raw)) {
    return raw.replace(/\/+$/, "");
  }
  return FALLBACK_URL;
}

function resolveEmail(raw: string): string {
  return isValidEmail(raw) ? raw : FALLBACK_EMAIL;
}

function resolvePhoneHref(raw: string): string {
  return isValidTelHref(raw) ? raw : FALLBACK_PHONE_HREF;
}

function resolvePhoneDisplay(raw: string): string {
  return isValidPhoneDisplay(raw) ? raw : FALLBACK_PHONE_DISPLAY;
}

function resolveLineUrl(raw: string): string {
  return isValidHttpUrl(raw) ? raw : FALLBACK_LINE_URL;
}

let cachedSite: SiteConfig | null = null;

export function getSiteConfig(): SiteConfig {
  if (cachedSite) return cachedSite;

  const url = resolveUrl(readEnv("NEXT_PUBLIC_SITE_URL") || FALLBACK_URL);
  const name = readEnv("NEXT_PUBLIC_SITE_NAME") || FALLBACK_NAME;
  const description =
    readEnv("NEXT_PUBLIC_SITE_DESCRIPTION") || FALLBACK_DESCRIPTION;

  const streetAddress =
    readEnv("SITE_STREET_ADDRESS") || COMPANY.streetAddress;
  const locality = readEnv("SITE_ADDRESS_LOCALITY") || COMPANY.locality;
  const postalCode = readEnv("SITE_POSTAL_CODE") || COMPANY.postalCode;
  const enabledFlag = parseBoolean(
    readEnv("SITE_ENABLE_LOCAL_BUSINESS_SCHEMA"),
    true,
  );

  cachedSite = {
    url,
    name,
    legalName: readEnv("SITE_LEGAL_NAME") || COMPANY.legalName,
    description,
    phoneDisplay: resolvePhoneDisplay(
      readEnv("NEXT_PUBLIC_SITE_PHONE_DISPLAY") || FALLBACK_PHONE_DISPLAY,
    ),
    phoneHref: resolvePhoneHref(
      readEnv("NEXT_PUBLIC_SITE_PHONE_HREF") || FALLBACK_PHONE_HREF,
    ),
    email: resolveEmail(
      readEnv("NEXT_PUBLIC_SITE_EMAIL") || FALLBACK_EMAIL,
    ),
    lineId: readEnv("NEXT_PUBLIC_LINE_ID") || FALLBACK_LINE_ID,
    lineUrl: resolveLineUrl(
      readEnv("NEXT_PUBLIC_LINE_URL") || FALLBACK_LINE_URL,
    ),
    allowIndexing: parseBoolean(
      readEnv("NEXT_PUBLIC_ALLOW_INDEXING"),
      false,
    ),
    taxId: readEnv("SITE_TAX_ID") || COMPANY.taxId,
    localBusiness: {
      enabled:
        enabledFlag &&
        Boolean(streetAddress) &&
        Boolean(locality) &&
        Boolean(postalCode),
      type: parseLocalBusinessType(
        readEnv("SITE_BUSINESS_TYPE") || "ProfessionalService",
      ),
      streetAddress,
      locality,
      region: readEnv("SITE_ADDRESS_REGION") || COMPANY.region,
      postalCode,
      countryCode: readEnv("SITE_COUNTRY_CODE") || "TH",
      latitude: parseOptionalNumber(readEnv("SITE_LATITUDE")),
      longitude: parseOptionalNumber(readEnv("SITE_LONGITUDE")),
      openingHours: readEnv("SITE_OPENING_HOURS") || "Mo-Sa 08:30-17:30",
    },
  };

  return cachedSite;
}

/** Test helper — clears memoized config after env changes. */
export function resetSiteConfigCache(): void {
  cachedSite = null;
}

export const site = getSiteConfig();
