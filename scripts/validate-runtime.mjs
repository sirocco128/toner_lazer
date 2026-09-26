#!/usr/bin/env node
/**
 * Runtime environment guard (runbook §14.3).
 * Enforced when RUNTIME_STRICT=true or NEXT_PUBLIC_ALLOW_INDEXING=true.
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
function isHttpsUrl(url) {
  try {
    const u = new URL(String(url ?? ""));
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

const strict =
  truthy(process.env.RUNTIME_STRICT) ||
  truthy(process.env.NEXT_PUBLIC_ALLOW_INDEXING);

if (!strict) {
  console.log(
    "validate:runtime OK — RUNTIME_STRICT and indexing are off; soft check skipped.",
  );
  process.exit(0);
}

/** @type {string[]} */
const errors = [];

const cmsMode = String(process.env.CMS_MODE ?? "").trim().toLowerCase();
if (
  cmsMode !== "mock" &&
  cmsMode !== "strapi" &&
  cmsMode !== "mysql" &&
  cmsMode !== "nexterp" &&
  cmsMode !== "smartgift"
) {
  errors.push("CMS_MODE must be mock, strapi, or mysql.");
}

const leadMode = String(process.env.LEAD_STORAGE_MODE ?? "sqlite")
  .trim()
  .toLowerCase();
if (leadMode !== "sqlite" && leadMode !== "file") {
  errors.push("LEAD_STORAGE_MODE must be sqlite or file.");
}

if (
  leadMode === "file" &&
  !truthy(process.env.ALLOW_FILE_LEAD_STORAGE)
) {
  errors.push(
    "LEAD_STORAGE_MODE=file requires ALLOW_FILE_LEAD_STORAGE=true in strict mode.",
  );
}

if (isPlaceholderSecret(process.env.IP_HASH_SECRET)) {
  errors.push(
    "IP_HASH_SECRET must be at least 32 characters and not a placeholder.",
  );
}

if (cmsMode === "strapi") {
  const strapiUrl = process.env.STRAPI_URL ?? "";
  if (!isHttpsUrl(strapiUrl)) {
    errors.push("STRAPI_URL must use HTTPS in strict mode.");
  }
  const publicRead = truthy(process.env.STRAPI_PUBLIC_READ);
  if (!publicRead && !String(process.env.STRAPI_API_TOKEN ?? "").trim()) {
    errors.push("STRAPI_API_TOKEN is required unless STRAPI_PUBLIC_READ=true.");
  }
}

if (isPlaceholderSecret(process.env.REVALIDATE_SECRET)) {
  errors.push(
    "REVALIDATE_SECRET must be at least 32 characters and not a placeholder.",
  );
}

const webhookUrl = String(process.env.QUOTE_WEBHOOK_URL ?? "").trim();
if (webhookUrl) {
  if (!isHttpsUrl(webhookUrl)) {
    errors.push("QUOTE_WEBHOOK_URL must use HTTPS when set.");
  }
  if (isPlaceholderSecret(process.env.QUOTE_WEBHOOK_SECRET)) {
    errors.push(
      "QUOTE_WEBHOOK_SECRET must be at least 32 characters when webhook URL is set.",
    );
  }
}

if (isPlaceholderSecret(process.env.CRON_SECRET)) {
  errors.push(
    "CRON_SECRET must be at least 32 characters and not a placeholder.",
  );
}

const partnerApiKey = String(process.env.PARTNER_API_KEY ?? "").trim();
if (partnerApiKey && isPlaceholderSecret(process.env.PARTNER_API_KEY)) {
  errors.push(
    "PARTNER_API_KEY must be at least 32 characters and not a placeholder when set.",
  );
}

if (errors.length > 0) {
  console.error("validate:runtime FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("validate:runtime OK — strict runtime environment accepted.");
process.exit(0);
