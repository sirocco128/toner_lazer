/**
 * Legal hold — two-person release. MinIO Object Lock is updated when configured.
 */

import { getDb } from "@/lib/database";
import { recordObjectAccess } from "@/lib/object-access";
import {
  bucketForObject,
  deleteObject,
  kindFromObjectKey,
  minioConfig,
  setObjectLegalHold,
} from "@/lib/object-storage";
import type { OpsActor } from "@/lib/ops-roles";

export type LegalHoldRow = {
  id: number;
  objectKey: string;
  bucket: string | null;
  reason: string;
  caseRef: string | null;
  heldByEmail: string;
  heldByName: string | null;
  heldAt: string;
  releasedByEmail: string | null;
  releasedByName: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
};

type Row = {
  id: number;
  object_key: string;
  bucket: string | null;
  reason: string;
  case_ref: string | null;
  held_by_email: string;
  held_by_name: string | null;
  held_at: string;
  released_by_email: string | null;
  released_by_name: string | null;
  released_at: string | null;
  release_reason: string | null;
};

function mapRow(row: Row): LegalHoldRow {
  return {
    id: row.id,
    objectKey: row.object_key,
    bucket: row.bucket,
    reason: row.reason,
    caseRef: row.case_ref,
    heldByEmail: row.held_by_email,
    heldByName: row.held_by_name,
    heldAt: row.held_at,
    releasedByEmail: row.released_by_email,
    releasedByName: row.released_by_name,
    releasedAt: row.released_at,
    releaseReason: row.release_reason,
  };
}

export function normalizeObjectKey(raw: string): string {
  return String(raw || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

export function activeHoldForKey(objectKey: string): LegalHoldRow | null {
  const key = normalizeObjectKey(objectKey);
  if (!key) return null;
  const row = getDb()
    .prepare(
      `SELECT * FROM object_legal_holds
       WHERE object_key = ? AND released_at IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get(key) as Row | undefined;
  return row ? mapRow(row) : null;
}

export function isObjectHeld(objectKey: string): boolean {
  return activeHoldForKey(objectKey) !== null;
}

export async function deleteStoredObject(key: string): Promise<void> {
  if (isObjectHeld(key)) throw new Error("legal_hold");
  await deleteObject(key);
}

export function listLegalHolds(options?: { activeOnly?: boolean; limit?: number }): LegalHoldRow[] {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const sql = options?.activeOnly === false
    ? `SELECT * FROM object_legal_holds ORDER BY id DESC LIMIT ?`
    : `SELECT * FROM object_legal_holds WHERE released_at IS NULL ORDER BY id DESC LIMIT ?`;
  const rows = getDb().prepare(sql).all(limit) as Row[];
  return rows.map(mapRow);
}

export async function applyLegalHold(input: {
  actor: OpsActor;
  objectKey: string;
  reason: string;
  caseRef?: string | null;
}): Promise<LegalHoldRow> {
  const key = normalizeObjectKey(input.objectKey);
  const reason = input.reason.trim();
  const caseRef = (input.caseRef || "").trim() || null;
  if (!key) throw new Error("missing_key");
  if (reason.length < 3) throw new Error("purpose_required");
  if (activeHoldForKey(key)) throw new Error("already_held");
  const kind = kindFromObjectKey(key);
  const bucket = kind ? bucketForObject(kind) : null;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO object_legal_holds (
        object_key, bucket, reason, case_ref, held_by_email, held_by_name, held_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(key, bucket, reason, caseRef, input.actor.email, input.actor.name, now);
  if (minioConfig()) {
    try {
      await setObjectLegalHold(key, true);
    } catch {
      // DB hold still applies when the object is not yet in MinIO.
    }
  }
  recordObjectAccess({
    actor: input.actor,
    action: "object.hold",
    status: "ok",
    key,
    resourceId: key,
    purpose: reason,
  });
  return activeHoldForKey(key)!;
}

export async function releaseLegalHold(input: {
  actor: OpsActor;
  objectKey: string;
  reason: string;
}): Promise<LegalHoldRow> {
  const key = normalizeObjectKey(input.objectKey);
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error("purpose_required");
  const hold = activeHoldForKey(key);
  if (!hold) throw new Error("not_held");
  if (hold.heldByEmail.toLowerCase() === input.actor.email.toLowerCase()) {
    throw new Error("same_actor_release");
  }
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE object_legal_holds
       SET released_by_email = ?, released_by_name = ?, released_at = ?, release_reason = ?
       WHERE id = ?`,
    )
    .run(input.actor.email, input.actor.name, now, reason, hold.id);
  if (minioConfig()) {
    try {
      await setObjectLegalHold(key, false);
    } catch {
      // Keep the release recorded even if MinIO has no object yet.
    }
  }
  recordObjectAccess({
    actor: input.actor,
    action: "object.hold.release",
    status: "ok",
    key,
    resourceId: key,
    purpose: reason,
  });
  const row = getDb()
    .prepare(`SELECT * FROM object_legal_holds WHERE id = ?`)
    .get(hold.id) as Row;
  return mapRow(row);
}
