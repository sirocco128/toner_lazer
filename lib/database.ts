/**
 * SQLite access via Node.js built-in node:sqlite (DatabaseSync).
 * Intended for server-side use only (Route Handlers, Server Actions, scripts).
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let dbInstance: DatabaseSync | null = null;

function resolveSqlitePath(): string {
  const configured = (process.env.SQLITE_PATH || ".data/leads.sqlite").trim();
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

function applyPragmas(db: DatabaseSync): void {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
}

export function getSqlitePath(): string {
  return resolveSqlitePath();
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const sqlitePath = resolveSqlitePath();
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

  const db = new DatabaseSync(sqlitePath);
  applyPragmas(db);
  dbInstance = db;
  return db;
}

export function pingDb(): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
  return row?.ok === 1;
}

/** Test helper — close and drop the singleton. */
export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore close errors during teardown
    }
    dbInstance = null;
  }
}
