/**
 * Append-only audit for object upload / download / deny.
 * Bytes never go in the log — only key, class, and actor.
 */

import { writeOpsAudit, type OpsAuditStatus } from "@/lib/ops-audit";
import { opsAuditContextFromHeaders } from "@/lib/ops-request-context";
import type { OpsActor } from "@/lib/ops-roles";
import {
  kindFromObjectKey,
  objectClassForKind,
  type ObjectKind,
} from "@/lib/object-storage";

export const OBJECT_AUDIT_ACTIONS = [
  "object.upload",
  "object.download",
  "object.deny",
  "object.delete",
  "object.hold",
  "object.hold.release",
] as const;

export type ObjectAuditAction = (typeof OBJECT_AUDIT_ACTIONS)[number];

export function permissionForObjectKind(
  kind: ObjectKind,
): "documents.read" | "documents.restricted" | "catalog.write" | "factory.read" {
  if (kind === "slips") return "documents.restricted";
  if (kind === "documents") return "documents.read";
  if (kind === "mockups") return "factory.read";
  return "catalog.write";
}

export function recordObjectAccess(input: {
  actor?: OpsActor | null;
  action: ObjectAuditAction;
  status: OpsAuditStatus;
  key?: string | null;
  kind?: ObjectKind | null;
  resourceId?: string | null;
  purpose?: string | null;
  errorMessage?: string | null;
  request?: Request | null;
}): void {
  const kind =
    input.kind || (input.key ? kindFromObjectKey(input.key) : null);
  const classification = kind ? objectClassForKind(kind) : null;
  const ctx = input.request?.headers
    ? opsAuditContextFromHeaders(input.request.headers)
    : {};
  writeOpsAudit({
    actor: input.actor,
    action: input.action,
    status: input.status,
    resourceType: classification || kind || "object",
    resourceId: input.resourceId || input.key || null,
    detail: {
      key: input.key || null,
      kind,
      classification,
      purpose: input.purpose || null,
    },
    ...ctx,
    errorMessage: input.errorMessage || null,
  });
}
