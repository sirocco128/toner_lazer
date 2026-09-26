/**
 * LINE Official Account helpers for ops CRM (not the public OA link).
 * Enable with LINE_OA_ENABLED=true and channel secret + access token.
 * Local lab: LINE_OA_TEST_MODE=true (uses a dummy secret, no real LINE Channel).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/database";
import {
  getCustomerById,
  listCustomerContacts,
} from "@/lib/customer-repository";

export const LINE_LAB_FALLBACK_SECRET = "line-lab-local-secret";

export function isLineOaTestMode(): boolean {
  const flag = (process.env.LINE_OA_TEST_MODE || "").trim().toLowerCase();
  return flag === "true" || flag === "1";
}

export function lineChannelSecret(): string {
  const secret = (process.env.LINE_CHANNEL_SECRET || "").trim();
  if (secret) return secret;
  if (isLineOaTestMode()) return LINE_LAB_FALLBACK_SECRET;
  return "";
}

export function isLineOaEnabled(): boolean {
  if (isLineOaTestMode() && lineChannelSecret()) return true;
  const flag = (process.env.LINE_OA_ENABLED || "").trim().toLowerCase();
  if (flag !== "true" && flag !== "1") return false;
  return Boolean(
    lineChannelSecret() && (process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim(),
  );
}

export function signLineBody(rawBody: string, secret = lineChannelSecret()): string {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = lineChannelSecret();
  if (!secret || !signature) return false;
  const digest = signLineBody(rawBody, secret);
  const left = Buffer.from(digest);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type LineWebhookProcessResult = {
  httpStatus: number;
  body: {
    ok: boolean;
    skipped?: boolean;
    processed?: number;
    bound?: number;
    error?: string;
  };
};

export function processLineWebhook(
  rawBody: string,
  signature: string | null,
): LineWebhookProcessResult {
  if (!isLineOaEnabled()) {
    return { httpStatus: 200, body: { ok: true, skipped: true } };
  }
  if (!verifyLineSignature(rawBody, signature)) {
    return { httpStatus: 401, body: { ok: false, error: "invalid signature" } };
  }
  const result = handleLineWebhookBody(rawBody);
  return { httpStatus: 200, body: { ok: true, ...result } };
}

export function buildLineTextWebhookPayload(params: {
  text: string;
  lineUserId: string;
  displayName?: string;
}): { destination: string; events: Array<Record<string, unknown>> } {
  return {
    destination: "lab-destination",
    events: [
      {
        type: "message",
        timestamp: Date.now(),
        source: {
          type: "user",
          userId: params.lineUserId,
          displayName: params.displayName || undefined,
        },
        message: { type: "text", id: `lab-${Date.now()}`, text: params.text },
      },
    ],
  };
}

export function createLineLinkToken(contactId: number, ttlHours = 48): string {
  const token = `TB-${randomBytes(6).toString("hex").toUpperCase()}`;
  const now = new Date();
  const expires = new Date(now.getTime() + ttlHours * 3600 * 1000).toISOString();
  getDb()
    .prepare(
      `INSERT INTO line_link_tokens (token, contact_id, expires_at, used_at, created_at)
       VALUES (?, ?, ?, NULL, ?)`,
    )
    .run(token, contactId, expires, now.toISOString());
  return token;
}

export function bindLineUserToContact(params: {
  token: string;
  lineUserId: string;
  displayName?: string | null;
}): { ok: boolean; customerId?: number; error?: string } {
  const token = params.token.trim().toUpperCase();
  const row = getDb()
    .prepare(
      `SELECT token, contact_id, expires_at, used_at FROM line_link_tokens WHERE token = ?`,
    )
    .get(token) as
    | { token: string; contact_id: number; expires_at: string; used_at: string | null }
    | undefined;
  if (!row) return { ok: false, error: "token_not_found" };
  if (row.used_at) return { ok: false, error: "token_used" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "token_expired" };
  }

  const now = new Date().toISOString();
  try {
    getDb()
      .prepare(
        `UPDATE customer_contacts SET
          line_user_id = ?, line_display_name = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(params.lineUserId, params.displayName || null, now, row.contact_id);
  } catch {
    return { ok: false, error: "line_user_taken" };
  }
  getDb()
    .prepare(`UPDATE line_link_tokens SET used_at = ? WHERE token = ?`)
    .run(now, token);

  const contact = getDb()
    .prepare(`SELECT customer_id FROM customer_contacts WHERE id = ?`)
    .get(row.contact_id) as { customer_id: number } | undefined;
  return { ok: true, customerId: contact?.customer_id };
}

type LineEvent = {
  type?: string;
  source?: { userId?: string; type?: string; displayName?: string };
  message?: { type?: string; text?: string };
};

export function handleLineWebhookBody(rawBody: string): {
  processed: number;
  bound: number;
} {
  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(rawBody) as { events?: LineEvent[] };
  } catch {
    return { processed: 0, bound: 0 };
  }
  const events = payload.events || [];
  let bound = 0;
  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") continue;
    const text = String(event.message.text || "").trim().toUpperCase();
    const match = /\b(TB-[A-F0-9]{12})\b/.exec(text);
    const userId = event.source?.userId;
    if (!match || !userId) continue;
    const result = bindLineUserToContact({
      token: match[1]!,
      lineUserId: userId,
      displayName: event.source?.displayName || null,
    });
    if (result.ok) bound += 1;
  }
  return { processed: events.length, bound };
}

export function customerLineStatus(customerId: number): {
  linked: number;
  total: number;
} {
  const customer = getCustomerById(customerId);
  if (!customer) return { linked: 0, total: 0 };
  const contacts = listCustomerContacts(customerId);
  return {
    total: contacts.length,
    linked: contacts.filter((c) => Boolean(c.lineUserId)).length,
  };
}

export type LineLabContact = {
  id: number;
  customerId: number;
  company: string;
  name: string | null;
  email: string;
  lineId: string | null;
  lineUserId: string | null;
  lineDisplayName: string | null;
};

export type LineLabToken = {
  token: string;
  contactId: number;
  company: string;
  email: string;
  expiresAt: string;
  usedAt: string | null;
};

export function listLineLabContacts(limit = 50): LineLabContact[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.customer_id, c.name, c.email, c.line_id,
              c.line_user_id, c.line_display_name, cu.company
       FROM customer_contacts c
       JOIN customers cu ON cu.id = c.customer_id
       WHERE cu.merged_into_id IS NULL
       ORDER BY c.updated_at DESC, c.id DESC
       LIMIT ?`,
    )
    .all(Math.min(Math.max(limit, 1), 200)) as Array<{
    id: number;
    customer_id: number;
    name: string | null;
    email: string;
    line_id: string | null;
    line_user_id: string | null;
    line_display_name: string | null;
    company: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    company: row.company,
    name: row.name,
    email: row.email,
    lineId: row.line_id,
    lineUserId: row.line_user_id,
    lineDisplayName: row.line_display_name,
  }));
}

export function listLineLabTokens(limit = 20): LineLabToken[] {
  const rows = getDb()
    .prepare(
      `SELECT t.token, t.contact_id, t.expires_at, t.used_at, c.email, cu.company
       FROM line_link_tokens t
       JOIN customer_contacts c ON c.id = t.contact_id
       JOIN customers cu ON cu.id = c.customer_id
       ORDER BY t.created_at DESC
       LIMIT ?`,
    )
    .all(Math.min(Math.max(limit, 1), 50)) as Array<{
    token: string;
    contact_id: number;
    expires_at: string;
    used_at: string | null;
    email: string;
    company: string;
  }>;
  return rows.map((row) => ({
    token: row.token,
    contactId: row.contact_id,
    company: row.company,
    email: row.email,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  }));
}

export function lineOaLabStatus(): {
  enabled: boolean;
  testMode: boolean;
  webhookPath: string;
} {
  return {
    enabled: isLineOaEnabled(),
    testMode: isLineOaTestMode(),
    webhookPath: "/api/line/webhook",
  };
}
