#!/usr/bin/env node
/**
 * Build-time indexing guard (runbook §14.2).
 * When NEXT_PUBLIC_ALLOW_INDEXING=true, reject placeholder/demo configs.
 * When indexing is false, allow demo. Exit 1 on failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

/** @param {string | undefined} value */
function truthy(value) {
  return String(value ?? "").trim().toLowerCase() === "true";
}

/** @param {string | undefined} value */
function isPlaceholderSecret(value) {
  const v = String(value ?? "").trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  return (
    lower.includes("replace-with") ||
    lower.includes("changeme") ||
    lower.includes("placeholder") ||
    lower.includes("example") ||
    lower === "secret" ||
    lower === "test" ||
    v.length < 32
  );
}

/** @param {string | undefined} url */
function isRealHttpsUrl(url) {
  try {
    const u = new URL(String(url ?? ""));
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      host === "example.com" ||
      host.endsWith(".example.com") ||
      host === "example.org" ||
      host.endsWith(".example.org")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const allowIndexing = truthy(process.env.NEXT_PUBLIC_ALLOW_INDEXING);

const gaMeasurementId = String(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "").trim();
if (gaMeasurementId && !/^G-[A-Z0-9]+$/i.test(gaMeasurementId)) {
  console.error(
    "validate:env FAILED — NEXT_PUBLIC_GA_MEASUREMENT_ID must be a GA4 id (G-XXXXXXXX).",
  );
  process.exit(1);
}

if (!allowIndexing) {
  console.log(
    "validate:env OK — indexing disabled; demo/placeholder config allowed.",
  );
  process.exit(0);
}

/** @type {string[]} */
const errors = [];

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
if (!isRealHttpsUrl(siteUrl)) {
  errors.push(
    "NEXT_PUBLIC_SITE_URL must be a real HTTPS URL (not localhost/example).",
  );
}

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "";
if (!siteName.trim() || /giftpro asia/i.test(siteName) || /demo/i.test(siteName)) {
  errors.push("NEXT_PUBLIC_SITE_NAME must be a real brand name (not GiftPro Asia Demo).");
}

const phoneDisplay = process.env.NEXT_PUBLIC_SITE_PHONE_DISPLAY ?? "";
if (!phoneDisplay.trim() || /000/.test(phoneDisplay)) {
  errors.push("NEXT_PUBLIC_SITE_PHONE_DISPLAY must not be a placeholder (000).");
}

const phoneHref = process.env.NEXT_PUBLIC_SITE_PHONE_HREF ?? "";
if (!/^tel:\+[1-9]\d{7,14}$/.test(phoneHref.trim())) {
  errors.push("NEXT_PUBLIC_SITE_PHONE_HREF must be a valid tel:+E.164 URI.");
}

const email = process.env.NEXT_PUBLIC_SITE_EMAIL ?? "";
if (!email.trim() || /@example\.com$/i.test(email) || !email.includes("@")) {
  errors.push("NEXT_PUBLIC_SITE_EMAIL must be a real address (not example.com).");
}

const lineId = process.env.NEXT_PUBLIC_LINE_ID ?? "";
const lineUrl = process.env.NEXT_PUBLIC_LINE_URL ?? "";
if (
  !lineId.trim() ||
  /giftproasia/i.test(lineId) ||
  /demo/i.test(lineId) ||
  !lineUrl.trim() ||
  /giftproasia/i.test(lineUrl) ||
  /example/i.test(lineUrl)
) {
  errors.push("NEXT_PUBLIC_LINE_ID / NEXT_PUBLIC_LINE_URL must not be demo values.");
}

if (!String(process.env.SITE_LEGAL_NAME ?? "").trim()) {
  errors.push("SITE_LEGAL_NAME is required when indexing is enabled.");
}

const cmsMode = String(process.env.CMS_MODE ?? "").trim().toLowerCase();
if (cmsMode !== "strapi") {
  errors.push("CMS_MODE must be strapi when indexing is enabled.");
}

const strapiUrl = process.env.STRAPI_URL ?? "";
if (!isRealHttpsUrl(strapiUrl)) {
  errors.push("STRAPI_URL must be a real HTTPS URL when indexing is enabled.");
}

const publicRead = truthy(process.env.STRAPI_PUBLIC_READ);
const strapiToken = process.env.STRAPI_API_TOKEN ?? "";
if (!publicRead && !String(strapiToken).trim()) {
  errors.push("STRAPI_API_TOKEN is required unless STRAPI_PUBLIC_READ=true.");
}

if (truthy(process.env.STRAPI_FALLBACK_TO_MOCK)) {
  errors.push("STRAPI_FALLBACK_TO_MOCK must be false when indexing is enabled.");
}

const secretKeys = [
  "IP_HASH_SECRET",
  "REVALIDATE_SECRET",
  "CRON_SECRET",
];
for (const key of secretKeys) {
  if (isPlaceholderSecret(process.env[key])) {
    errors.push(`${key} must be a real secret (>= 32 chars, not a placeholder).`);
  }
}

if (String(process.env.QUOTE_WEBHOOK_URL ?? "").trim()) {
  if (isPlaceholderSecret(process.env.QUOTE_WEBHOOK_SECRET)) {
    errors.push(
      "QUOTE_WEBHOOK_SECRET must be a real secret when QUOTE_WEBHOOK_URL is set.",
    );
  }
}

if (!truthy(process.env.RUNTIME_SECRETS_APPROVED)) {
  errors.push("RUNTIME_SECRETS_APPROVED must be true when indexing is enabled.");
}
if (!truthy(process.env.LEGAL_CONTENT_APPROVED)) {
  errors.push("LEGAL_CONTENT_APPROVED must be true when indexing is enabled.");
}
if (!truthy(process.env.REAL_ASSETS_APPROVED)) {
  errors.push("REAL_ASSETS_APPROVED must be true when indexing is enabled.");
}

if (
  truthy(process.env.ALIBABA_PUBLIC_IMAGES) &&
  !truthy(process.env.ALIBABA_IMAGES_LICENSED)
) {
  errors.push(
    "ALIBABA_IMAGES_LICENSED must be true when ALIBABA_PUBLIC_IMAGES=true (indexing on).",
  );
}

if (truthy(process.env.SITE_ENABLE_LOCAL_BUSINESS_SCHEMA)) {
  const requiredAddress = [
    "SITE_STREET_ADDRESS",
    "SITE_ADDRESS_LOCALITY",
    "SITE_POSTAL_CODE",
  ];
  for (const key of requiredAddress) {
    if (!String(process.env[key] ?? "").trim()) {
      errors.push(`${key} is required when SITE_ENABLE_LOCAL_BUSINESS_SCHEMA=true.`);
    }
  }
}

if (errors.length > 0) {
  console.error("validate:env FAILED — indexing guard rejected build:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("validate:env OK — production indexing config accepted.");
process.exit(0);
