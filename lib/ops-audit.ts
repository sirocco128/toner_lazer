/**
 * Append-only ops audit log (login, edits, approvals, report pulls).
 * Prompts and payloads are redacted before insert.
 */

import { getDb } from "@/lib/database";
import { redactSecrets } from "@/lib/ai-safety";
import { isOpsRole, type OpsActor, type OpsRole } from "@/lib/ops-roles";
import {
  describeOpsAuditImpact,
  type OpsAuditStatus,
} from "@/lib/ops-audit-labels";
import {
  parseDeviceLabel,
  type OpsAuditContext,
} from "@/lib/ops-request-context";

export type { OpsAuditStatus };

export type WriteOpsAuditParams = {
  actor?: OpsActor | null;
  action: string;
  status: OpsAuditStatus;
  resourceType?: string | null;
  resourceId?: string | null;
  toolName?: string | null;
  prompt?: string | null;
  detail?: unknown;
  ipHash?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  geoLabel?: string | null;
  deviceLabel?: string | null;
  machineHint?: string | null;
  impact?: string | null;
  reportName?: string | null;
  reportFilters?: unknown;
  errorMessage?: string | null;
} & Partial<OpsAuditContext>;

export type OpsAuditRow = {
  id: number;
  createdAt: string;
  actorEmail: string | null;
  actorName: string | null;
  role: OpsRole | null;
  action: string;
  status: OpsAuditStatus;
  resourceType: string | null;
  resourceId: string | null;
  toolName: string | null;
  prompt: string | null;
  detail: string | null;
  ipHash: string | null;
  ipAddress: string | null;
  geoLabel: string | null;
  deviceLabel: string | null;
  machineHint: string | null;
  impact: string | null;
  reportName: string | null;
  reportFilters: string | null;
  userAgent: string | null;
  errorMessage: string | null;
};

export type ListOpsAuditQuery = {
  limit?: number;
  offset?: number;
  action?: string;
  actorEmail?: string;
  status?: OpsAuditStatus | "all" | "";
  resourceType?: string;
  reportName?: string;
  q?: string;
  fromDate?: string;
  toDate?: string;
};

function truncate(value: string, max = 1_000): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function isRole(value: string | null): value is OpsRole {
  return isOpsRole(value);
}

function jsonOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? truncate(trimmed, 2_000) : null;
  }
  return truncate(JSON.stringify(redactSecrets(value)), 2_000);
}

function bangkokBound(dateYmd: string, endOfDay: boolean): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  const iso = new Date(
    `${dateYmd}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`,
  ).toISOString();
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

type AuditSqlRow = {
  id: number;
  created_at: string;
  actor_email: string | null;
  actor_name: string | null;
  role: string | null;
  action: string;
  status: string;
  resource_type: string | null;
  resource_id: string | null;
  tool_name: string | null;
  prompt: string | null;
  detail: string | null;
  ip_hash: string | null;
  ip_address: string | null;
  geo_label: string | null;
  device_label: string | null;
  machine_hint: string | null;
  impact: string | null;
  report_name: string | null;
  report_filters: string | null;
  user_agent: string | null;
  error_message: string | null;
};

function mapRow(row: AuditSqlRow): OpsAuditRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    actorEmail: row.actor_email,
    actorName: row.actor_name,
    role: isRole(row.role) ? row.role : null,
    action: row.action,
    status: row.status === "denied" ? "denied" : "ok",
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    toolName: row.tool_name,
    prompt: row.prompt,
    detail: row.detail,
    ipHash: row.ip_hash,
    ipAddress: row.ip_address ?? null,
    geoLabel: row.geo_label ?? null,
    deviceLabel: row.device_label ?? null,
    machineHint: row.machine_hint ?? null,
    impact: row.impact ?? null,
    reportName: row.report_name ?? null,
    reportFilters: row.report_filters ?? null,
    userAgent: row.user_agent,
    errorMessage: row.error_message,
  };
}

function buildWhere(query: ListOpsAuditQuery): { sql: string; params: (string | number)[] } {
  const where: string[] = [];
  const params: (string | number)[] = [];
  const action = query.action?.trim();
  if (action) {
    where.push("action = ?");
    params.push(action);
  }
  const actorEmail = query.actorEmail?.trim().toLowerCase();
  if (actorEmail) {
    where.push("lower(coalesce(actor_email, '')) = ?");
    params.push(actorEmail);
  }
  if (query.status === "ok" || query.status === "denied") {
    where.push("status = ?");
    params.push(query.status);
  }
  const resourceType = query.resourceType?.trim();
  if (resourceType) {
    where.push("resource_type = ?");
    params.push(resourceType);
  }
  const reportName = query.reportName?.trim();
  if (reportName) {
    where.push("report_name = ?");
    params.push(reportName);
  }
  const fromIso = query.fromDate ? bangkokBound(query.fromDate, false) : null;
  const toIso = query.toDate ? bangkokBound(query.toDate, true) : null;
  if (fromIso) {
    where.push("created_at >= ?");
    params.push(fromIso);
  }
  if (toIso) {
    where.push("created_at <= ?");
    params.push(toIso);
  }
  const q = query.q?.trim();
  if (q) {
    where.push(
      `(coalesce(actor_email,'') || ' ' || coalesce(actor_name,'') || ' ' || action || ' ' || coalesce(resource_id,'') || ' ' || coalesce(impact,'') || ' ' || coalesce(report_name,'') || ' ' || coalesce(report_filters,'') || ' ' || coalesce(ip_address,'') || ' ' || coalesce(device_label,'') || ' ' || coalesce(machine_hint,'')) LIKE ?`,
    );
    params.push(`%${q}%`);
  }
  return {
    sql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

export function writeOpsAudit(params: WriteOpsAuditParams): void {
  try {
    const now = new Date().toISOString();
    const redactedDetail =
      params.detail === undefined
        ? null
        : JSON.stringify(redactSecrets(params.detail));
    const prompt =
      typeof params.prompt === "string" && params.prompt.trim()
        ? truncate(String(redactSecrets(params.prompt)))
        : null;
    const reportFilters = jsonOrNull(params.reportFilters);
    const deviceLabel =
      params.deviceLabel ?? parseDeviceLabel(params.userAgent);
    const impact =
      (params.impact && params.impact.trim()) ||
      describeOpsAuditImpact({
        action: params.action,
        status: params.status,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        reportName: params.reportName,
        reportFilters: params.reportFilters,
        detail: params.detail,
        errorMessage: params.errorMessage,
      });

    getDb()
      .prepare(
        `INSERT INTO ops_audit_log (
          created_at, actor_email, actor_name, role, action, status,
          resource_type, resource_id, tool_name, prompt, detail, ip_hash,
          user_agent, error_message, ip_address, geo_label, device_label,
          machine_hint, impact, report_name, report_filters
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        now,
        params.actor?.email ?? null,
        params.actor?.name ?? null,
        params.actor?.role ?? null,
        params.action,
        params.status,
        params.resourceType ?? null,
        params.resourceId ?? null,
        params.toolName ?? null,
        prompt,
        redactedDetail,
        params.ipHash ?? null,
        params.userAgent ?? null,
        params.errorMessage ?? null,
        params.ipAddress ?? null,
        params.geoLabel ?? null,
        deviceLabel,
        params.machineHint ?? null,
        impact,
        params.reportName ?? null,
        reportFilters,
      );
  } catch (error) {
    console.error(
      "[ops-audit] write failed",
      error instanceof Error ? error.message : error,
    );
  }
}

export function listOpsAudit(options?: ListOpsAuditQuery): OpsAuditRow[] {
  try {
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
    const offset = Math.max(options?.offset ?? 0, 0);
    const { sql, params } = buildWhere(options || {});
    const rows = getDb()
      .prepare(
        `SELECT * FROM ops_audit_log ${sql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as AuditSqlRow[];
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

export function countOpsAudit(options?: ListOpsAuditQuery): number {
  try {
    const { sql, params } = buildWhere(options || {});
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS n FROM ops_audit_log ${sql}`)
      .get(...params) as { n: number };
    return Number(row?.n || 0);
  } catch {
    return 0;
  }
}

export function listOpsAuditActorOptions(): Array<{
  email: string;
  name: string | null;
}> {
  try {
    const rows = getDb()
      .prepare(
        `SELECT actor_email AS email, MAX(actor_name) AS name
         FROM ops_audit_log
         WHERE actor_email IS NOT NULL AND actor_email != ''
         GROUP BY actor_email
         ORDER BY actor_email`,
      )
      .all() as Array<{ email: string; name: string | null }>;
    return rows;
  } catch {
    return [];
  }
}

export function listOpsAuditActionOptions(): string[] {
  try {
    const rows = getDb()
      .prepare(
        `SELECT DISTINCT action FROM ops_audit_log ORDER BY action`,
      )
      .all() as Array<{ action: string }>;
    return rows.map((row) => row.action);
  } catch {
    return [];
  }
}

export function listOpsAuditReportOptions(): string[] {
  try {
    const rows = getDb()
      .prepare(
        `SELECT DISTINCT report_name AS name FROM ops_audit_log
         WHERE report_name IS NOT NULL AND report_name != ''
         ORDER BY report_name`,
      )
      .all() as Array<{ name: string }>;
    return rows.map((row) => row.name);
  } catch {
    return [];
  }
}

export function parseOpsAuditSearch(sp: {
  q?: string;
  action?: string;
  user?: string;
  status?: string;
  from?: string;
  to?: string;
  report?: string;
}): ListOpsAuditQuery {
  const from = (sp.from || "").trim();
  const to = (sp.to || "").trim();
  return {
    q: (sp.q || "").trim() || undefined,
    action: (sp.action || "").trim() || undefined,
    actorEmail: (sp.user || "").trim().toLowerCase() || undefined,
    status: sp.status === "ok" || sp.status === "denied" ? sp.status : "all",
    fromDate: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
    toDate: /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
    reportName: (sp.report || "").trim() || undefined,
  };
}

export function opsAuditFilterParams(
  query: ListOpsAuditQuery,
): Record<string, string | undefined> {
  return {
    q: query.q,
    action: query.action,
    user: query.actorEmail,
    status: query.status && query.status !== "all" ? query.status : undefined,
    from: query.fromDate,
    to: query.toDate,
    report: query.reportName,
  };
}

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function opsAuditRowsToCsv(rows: OpsAuditRow[]): string {
  const header = [
    "เมื่อ",
    "อีเมล",
    "ชื่อ",
    "บทบาท",
    "การกระทำ",
    "สถานะ",
    "ผล",
    "ประเภท",
    "รหัสรายการ",
    "IP",
    "ที่มา",
    "เครื่อง",
    "รหัสเครื่อง",
    "รายงาน",
    "ตัวกรองรายงาน",
  ];
  const lines = rows.map((row) =>
    [
      row.createdAt,
      row.actorEmail,
      row.actorName,
      row.role,
      row.action,
      row.status,
      row.impact,
      row.resourceType,
      row.resourceId,
      row.ipAddress,
      row.geoLabel,
      row.deviceLabel,
      row.machineHint,
      row.reportName,
      row.reportFilters,
    ]
      .map(csvCell)
      .join(","),
  );
  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

export function recordOpsReportPull(params: {
  actor: OpsActor;
  kind: "view" | "export";
  reportName: string;
  filters?: Record<string, string | number | null | undefined>;
  context?: Partial<OpsAuditContext>;
}): void {
  const filters = Object.fromEntries(
    Object.entries(params.filters || {}).filter(
      ([, value]) => value != null && String(value).trim() !== "",
    ),
  );
  writeOpsAudit({
    actor: params.actor,
    action: params.kind === "export" ? "report.export" : "report.view",
    status: "ok",
    resourceType: "report",
    resourceId: params.reportName,
    reportName: params.reportName,
    reportFilters: filters,
    detail: { kind: params.kind, filters },
    ...params.context,
  });
}
