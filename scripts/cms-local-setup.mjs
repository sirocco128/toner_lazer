#!/usr/bin/env node
/**
 * Local-only CMS setup helper (Sprint 1 option A).
 * Requires Strapi running on STRAPI_URL (default http://127.0.0.1:1337)
 * and an existing admin user.
 *
 * Usage:
 *   CMS_ADMIN_EMAIL=... CMS_ADMIN_PASSWORD=... node scripts/cms-local-setup.mjs
 *
 * Prints API token and enables Public find/findOne for content collections.
 * Does NOT print or commit secrets into the repo.
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

const BASE = (process.env.STRAPI_URL || "http://127.0.0.1:1337").replace(/\/$/, "");
const EMAIL = process.env.CMS_ADMIN_EMAIL || "";
const PASSWORD = process.env.CMS_ADMIN_PASSWORD || "";

if (!EMAIL || !PASSWORD) {
  console.error("Set CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD");
  process.exit(1);
}

async function adminLogin() {
  const r = await fetch(`${BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`login failed: ${JSON.stringify(j)}`);
  return j.data.token;
}

async function ensureApiToken(adminToken) {
  const name = process.env.CMS_API_TOKEN_NAME || `nextjs-local-${Date.now()}`;
  const r = await fetch(`${BASE}/admin/api-tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description: "Local Next.js (prefer read-only in staging+)",
      type: process.env.CMS_API_TOKEN_TYPE || "full-access",
      lifespan: null,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`api token: ${JSON.stringify(j)}`);
  return j.data.accessKey;
}

async function enablePublicRead(adminToken) {
  const roleRes = await fetch(`${BASE}/users-permissions/roles/2`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { role } = await roleRes.json();
  for (const uid of [
    "api::product",
    "api::gift-set-category",
    "api::article",
    "api::faq",
    "api::portfolio",
  ]) {
    const controllers = role.permissions?.[uid]?.controllers || {};
    for (const actions of Object.values(controllers)) {
      for (const action of ["find", "findOne"]) {
        if (actions[action]) actions[action].enabled = true;
      }
    }
  }
  const upd = await fetch(`${BASE}/users-permissions/roles/2`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(role),
  });
  if (!upd.ok) throw new Error(`permissions: ${await upd.text()}`);
}

function upsertEnvLocal(updates) {
  const path = resolve(process.cwd(), ".env.local");
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) {
      out.push(line);
      continue;
    }
    const key = line.split("=", 1)[0].trim();
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      out.push(`${key}=${updates[key]}`);
      seen.add(key);
    } else {
      out.push(line);
    }
  }
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) out.push(`${k}=${v}`);
  }
  writeFileSync(path, `${out.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").replace(/\n*$/, "\n")}`);
}

const adminToken = await adminLogin();
await enablePublicRead(adminToken);
const apiToken = await ensureApiToken(adminToken);

const revalidate =
  process.env.REVALIDATE_SECRET || randomBytes(24).toString("hex");

upsertEnvLocal({
  CMS_MODE: "strapi",
  STRAPI_URL: BASE,
  STRAPI_API_TOKEN: apiToken,
  STRAPI_PUBLIC_READ: "true",
  STRAPI_FALLBACK_TO_MOCK: process.env.STRAPI_FALLBACK_TO_MOCK || "true",
  REVALIDATE_SECRET: revalidate,
});

console.log("Public find/findOne enabled.");
console.log("Updated .env.local (CMS_MODE=strapi, STRAPI_API_TOKEN, REVALIDATE_SECRET).");
console.log("Smoke:");
console.log(`  curl -sS ${BASE}/api/faqs | head`);
console.log(
  `  curl -sS -X POST http://127.0.0.1:3000/api/revalidate -H "Authorization: Bearer $REVALIDATE_SECRET" -H "Content-Type: application/json" -d '{"event":"entry.publish","model":"faq"}'`,
);
