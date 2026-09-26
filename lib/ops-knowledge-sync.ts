/**
 * Sync published SmartGift facts into Terabis KB (trantech-ai-platform).
 * Prefer TRANTECH_INTERNAL_API_URL; fall back to local CLI under TRANTECH_ROOT.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/database";
import type { OpsActor } from "@/lib/ops-roles";

export type KnowledgeChangeStatus = "new" | "changed" | "stale" | "match";

export type KnowledgeChange = {
  id: string;
  status: KnowledgeChangeStatus;
  title: string;
  kbFile?: string;
  source?: string;
  detail: string;
};

export type KnowledgeCatalogStats = {
  ok: boolean;
  offerCount: number | null;
  pricedCount: number | null;
  unpricedCount: number | null;
  categories: Array<{ slug: string; name: string; offerCount: number }>;
  error: string | null;
};

export type KnowledgeDiff = {
  webRoot: string;
  kbRoot: string;
  sourceOk: boolean;
  lastSyncAt: string | null;
  catalog: KnowledgeCatalogStats;
  changes: KnowledgeChange[];
  changedCount: number;
  canSync: boolean;
  note: string;
  summary: string;
  applied?: boolean;
  written?: string[];
};

export type KnowledgeSyncLogRow = {
  id: number;
  createdAt: string;
  actorEmail: string | null;
  actorName: string | null;
  mode: "diff" | "sync";
  status: "ok" | "error";
  applied: boolean;
  changedCount: number;
  written: string[];
  changes: KnowledgeChange[];
  catalog: Partial<KnowledgeCatalogStats> | null;
  summary: string | null;
  source: string | null;
  errorMessage: string | null;
};

function apiBase(): string {
  return (process.env.TRANTECH_INTERNAL_API_URL || "http://127.0.0.1:8100").replace(
    /\/$/,
    "",
  );
}

function apiToken(): string {
  return (
    process.env.TRANTECH_INTERNAL_API_TOKEN ||
    process.env.INTERNAL_API_TOKEN ||
    "phase1-internal-api-token"
  );
}

function trantechRoot(): string {
  const fromEnv = (process.env.TRANTECH_ROOT || "").trim();
  if (fromEnv) {
    // Avoid Windows drive paths resolving under /app on Linux containers.
    if (process.platform !== "win32" && /^[A-Za-z]:[\\/]/.test(fromEnv)) {
      return "";
    }
    return path.resolve(fromEnv);
  }
  if (process.platform === "win32") {
    return path.resolve("D:/trantech-ai-platform");
  }
  return "";
}

function toTaipActor(actor: OpsActor) {
  return {
    userId: actor.staffId ? `ops-${actor.staffId}` : `ops-${actor.email}`,
    email: actor.email,
    displayName: actor.name || actor.email,
    role: "Administrator",
    departmentId: "office",
    customerId: null,
    permissions: ["knowledge.write", "knowledge.read"],
    appId: "terabis",
  };
}

async function callApi<T>(
  method: "GET" | "POST",
  route: string,
  actor: OpsActor,
): Promise<T> {
  const res = await fetch(`${apiBase()}${route}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "premium-giftset-web/ops-knowledge-sync",
      "x-internal-token": apiToken(),
      "x-actor": `b64:${Buffer.from(JSON.stringify(toTaipActor(actor))).toString("base64")}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: T; error?: string; ftag?: string }
    | null;
  if (body && typeof body.ftag === "string") {
    throw new Error(
      "TranTech API ปฏิเสธ request (scrape-guard) — ตรวจ User-Agent / token",
    );
  }
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || `TranTech API ${res.status}`);
  }
  return body.data as T;
}

function runLocalCli(mode: "diff" | "sync" | "log", actor: OpsActor): unknown {
  const root = trantechRoot();
  if (!root) {
    throw new Error(
      "ไม่มี TRANTECH_ROOT ที่ใช้ได้บนเครื่องนี้ — ตั้ง TRANTECH_INTERNAL_API_URL ให้ชี้ TranTech internal-api",
    );
  }
  const script = path.join(root, "scripts", "giftset-kb.mts");
  if (!fs.existsSync(script)) {
    throw new Error(`ไม่พบสคริปต์ซิงค์ที่ ${script}`);
  }
  const flag = mode === "sync" ? "--sync" : mode === "log" ? "--log" : "--diff";
  const result = spawnSync(
    "npx",
    ["tsx", script, flag],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GIFTSET_WEB_ROOT:
          process.env.GIFTSET_WEB_ROOT ||
          path.resolve(process.cwd()),
        TERABIS_KB_PATH:
          process.env.TERABIS_KB_PATH ||
          path.join(root, "docs", "kb", "terabis"),
        OPS_ACTOR_EMAIL: actor.email,
        OPS_ACTOR_NAME: actor.name,
      },
      windowsHide: true,
      timeout: 90_000,
    },
  );
  if (result.error) throw result.error;
  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();
  if (result.status !== 0) {
    throw new Error(stderr || stdout || `local sync exit ${result.status}`);
  }
  const jsonLine = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .reverse()
    .find((l) => l.startsWith("{"));
  if (!jsonLine) throw new Error("local sync ไม่คืน JSON");
  const parsed = JSON.parse(jsonLine) as { ok?: boolean; data?: unknown; error?: string };
  if (!parsed.ok) throw new Error(parsed.error || "local sync failed");
  return parsed.data;
}

export async function fetchKnowledgeDiff(actor: OpsActor): Promise<{
  data: KnowledgeDiff;
  source: "api" | "local";
}> {
  try {
    const data = await callApi<KnowledgeDiff>("GET", "/v1/knowledge/giftset/diff", actor);
    return { data, source: "api" };
  } catch (apiErr) {
    try {
      const data = runLocalCli("diff", actor) as KnowledgeDiff;
      return { data, source: "local" };
    } catch (localErr) {
      const a = apiErr instanceof Error ? apiErr.message : String(apiErr);
      const b = localErr instanceof Error ? localErr.message : String(localErr);
      throw new Error(`อ่าน diff ไม่สำเร็จ — API: ${a} · local: ${b}`);
    }
  }
}

export async function applyKnowledgeSync(actor: OpsActor): Promise<{
  data: KnowledgeDiff;
  source: "api" | "local";
}> {
  try {
    const data = await callApi<KnowledgeDiff>("POST", "/v1/knowledge/giftset/sync", actor);
    return { data, source: "api" };
  } catch (apiErr) {
    try {
      const data = runLocalCli("sync", actor) as KnowledgeDiff;
      return { data, source: "local" };
    } catch (localErr) {
      const a = apiErr instanceof Error ? apiErr.message : String(apiErr);
      const b = localErr instanceof Error ? localErr.message : String(localErr);
      throw new Error(`ซิงค์ไม่สำเร็จ — API: ${a} · local: ${b}`);
    }
  }
}

export async function fetchRemoteSyncLog(actor: OpsActor, limit = 40): Promise<unknown[]> {
  try {
    return await callApi<unknown[]>("GET", `/v1/knowledge/giftset/sync-log?limit=${limit}`, actor);
  } catch {
    try {
      const data = runLocalCli("log", actor);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}

export function insertKnowledgeSyncLog(row: {
  actor: OpsActor | null;
  mode: "diff" | "sync";
  status: "ok" | "error";
  applied?: boolean;
  changedCount?: number;
  written?: string[];
  changes?: KnowledgeChange[];
  catalog?: Partial<KnowledgeCatalogStats> | null;
  summary?: string | null;
  source?: string | null;
  errorMessage?: string | null;
}): number {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO ops_knowledge_sync_log (
        created_at, actor_email, actor_name, mode, status, applied,
        changed_count, written_json, changes_json, catalog_json,
        summary, source, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      now,
      row.actor?.email ?? null,
      row.actor?.name ?? null,
      row.mode,
      row.status,
      row.applied ? 1 : 0,
      row.changedCount ?? 0,
      JSON.stringify(row.written || []),
      JSON.stringify(row.changes || []),
      row.catalog ? JSON.stringify(row.catalog) : null,
      row.summary ?? null,
      row.source ?? null,
      row.errorMessage ?? null,
    );
  return Number(result.lastInsertRowid || 0);
}

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export function listKnowledgeSyncLogs(limit = 40): KnowledgeSyncLogRow[] {
  try {
    const rows = getDb()
      .prepare(
        `SELECT * FROM ops_knowledge_sync_log
         ORDER BY id DESC LIMIT ?`,
      )
      .all(Math.min(Math.max(limit, 1), 200)) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      createdAt: String(r.created_at || ""),
      actorEmail: (r.actor_email as string) || null,
      actorName: (r.actor_name as string) || null,
      mode: (r.mode as "diff" | "sync") || "diff",
      status: (r.status as "ok" | "error") || "error",
      applied: Number(r.applied) === 1,
      changedCount: Number(r.changed_count) || 0,
      written: parseJsonArray<string>(r.written_json as string | null),
      changes: parseJsonArray<KnowledgeChange>(r.changes_json as string | null),
      catalog: (() => {
        try {
          return r.catalog_json
            ? (JSON.parse(String(r.catalog_json)) as Partial<KnowledgeCatalogStats>)
            : null;
        } catch {
          return null;
        }
      })(),
      summary: (r.summary as string) || null,
      source: (r.source as string) || null,
      errorMessage: (r.error_message as string) || null,
    }));
  } catch {
    return [];
  }
}

export function knowledgeSyncConfigured(): {
  apiUrl: string;
  trantechRoot: string;
  localScriptExists: boolean;
} {
  const root = trantechRoot();
  return {
    apiUrl: apiBase(),
    trantechRoot: root || "(ไม่ตั้งค่า — ใช้ API เท่านั้น)",
    localScriptExists: Boolean(
      root && fs.existsSync(path.join(root, "scripts", "giftset-kb.mts")),
    ),
  };
}
