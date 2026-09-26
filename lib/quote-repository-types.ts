/**
 * Quote persistence contract (runbook §33.5 / P1-DATA-002).
 *
 * SQLite implements this today. A future PostgresQuoteRepository (or MySQL)
 * should implement the same interface for multi-instance / HA — not shipped yet.
 */

import type {
  QuoteRequestInput,
  QuoteRequestRecord,
  WebhookStatus,
} from "@/lib/quote-types";

export type InsertQuoteParams = {
  requestId: string;
  submittedAt: string;
  input: QuoteRequestInput;
  ipHash: string;
  userAgent: string | null;
  webhookStatus: WebhookStatus;
  webhookNextAttemptAt: string | null;
  rawPayload: string;
  consentAt: string;
};

export type WebhookStatusUpdate = {
  requestId: string;
  status: WebhookStatus;
  attemptCount: number;
  error?: string | null;
  deliveredAt?: string | null;
  lastAttemptAt?: string | null;
  nextAttemptAt?: string | null;
};

export type ConsumeRateLimitOptions = {
  keyHash: string;
  bucketStart: number;
  maxAttempts: number;
  nowSeconds: number;
};

export type ClaimDueOutboxOptions = {
  limit: number;
  nowIso: string;
  staleLockMinutes?: number;
};

/**
 * Persistence + outbox API used by quote-service.
 * Method names match the repository design; SQLite adapters may also export
 * thin wrappers (`insertQuoteRequest`) for callers/tests.
 */
export interface QuoteRepository {
  insert(params: InsertQuoteParams): QuoteRequestRecord;
  getByRequestId(requestId: string): QuoteRequestRecord | null;
  consumeRateLimit(options: ConsumeRateLimitOptions): boolean;
  claimDueOutbox(options: ClaimDueOutboxOptions): QuoteRequestRecord[];
  updateWebhookStatus(update: WebhookStatusUpdate): void;
}
