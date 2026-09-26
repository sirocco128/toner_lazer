#!/usr/bin/env node
/**
 * Restore lead SQLite from a backup created by backup-leads.mjs.
 *
 * Usage:
 *   node scripts/restore-leads.mjs <backup.sqlite>
 *   node scripts/restore-leads.mjs <backup.sqlite> --force
 *
 * Safety: refuses to overwrite an existing SQLITE_PATH unless --force.
 * With --force, snapshots the current DB to .data/backups/pre-restore-*.sqlite first.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
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

const args = process.argv.slice(2).filter((a) => a !== "--");
const force = args.includes("--force");
const backupArg = args.find((a) => !a.startsWith("-"));

if (!backupArg) {
  console.error("Usage: node scripts/restore-leads.mjs <backup.sqlite> [--force]");
  process.exit(1);
}

const backupPath = resolve(process.cwd(), backupArg);
const sqlitePath = resolve(ROOT, process.env.SQLITE_PATH || ".data/leads.sqlite");

if (!existsSync(backupPath)) {
  console.error(`Backup not found: ${backupPath}`);
  process.exit(1);
}

if (!backupPath.endsWith(".sqlite") && !backupPath.endsWith(".db")) {
  console.error("Refusing restore: backup path should end with .sqlite or .db");
  process.exit(1);
}

if (existsSync(sqlitePath) && !force) {
  console.error(`Target already exists: ${sqlitePath}`);
  console.error("Pass --force to replace it (a pre-restore snapshot will be kept).");
  process.exit(1);
}

mkdirSync(dirname(sqlitePath), { recursive: true });
mkdirSync(resolve(ROOT, ".data/backups"), { recursive: true });

if (existsSync(sqlitePath) && force) {
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
  const safety = resolve(ROOT, `.data/backups/pre-restore-${stamp}.sqlite`);
  renameSync(sqlitePath, safety);
  console.log(`Moved existing DB to: ${safety}`);
}

copyFileSync(backupPath, sqlitePath);
console.log(`Restored ${backupPath}`);
console.log(`     → ${sqlitePath}`);
