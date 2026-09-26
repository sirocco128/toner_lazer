#!/usr/bin/env node
/**
 * Mint a hashed partner API key into SQLite.
 * Prints the secret token once — store it in the partner system, not in git.
 *
 *   npm run partner:key -- --name n8n
 *   npm run partner:key -- --name crm --scopes quotes:read,orders:read,catalog:read
 *
 * Hash must match lib/partner-api-keys.ts hashPartnerSecret().
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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

function argValue(flag, fallback = "") {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index < 0) return fallback;
  return args[index + 1] || fallback;
}

const name = argValue("--name", "partner").trim();
const scopesRaw = argValue("--scopes", "quotes:read,orders:read,catalog:read");
const allowed = new Set(["quotes:read", "orders:read", "catalog:read"]);
const scopes = scopesRaw
  .split(/[,\s]+/)
  .map((part) => part.trim())
  .filter((part) => allowed.has(part));
if (!name) {
  console.error(
    "Usage: npm run partner:key -- --name n8n [--scopes quotes:read,orders:read,catalog:read]",
  );
  process.exit(1);
}
if (!scopes.length) {
  console.error("No valid scopes. Allowed: quotes:read, orders:read, catalog:read");
  process.exit(1);
}

const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
  cwd: ROOT,
  env: process.env,
  encoding: "utf8",
});
if (migrate.status !== 0) {
  console.error(migrate.stderr || migrate.stdout || "migrate failed");
  process.exit(migrate.status ?? 1);
}

const sqlitePath = resolve(ROOT, process.env.SQLITE_PATH || ".data/leads.sqlite");
mkdirSync(dirname(sqlitePath), { recursive: true });
const db = new DatabaseSync(sqlitePath);
const keyId = randomBytes(8).toString("hex");
const secret = randomBytes(32).toString("hex");
const secretHash = createHash("sha256").update(`${keyId}.${secret}`, "utf8").digest("hex");
const now = new Date().toISOString();
const token = `sgp_${keyId}.${secret}`;

try {
  db.prepare(
    `INSERT INTO partner_api_keys (
       key_id, secret_hash, name, scopes_json, enabled,
       expires_at, revoked_at, last_used_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 1, NULL, NULL, NULL, ?, ?)`,
  ).run(keyId, secretHash, name, JSON.stringify(scopes), now, now);
} finally {
  db.close();
}

console.log("Partner API key created. Store the token now — it is not shown again.");
console.log(`name:    ${name}`);
console.log(`key_id:  ${keyId}`);
console.log(`scopes:  ${scopes.join(",")}`);
console.log(`token:   ${token}`);
console.log("");
console.log("Example:");
console.log(
  `curl -H "Authorization: Bearer ${token}" ${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/partner/v1`,
);
