/**
 * SQLite QuoteRepository adapter (default).
 *
 * Implements QuoteRepository for single-instance / local persistence.
 * Future multi-instance: add PostgresQuoteRepository implementing the same
 * interface from quote-repository-types.ts (runbook §33.5) — not implemented yet.
 */

import { getDb } from "@/lib/database";
import type {
  ClaimDueOutboxOptions,
  ConsumeRateLimitOptions,
  InsertQuoteParams,
  QuoteRepository,
  WebhookStatusUpdate,
} from "@/lib/quote-repository-types";
import type {
  DecorationMethod,
  LeadStatus,
  QuoteRequestRecord,
  QuoteSalesTimelineEntry,
  WebhookStatus,
} from "@/lib/quote-types";
import { LEAD_STATUSES } from "@/lib/quote-types";

export type ListQuotesOptions = {
  q?: string;
  leadStatus?: LeadStatus | "all";
  customerId?: number;
  limit?: number;
  offset?: number;
};

export type QuoteOpsActor = {
  email: string;
  name: string;
  role: string;
};

export type UpdateQuoteOpsParams = {
  requestId: string;
  leadStatus?: LeadStatus;
  salesNotes?: string | null;
  customerId?: number | null;
  actor?: QuoteOpsActor | null;
  /** Note written to the timeline. Empty string is ignored. */
  timelineNote?: string | null;
};

export type {
  ClaimDueOutboxOptions,
  ConsumeRateLimitOptions,
  InsertQuoteParams,
  QuoteRepository,
  WebhookStatusUpdate,
} from "@/lib/quote-repository-types";

function asLeadStatus(value: string | null | undefined): LeadStatus | null {
  if (!value) return null;
  return (LEAD_STATUSES as readonly string[]).includes(value)
    ? (value as LeadStatus)
    : null;
}

type QuoteTimelineRow = {
  id: number;
  request_id: string;
  created_at: string;
  actor_email: string | null;
  actor_name: string | null;
  actor_role: string | null;
  from_status: string | null;
  to_status: string;
  note: string | null;
};

function mapTimelineRow(row: QuoteTimelineRow): QuoteSalesTimelineEntry {
  return {
    id: row.id,
    requestId: row.request_id,
    createdAt: row.created_at,
    actorEmail: row.actor_email,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    fromStatus: asLeadStatus(row.from_status),
    toStatus: (asLeadStatus(row.to_status) ?? "new") as LeadStatus,
    note: row.note,
  };
}

type QuoteRow = {
  id: number;
  request_id: string;
  submitted_at: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  quantity: number;
  budget_per_set: number | null;
  needed_date: string | null;
  province: string | null;
  billing_branch: string | null;
  product_interest: string | null;
  product_slug: string | null;
  decoration_method: string;
  detail: string | null;
  consent_at: string;
  landing_path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  ip_hash: string;
  user_agent: string | null;
  lead_status: string;
  webhook_status: string;
  webhook_attempt_count: number;
  webhook_error: string | null;
  webhook_delivered_at: string | null;
  webhook_last_attempt_at: string | null;
  webhook_next_attempt_at: string | null;
  raw_payload: string;
  customer_id: number | null;
  sales_notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: QuoteRow): QuoteRequestRecord {
  return {
    id: row.id,
    requestId: row.request_id,
    submittedAt: row.submitted_at,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    quantity: row.quantity,
    budgetPerSet: row.budget_per_set,
    neededDate: row.needed_date,
    province: row.province,
    billingBranch: row.billing_branch ?? null,
    productInterest: row.product_interest,
    productSlug: row.product_slug,
    decorationMethod: row.decoration_method as DecorationMethod,
    detail: row.detail,
    consentAt: row.consent_at,
    landingPath: row.landing_path,
    referrer: row.referrer,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmTerm: row.utm_term,
    utmContent: row.utm_content,
    ipHash: row.ip_hash,
    userAgent: row.user_agent,
    leadStatus: row.lead_status as LeadStatus,
    webhookStatus: row.webhook_status as WebhookStatus,
    webhookAttemptCount: row.webhook_attempt_count,
    webhookError: row.webhook_error,
    webhookDeliveredAt: row.webhook_delivered_at,
    webhookLastAttemptAt: row.webhook_last_attempt_at,
    webhookNextAttemptAt: row.webhook_next_attempt_at,
    rawPayload: row.raw_payload,
    customerId: row.customer_id ?? null,
    salesNotes: row.sales_notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** SQLite-backed QuoteRepository (default for Sprint 0 / single instance). */
export class SqliteQuoteRepository implements QuoteRepository {
  insert(params: InsertQuoteParams): QuoteRequestRecord {
    const db = getDb();
    const now = params.submittedAt;
    const { input } = params;

    db.prepare(
      `INSERT INTO quote_requests (
        request_id, submitted_at, name, company, email, phone, quantity,
        budget_per_set, needed_date, province, billing_branch, product_interest, product_slug,
        decoration_method, detail, consent_at, landing_path, referrer,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        ip_hash, user_agent, lead_status, webhook_status, webhook_attempt_count,
        webhook_next_attempt_at, raw_payload, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, 'new', ?, 0,
        ?, ?, ?, ?
      )`,
    ).run(
      params.requestId,
      params.submittedAt,
      input.name,
      input.company,
      input.email,
      input.phone,
      input.quantity,
      input.budgetPerSet ?? null,
      input.neededDate ?? null,
      input.province ?? null,
      input.billingBranch ?? null,
      input.productInterest ?? null,
      input.productSlug ?? null,
      input.decorationMethod,
      input.detail ?? null,
      params.consentAt,
      input.landingPath ?? null,
      input.referrer ?? null,
      input.utmSource ?? null,
      input.utmMedium ?? null,
      input.utmCampaign ?? null,
      input.utmTerm ?? null,
      input.utmContent ?? null,
      params.ipHash,
      params.userAgent,
      params.webhookStatus,
      params.webhookNextAttemptAt,
      params.rawPayload,
      now,
      now,
    );

    const row = db
      .prepare(`SELECT * FROM quote_requests WHERE request_id = ?`)
      .get(params.requestId) as QuoteRow;

    return mapRow(row);
  }

  getByRequestId(requestId: string): QuoteRequestRecord | null {
    const row = getDb()
      .prepare(`SELECT * FROM quote_requests WHERE request_id = ?`)
      .get(requestId) as QuoteRow | undefined;
    return row ? mapRow(row) : null;
  }

  /**
   * Atomic rate limit: increments attempt_count for (keyHash, bucketStart).
   * Returns true when under/at the max (allowed), false when exceeded.
   */
  consumeRateLimit(options: ConsumeRateLimitOptions): boolean {
    const db = getDb();
    const { keyHash, bucketStart, maxAttempts, nowSeconds } = options;

    db.exec("BEGIN IMMEDIATE");
    try {
      const existing = db
        .prepare(
          `SELECT attempt_count FROM quote_rate_limits
           WHERE key_hash = ? AND bucket_start = ?`,
        )
        .get(keyHash, bucketStart) as { attempt_count: number } | undefined;

      if (!existing) {
        db.prepare(
          `INSERT INTO quote_rate_limits (key_hash, bucket_start, attempt_count, updated_at)
           VALUES (?, ?, 1, ?)`,
        ).run(keyHash, bucketStart, nowSeconds);
        db.exec("COMMIT");
        return true;
      }

      if (existing.attempt_count >= maxAttempts) {
        db.exec("COMMIT");
        return false;
      }

      db.prepare(
        `UPDATE quote_rate_limits
         SET attempt_count = attempt_count + 1, updated_at = ?
         WHERE key_hash = ? AND bucket_start = ?`,
      ).run(nowSeconds, keyHash, bucketStart);
      db.exec("COMMIT");
      return true;
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // ignore
      }
      throw error;
    }
  }

  updateWebhookStatus(update: WebhookStatusUpdate): void {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE quote_requests SET
          webhook_status = ?,
          webhook_attempt_count = ?,
          webhook_error = ?,
          webhook_delivered_at = COALESCE(?, webhook_delivered_at),
          webhook_last_attempt_at = COALESCE(?, webhook_last_attempt_at),
          webhook_next_attempt_at = ?,
          updated_at = ?
         WHERE request_id = ?`,
      )
      .run(
        update.status,
        update.attemptCount,
        update.error ?? null,
        update.deliveredAt ?? null,
        update.lastAttemptAt ?? null,
        update.nextAttemptAt ?? null,
        now,
        update.requestId,
      );
  }

  /**
   * Claim due outbox rows with BEGIN IMMEDIATE.
   * Stale `processing` locks older than staleLockMinutes are reclaimable.
   */
  claimDueOutbox(options: ClaimDueOutboxOptions): QuoteRequestRecord[] {
    const db = getDb();
    const limit = Math.min(Math.max(options.limit, 1), 100);
    const staleLockMinutes = options.staleLockMinutes ?? 15;
    const staleBefore = new Date(
      Date.parse(options.nowIso) - staleLockMinutes * 60_000,
    ).toISOString();

    db.exec("BEGIN IMMEDIATE");
    try {
      const rows = db
        .prepare(
          `SELECT * FROM quote_requests
           WHERE
             (
               webhook_status IN ('pending', 'failed')
               AND (webhook_next_attempt_at IS NULL OR webhook_next_attempt_at <= ?)
             )
             OR (
               webhook_status = 'processing'
               AND webhook_last_attempt_at IS NOT NULL
               AND webhook_last_attempt_at <= ?
             )
           ORDER BY (webhook_next_attempt_at IS NULL) DESC,
                    webhook_next_attempt_at ASC,
                    id ASC
           LIMIT ?`,
        )
        .all(options.nowIso, staleBefore, limit) as QuoteRow[];

      const claimed: QuoteRequestRecord[] = [];
      const claimStmt = db.prepare(
        `UPDATE quote_requests SET
           webhook_status = 'processing',
           webhook_last_attempt_at = ?,
           updated_at = ?
         WHERE id = ? AND webhook_status IN ('pending', 'failed', 'processing')`,
      );

      for (const row of rows) {
        const result = claimStmt.run(options.nowIso, options.nowIso, row.id) as {
          changes: number;
        };
        if (result.changes > 0) {
          claimed.push(
            mapRow({
              ...row,
              webhook_status: "processing",
              webhook_last_attempt_at: options.nowIso,
              updated_at: options.nowIso,
            }),
          );
        }
      }

      db.exec("COMMIT");
      return claimed;
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // ignore
      }
      throw error;
    }
  }

  list(options: ListQuotesOptions = {}): QuoteRequestRecord[] {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);
    const leadStatus = options.leadStatus ?? "all";
    const q = (options.q || "").trim();
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (leadStatus !== "all") {
      where.push("lead_status = ?");
      params.push(leadStatus);
    }
    if (options.customerId != null) {
      where.push("customer_id = ?");
      params.push(options.customerId);
    }
    if (q) {
      where.push(
        `(request_id LIKE ? OR company LIKE ? OR email LIKE ? OR name LIKE ? OR phone LIKE ?)`,
      );
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    const sql = `SELECT * FROM quote_requests
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = getDb().prepare(sql).all(...params) as QuoteRow[];
    return rows.map(mapRow);
  }

  count(options: Omit<ListQuotesOptions, "limit" | "offset"> = {}): number {
    const leadStatus = options.leadStatus ?? "all";
    const q = (options.q || "").trim();
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (leadStatus !== "all") {
      where.push("lead_status = ?");
      params.push(leadStatus);
    }
    if (options.customerId != null) {
      where.push("customer_id = ?");
      params.push(options.customerId);
    }
    if (q) {
      where.push(
        `(request_id LIKE ? OR company LIKE ? OR email LIKE ? OR name LIKE ? OR phone LIKE ?)`,
      );
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM quote_requests
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
      )
      .get(...params) as { c: number };
    return row.c;
  }

  updateOps(params: UpdateQuoteOpsParams): QuoteRequestRecord | null {
    const existing = this.getByRequestId(params.requestId);
    if (!existing) return null;

    if (
      params.leadStatus != null &&
      !(LEAD_STATUSES as readonly string[]).includes(params.leadStatus)
    ) {
      throw new Error("invalid_lead_status");
    }

    const nextStatus = params.leadStatus ?? existing.leadStatus;
    const nextNotes =
      params.salesNotes !== undefined ? params.salesNotes : existing.salesNotes;
    const nextCustomerId =
      params.customerId !== undefined ? params.customerId : existing.customerId;
    const rawTimelineNote =
      params.timelineNote !== undefined
        ? params.timelineNote
        : params.salesNotes;
    const timelineNote =
      typeof rawTimelineNote === "string" ? rawTimelineNote.trim() || null : null;
    const statusChanged = nextStatus !== existing.leadStatus;
    const shouldLog = statusChanged || Boolean(timelineNote);

    const now = new Date().toISOString();
    const db = getDb();
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        `UPDATE quote_requests SET
          lead_status = ?,
          sales_notes = ?,
          customer_id = ?,
          updated_at = ?
         WHERE request_id = ?`,
      ).run(nextStatus, nextNotes, nextCustomerId, now, params.requestId);

      if (shouldLog) {
        db.prepare(
          `INSERT INTO quote_sales_timeline (
            request_id, created_at, actor_email, actor_name, actor_role,
            from_status, to_status, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          params.requestId,
          now,
          params.actor?.email ?? null,
          params.actor?.name ?? null,
          params.actor?.role ?? null,
          existing.leadStatus,
          nextStatus,
          timelineNote,
        );
      }

      db.exec("COMMIT");
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // ignore
      }
      throw error;
    }

    return this.getByRequestId(params.requestId);
  }

  listSalesTimeline(
    requestId: string,
    limit = 100,
  ): QuoteSalesTimelineEntry[] {
    const capped = Math.min(Math.max(limit, 1), 200);
    const rows = getDb()
      .prepare(
        `SELECT * FROM quote_sales_timeline
         WHERE request_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(requestId, capped) as QuoteTimelineRow[];
    return rows.map(mapTimelineRow);
  }

  linkCustomer(requestId: string, customerId: number): void {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE quote_requests SET customer_id = ?, updated_at = ?
         WHERE request_id = ?`,
      )
      .run(customerId, now, requestId);
  }
}

let defaultRepo: QuoteRepository | null = null;

/** Factory — returns SQLite impl today; swap here when PostgresQuoteRepository ships. */
export function getQuoteRepository(): QuoteRepository {
  if (!defaultRepo) {
    defaultRepo = new SqliteQuoteRepository();
  }
  return defaultRepo;
}

/** @internal Test helper — reset singleton after DB path changes. */
export function resetQuoteRepository(): void {
  defaultRepo = null;
}

// Named exports keep quote-service and existing tests stable.
export function insertQuoteRequest(
  params: InsertQuoteParams,
): QuoteRequestRecord {
  return getQuoteRepository().insert(params);
}

export function getQuoteByRequestId(
  requestId: string,
): QuoteRequestRecord | null {
  return getQuoteRepository().getByRequestId(requestId);
}

export function consumeRateLimit(options: ConsumeRateLimitOptions): boolean {
  return getQuoteRepository().consumeRateLimit(options);
}

export function updateWebhookStatus(update: WebhookStatusUpdate): void {
  getQuoteRepository().updateWebhookStatus(update);
}

export function claimDueOutbox(
  options: ClaimDueOutboxOptions,
): QuoteRequestRecord[] {
  return getQuoteRepository().claimDueOutbox(options);
}

export function listQuoteRequests(
  options?: ListQuotesOptions,
): QuoteRequestRecord[] {
  return (getQuoteRepository() as SqliteQuoteRepository).list(options);
}

export function countQuoteRequests(
  options?: Omit<ListQuotesOptions, "limit" | "offset">,
): number {
  return (getQuoteRepository() as SqliteQuoteRepository).count(options);
}

export function updateQuoteOps(
  params: UpdateQuoteOpsParams,
): QuoteRequestRecord | null {
  return (getQuoteRepository() as SqliteQuoteRepository).updateOps(params);
}

export function listQuoteSalesTimeline(
  requestId: string,
  limit?: number,
): QuoteSalesTimelineEntry[] {
  return (getQuoteRepository() as SqliteQuoteRepository).listSalesTimeline(
    requestId,
    limit,
  );
}

export function linkQuoteCustomer(
  requestId: string,
  customerId: number,
): void {
  (getQuoteRepository() as SqliteQuoteRepository).linkCustomer(
    requestId,
    customerId,
  );
}
