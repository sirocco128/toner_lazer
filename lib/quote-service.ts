import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { bangkokDateYmd } from "@/lib/bangkok-date";
import { parseQuoteFormData } from "@/lib/quote-schema";
import { upsertCustomerFromQuote } from "@/lib/customer-repository";
import {
  claimDueOutbox,
  consumeRateLimit,
  insertQuoteRequest,
  linkQuoteCustomer,
  updateWebhookStatus,
} from "@/lib/quote-repository";
import type {
  QuoteRequestInput,
  QuoteRequestRecord,
  QuoteWebhookEvent,
  RetryBatchResult,
  WebhookStatus,
} from "@/lib/quote-types";
import { assertMeetsForcedMinQty } from "@/lib/alibaba/forced-min-qty";
import { getForcedMinQtyForCatalogSlug } from "@/lib/sku-master-repository";

const MIN_FORM_MS = 1_200;
const MAX_FORM_MS = 24 * 60 * 60 * 1000;
/** Cap for webhook retry backoff (6 hours). Exported for unit tests. */
export const BACKOFF_CAP_SECONDS = 21_600;

export type QuoteSubmitSuccess = {
  ok: true;
  requestId: string;
  neutral?: boolean;
};

export type QuoteSubmitFailure = {
  ok: false;
  error?: string;
  formError?: string;
  fieldErrors?: Record<string, string[]>;
};

export type QuoteSubmitResult = QuoteSubmitSuccess | QuoteSubmitFailure;

export type SubmitQuoteContext = {
  headers: Headers;
  userAgent?: string | null;
};

function readIntEnv(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function getIpHashSecret(): string {
  const secret = (process.env.IP_HASH_SECRET || "").trim();
  if (secret.length >= 32) return secret;
  return "dev-only-ip-hash-secret-replace-me-32chars";
}

function toFieldErrors(
  errors: Record<string, string>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, message] of Object.entries(errors)) {
    out[key] = [message];
  }
  return out;
}

export function resolveClientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

export function hashIp(ip: string, secret = getIpHashSecret()): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export { bangkokDateYmd };

export function createRequestId(now = new Date()): string {
  const datePart = bangkokDateYmd(now);
  const suffix = randomBytes(6).toString("hex").toUpperCase();
  return `RFQ-${datePart}-${suffix}`;
}

export function computeBackoffSeconds(
  attempt: number,
  baseSeconds: number,
): number {
  const exp = Math.max(0, attempt - 1);
  const seconds = baseSeconds * 2 ** exp;
  return Math.min(seconds, BACKOFF_CAP_SECONDS);
}

function toLeadPayload(input: QuoteRequestInput) {
  return {
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    quantity: input.quantity,
    budgetPerSet: input.budgetPerSet ?? null,
    neededDate: input.neededDate ?? null,
    streetAddress: input.streetAddress ?? null,
    province: input.province ?? null,
    district: input.district ?? null,
    subdistrict: input.subdistrict ?? null,
    zip: input.zip ?? null,
    taxId: input.taxId ?? null,
    billingBranch: input.billingBranch ?? null,
    productInterest: input.productInterest ?? null,
    productSlug: input.productSlug ?? null,
    decorationMethod: input.decorationMethod,
    detail: input.detail ?? null,
    landingPath: input.landingPath ?? null,
    referrer: input.referrer ?? null,
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    utmTerm: input.utmTerm ?? null,
    utmContent: input.utmContent ?? null,
    consent: true as const,
  };
}

function buildWebhookEvent(
  requestId: string,
  submittedAt: string,
  attempt: number,
  input: QuoteRequestInput,
): QuoteWebhookEvent {
  return {
    event: "quote.requested",
    requestId,
    submittedAt,
    attempt,
    lead: toLeadPayload(input),
  };
}

async function deliverWebhook(options: {
  requestId: string;
  body: QuoteWebhookEvent;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = (process.env.QUOTE_WEBHOOK_URL || "").trim();
  if (!url) {
    return { ok: false, error: "webhook_not_configured" };
  }

  const timeoutMs = readIntEnv("QUOTE_WEBHOOK_TIMEOUT_MS", 8000);
  const secret = (process.env.QUOTE_WEBHOOK_SECRET || "").trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Idempotency-Key": options.requestId,
    };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        error: `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      };
    }

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "webhook_delivery_failed";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

function parseStoredInput(record: QuoteRequestRecord): QuoteRequestInput | null {
  try {
    const parsed = JSON.parse(record.rawPayload) as QuoteRequestInput;
    if (!parsed?.name || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeArgs(
  inputOrFormData: QuoteRequestInput | FormData,
  contextOrHeaders: SubmitQuoteContext | Headers,
): {
  inputResult:
    | { success: true; data: QuoteRequestInput }
    | { success: false; fieldErrors: Record<string, string> };
  headers: Headers;
  userAgent: string | null;
} {
  const headers =
    contextOrHeaders instanceof Headers
      ? contextOrHeaders
      : contextOrHeaders.headers;

  const userAgent =
    contextOrHeaders instanceof Headers
      ? contextOrHeaders.get("user-agent")
      : (contextOrHeaders.userAgent ?? headers.get("user-agent"));

  if (typeof FormData !== "undefined" && inputOrFormData instanceof FormData) {
    return {
      inputResult: parseQuoteFormData(inputOrFormData),
      headers,
      userAgent,
    };
  }

  return {
    inputResult: {
      success: true,
      data: inputOrFormData as QuoteRequestInput,
    },
    headers,
    userAgent,
  };
}

/**
 * Full RFQ workflow: honeypot, form timing, IP hash, rate limit,
 * persist-first, webhook delivery.
 *
 * Accepts either:
 * - (QuoteRequestInput, { headers, userAgent }) — tests / internal
 * - (FormData, Headers) — Server Action
 */
export async function submitQuotePayload(
  inputOrFormData: QuoteRequestInput | FormData,
  contextOrHeaders: SubmitQuoteContext | Headers,
): Promise<QuoteSubmitResult> {
  const { inputResult, headers, userAgent } = normalizeArgs(
    inputOrFormData,
    contextOrHeaders,
  );

  if (!inputResult.success) {
    return {
      ok: false,
      formError: "กรุณาตรวจสอบข้อมูลในแบบฟอร์ม",
      fieldErrors: toFieldErrors(inputResult.fieldErrors),
    };
  }

  const input = inputResult.data;

  if (input.website && input.website.trim().length > 0) {
    return { ok: true, requestId: createRequestId(), neutral: true };
  }

  const startedAt = input.startedAt;
  if (!startedAt || !Number.isFinite(startedAt)) {
    return {
      ok: false,
      formError: "กรุณาเปิดฟอร์มใหม่แล้วส่งอีกครั้ง",
      fieldErrors: toFieldErrors({ startedAt: "Missing form start time" }),
    };
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_FORM_MS || elapsed > MAX_FORM_MS) {
    return {
      ok: false,
      formError: "ไม่สามารถส่งคำขอได้ในขณะนี้ กรุณาลองใหม่",
      fieldErrors: toFieldErrors({ form: "Invalid form timing" }),
    };
  }

  const forcedMinQty = await getForcedMinQtyForCatalogSlug(input.productSlug);
  if (forcedMinQty) {
    try {
      assertMeetsForcedMinQty(input.quantity, forcedMinQty);
    } catch {
      return {
        ok: false,
        formError: `สั่งขั้นต่ำ ${forcedMinQty} ชุด ตามสูตรต้นทุนลงเรือ`,
        fieldErrors: toFieldErrors({
          quantity: `Minimum order is ${forcedMinQty}`,
        }),
      };
    }
  }

  const ip = resolveClientIp(headers);
  const ipHash = hashIp(ip);
  const windowMinutes = readIntEnv("QUOTE_RATE_LIMIT_WINDOW_MINUTES", 15);
  const maxAttempts = readIntEnv("QUOTE_RATE_LIMIT_MAX", 5);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bucketStart = nowSeconds - (nowSeconds % (windowMinutes * 60));

  const allowed = consumeRateLimit({
    keyHash: ipHash,
    bucketStart,
    maxAttempts,
    nowSeconds,
  });

  if (!allowed) {
    return {
      ok: false,
      formError: "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
      fieldErrors: toFieldErrors({ form: "Rate limit exceeded" }),
    };
  }

  const submittedAt = new Date().toISOString();
  const requestId = createRequestId(new Date(submittedAt));
  const webhookUrl = (process.env.QUOTE_WEBHOOK_URL || "").trim();
  const baseRetry = readIntEnv("QUOTE_WEBHOOK_RETRY_BASE_SECONDS", 60);
  const maxWebhookAttempts = readIntEnv("QUOTE_WEBHOOK_MAX_ATTEMPTS", 6);

  const initialStatus: WebhookStatus = webhookUrl ? "pending" : "skipped";
  const nextAttemptAt = webhookUrl
    ? new Date(Date.now() + baseRetry * 1000).toISOString()
    : null;

  insertQuoteRequest({
    requestId,
    submittedAt,
    input,
    ipHash,
    userAgent,
    webhookStatus: initialStatus,
    webhookNextAttemptAt: nextAttemptAt,
    rawPayload: JSON.stringify(input),
    consentAt: submittedAt,
  });

  try {
    const customer = upsertCustomerFromQuote({
      company: input.company,
      email: input.email,
      phone: input.phone,
      contactName: input.name,
      quoteSubmittedAt: submittedAt,
      province: input.province,
      taxId: input.taxId,
      billingBranch: input.billingBranch,
    });
    linkQuoteCustomer(requestId, customer.id);
  } catch {
    // CRM upsert must not block RFQ acceptance
  }

  if (!webhookUrl) {
    return { ok: true, requestId };
  }

  const attempt = 1;
  const event = buildWebhookEvent(requestId, submittedAt, attempt, input);
  const delivery = await deliverWebhook({ requestId, body: event });
  const lastAttemptAt = new Date().toISOString();

  if (delivery.ok) {
    updateWebhookStatus({
      requestId,
      status: "sent",
      attemptCount: attempt,
      error: null,
      deliveredAt: lastAttemptAt,
      lastAttemptAt,
      nextAttemptAt: null,
    });
  } else {
    const dead = attempt >= maxWebhookAttempts;
    const retryIn = computeBackoffSeconds(attempt + 1, baseRetry);
    updateWebhookStatus({
      requestId,
      status: dead ? "dead" : "failed",
      attemptCount: attempt,
      error: delivery.error,
      lastAttemptAt,
      nextAttemptAt: dead
        ? null
        : new Date(Date.now() + retryIn * 1000).toISOString(),
    });
  }

  return { ok: true, requestId };
}

export async function processRetryBatch(
  limit = readIntEnv("QUOTE_RETRY_BATCH_SIZE", 25),
): Promise<RetryBatchResult> {
  const nowIso = new Date().toISOString();
  const claimed = claimDueOutbox({ limit, nowIso });
  const maxWebhookAttempts = readIntEnv("QUOTE_WEBHOOK_MAX_ATTEMPTS", 6);
  const baseRetry = readIntEnv("QUOTE_WEBHOOK_RETRY_BASE_SECONDS", 60);
  const webhookUrl = (process.env.QUOTE_WEBHOOK_URL || "").trim();

  let sent = 0;
  let failed = 0;
  let dead = 0;
  const results: RetryBatchResult["results"] = [];

  for (const record of claimed) {
    if (!webhookUrl) {
      updateWebhookStatus({
        requestId: record.requestId,
        status: "skipped",
        attemptCount: record.webhookAttemptCount,
        nextAttemptAt: null,
        lastAttemptAt: nowIso,
      });
      results.push({ requestId: record.requestId, status: "skipped" });
      continue;
    }

    const input = parseStoredInput(record);
    if (!input) {
      updateWebhookStatus({
        requestId: record.requestId,
        status: "dead",
        attemptCount: record.webhookAttemptCount,
        error: "invalid_raw_payload",
        lastAttemptAt: nowIso,
        nextAttemptAt: null,
      });
      dead += 1;
      results.push({
        requestId: record.requestId,
        status: "dead",
        error: "invalid_raw_payload",
      });
      continue;
    }

    const attempt = record.webhookAttemptCount + 1;
    const event = buildWebhookEvent(
      record.requestId,
      record.submittedAt,
      attempt,
      input,
    );
    const delivery = await deliverWebhook({
      requestId: record.requestId,
      body: event,
    });
    const lastAttemptAt = new Date().toISOString();

    if (delivery.ok) {
      updateWebhookStatus({
        requestId: record.requestId,
        status: "sent",
        attemptCount: attempt,
        error: null,
        deliveredAt: lastAttemptAt,
        lastAttemptAt,
        nextAttemptAt: null,
      });
      sent += 1;
      results.push({ requestId: record.requestId, status: "sent" });
    } else if (attempt >= maxWebhookAttempts) {
      updateWebhookStatus({
        requestId: record.requestId,
        status: "dead",
        attemptCount: attempt,
        error: delivery.error,
        lastAttemptAt,
        nextAttemptAt: null,
      });
      dead += 1;
      results.push({
        requestId: record.requestId,
        status: "dead",
        error: delivery.error,
      });
    } else {
      const retryIn = computeBackoffSeconds(attempt + 1, baseRetry);
      updateWebhookStatus({
        requestId: record.requestId,
        status: "failed",
        attemptCount: attempt,
        error: delivery.error,
        lastAttemptAt,
        nextAttemptAt: new Date(Date.now() + retryIn * 1000).toISOString(),
      });
      failed += 1;
      results.push({
        requestId: record.requestId,
        status: "failed",
        error: delivery.error,
      });
    }
  }

  return {
    ok: true,
    processed: claimed.length,
    sent,
    failed,
    dead,
    results,
    processedAt: new Date().toISOString(),
  };
}

export function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
