#!/usr/bin/env node
/**
 * Apply db/migrations/*.sql against SQLITE_PATH (default .data/leads.sqlite).
 * Idempotent via CREATE IF NOT EXISTS and schema_migrations tracking.
 */
import { readdirSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
const migrationsDir = join(ROOT, "db", "migrations");

mkdirSync(dirname(sqlitePath), { recursive: true });

const db = new DatabaseSync(sqlitePath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL
  );
`);

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log("No migrations found.");
  db.close();
  process.exit(0);
}

const appliedStmt = db.prepare(
  "SELECT 1 AS ok FROM schema_migrations WHERE id = ?",
);
const insertStmt = db.prepare(
  "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
);

let appliedCount = 0;
for (const file of files) {
  const already = appliedStmt.get(file);
  if (already) {
    console.log(`skip  ${file}`);
    continue;
  }
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.exec(sql);
    insertStmt.run(file, new Date().toISOString());
    db.exec("COMMIT;");
    appliedCount += 1;
    console.log(`apply ${file}`);
  } catch (err) {
    db.exec("ROLLBACK;");
    console.error(`Failed migration ${file}:`, err);
    db.close();
    process.exit(1);
  }
}

db.close();
console.log(
  `Migration complete. Applied ${appliedCount} new file(s). Database: ${sqlitePath}`,
);
