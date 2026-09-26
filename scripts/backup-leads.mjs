#!/usr/bin/env node
/**
 * Copy lead SQLite DB to .data/backups/leads-YYYYMMDD-HHMMSS.sqlite (+ .sha256).
 * SQLITE_PATH defaults to .data/leads.sqlite (same as migrate / app).
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
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

const sqlitePath = resolve(ROOT, process.env.SQLITE_PATH || ".data/leads.sqlite");
const backupDir = resolve(ROOT, ".data/backups");

if (!existsSync(sqlitePath)) {
  console.error(`Lead database not found: ${sqlitePath}`);
  console.error("Run the app or `npm run db:migrate` first, or set SQLITE_PATH.");
  process.exit(1);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = [
  now.getFullYear(),
  pad(now.getMonth() + 1),
  pad(now.getDate()),
  "-",
  pad(now.getHours()),
  pad(now.getMinutes()),
  pad(now.getSeconds()),
].join("");

mkdirSync(backupDir, { recursive: true });
const dest = join(backupDir, `leads-${stamp}.sqlite`);
copyFileSync(sqlitePath, dest);

const hash = createHash("sha256").update(readFileSync(dest)).digest("hex");
const checksumPath = `${dest}.sha256`;
writeFileSync(checksumPath, `${hash}  ${dest.split(/[/\\]/).pop()}\n`, "utf8");

console.log(`Backup written: ${dest}`);
console.log(`Checksum:       ${checksumPath}`);
console.log(`SHA-256:        ${hash}`);
