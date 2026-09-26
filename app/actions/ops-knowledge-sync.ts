"use server";

import { revalidatePath } from "next/cache";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor, isPlatformAdmin } from "@/lib/ops-auth";
import {
  applyKnowledgeSync,
  fetchKnowledgeDiff,
  fetchRemoteSyncLog,
  insertKnowledgeSyncLog,
  knowledgeSyncConfigured,
  listKnowledgeSyncLogs,
  type KnowledgeDiff,
  type KnowledgeSyncLogRow,
} from "@/lib/ops-knowledge-sync";

async function requireAdmin() {
  const actor = await requireOpsActor();
  if (!actor || !isPlatformAdmin(actor.role)) return null;
  return actor;
}

export async function getKnowledgeSyncStatusAction(): Promise<{
  ok: true;
  config: ReturnType<typeof knowledgeSyncConfigured>;
  logs: KnowledgeSyncLogRow[];
  remoteLogCount: number;
} | { ok: false; error: string }> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "เฉพาะผู้ดูแลระบบเท่านั้น" };
  const remote = await fetchRemoteSyncLog(actor, 20);
  return {
    ok: true,
    config: knowledgeSyncConfigured(),
    logs: listKnowledgeSyncLogs(40),
    remoteLogCount: remote.length,
  };
}

export async function diffKnowledgeAction(): Promise<
  | { ok: true; data: KnowledgeDiff; source: "api" | "local" }
  | { ok: false; error: string }
> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "เฉพาะผู้ดูแลระบบเท่านั้น" };
  try {
    const { data, source } = await fetchKnowledgeDiff(actor);
    insertKnowledgeSyncLog({
      actor,
      mode: "diff",
      status: "ok",
      applied: false,
      changedCount: data.changedCount,
      changes: data.changes.filter((c) => c.status !== "match"),
      catalog: data.catalog,
      summary: data.summary,
      source,
    });
    writeOpsAudit({
      actor,
      action: "knowledge.diff",
      status: "ok",
      resourceType: "terabis_kb",
      detail: {
        changedCount: data.changedCount,
        source,
        lastSyncAt: data.lastSyncAt,
      },
    });
    revalidatePath("/ops/knowledge-sync");
    return { ok: true, data, source };
  } catch (err) {
    const error = err instanceof Error ? err.message : "อ่าน diff ไม่สำเร็จ";
    insertKnowledgeSyncLog({
      actor,
      mode: "diff",
      status: "error",
      errorMessage: error,
    });
    writeOpsAudit({
      actor,
      action: "knowledge.diff",
      status: "denied",
      resourceType: "terabis_kb",
      errorMessage: error,
    });
    return { ok: false, error };
  }
}

export async function syncKnowledgeAction(raw: {
  confirm: string;
}): Promise<
  | { ok: true; data: KnowledgeDiff; source: "api" | "local" }
  | { ok: false; error: string }
> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "เฉพาะผู้ดูแลระบบเท่านั้น" };
  if (String(raw.confirm || "").trim() !== "อัปเดต") {
    return { ok: false, error: "พิมพ์คำว่า อัปเดต เพื่อยืนยัน" };
  }
  try {
    const { data, source } = await applyKnowledgeSync(actor);
    insertKnowledgeSyncLog({
      actor,
      mode: "sync",
      status: "ok",
      applied: !!data.applied,
      changedCount: data.changedCount,
      written: data.written || [],
      changes: (data.changes || []).filter((c) => c.status !== "match"),
      catalog: data.catalog,
      summary: data.summary,
      source,
    });
    writeOpsAudit({
      actor,
      action: "knowledge.sync",
      status: "ok",
      resourceType: "terabis_kb",
      detail: {
        applied: data.applied,
        written: data.written,
        changedCount: data.changedCount,
        source,
        lastSyncAt: data.lastSyncAt,
      },
    });
    revalidatePath("/ops/knowledge-sync");
    revalidatePath("/ops/audit");
    return { ok: true, data, source };
  } catch (err) {
    const error = err instanceof Error ? err.message : "ซิงค์ไม่สำเร็จ";
    insertKnowledgeSyncLog({
      actor,
      mode: "sync",
      status: "error",
      errorMessage: error,
    });
    writeOpsAudit({
      actor,
      action: "knowledge.sync",
      status: "denied",
      resourceType: "terabis_kb",
      errorMessage: error,
    });
    return { ok: false, error };
  }
}
