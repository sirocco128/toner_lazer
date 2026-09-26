import { getDb } from "@/lib/database";
import type { OrderRecord } from "@/lib/order-types";
import { getOrderRepository } from "@/lib/order-repository";
import type { QuoteRequestRecord } from "@/lib/quote-types";
import { getQuoteByRequestId } from "@/lib/quote-repository";

export type PartnerCursor = {
  updatedAt: string;
  id: number;
};

export function encodePartnerCursor(cursor: PartnerCursor): string {
  return Buffer.from(`${cursor.updatedAt}\t${cursor.id}`, "utf8").toString(
    "base64url",
  );
}

export function decodePartnerCursor(raw: string | null): PartnerCursor | null {
  if (!raw) return null;
  try {
    const text = Buffer.from(raw, "base64url").toString("utf8");
    const tab = text.lastIndexOf("\t");
    if (tab < 1) return null;
    const updatedAt = text.slice(0, tab);
    const id = Number(text.slice(tab + 1));
    if (!updatedAt || !Number.isInteger(id) || id < 1) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

export function parsePartnerLimit(raw: string | null, fallback = 50): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

function pageIds(table: "quote_requests" | "orders", options: {
  updatedSince: string | null;
  cursor: PartnerCursor | null;
  limit: number;
}): Array<{ id: number; updated_at: string; public_id: string }> {
  const fetchLimit = options.limit + 1;
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (options.updatedSince) {
    where.push("updated_at >= ?");
    params.push(options.updatedSince);
  }
  if (options.cursor) {
    where.push("(updated_at > ? OR (updated_at = ? AND id > ?))");
    params.push(options.cursor.updatedAt, options.cursor.updatedAt, options.cursor.id);
  }
  const idColumn = table === "quote_requests" ? "request_id" : "order_id";
  const sql = `SELECT id, updated_at, ${idColumn} AS public_id FROM ${table}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY updated_at ASC, id ASC
    LIMIT ?`;
  params.push(fetchLimit);
  return getDb().prepare(sql).all(...params) as Array<{
    id: number;
    updated_at: string;
    public_id: string;
  }>;
}

export function listPartnerQuotePage(options: {
  updatedSince: string | null;
  cursor: PartnerCursor | null;
  limit: number;
}): { rows: QuoteRequestRecord[]; nextCursor: string | null } {
  const ids = pageIds("quote_requests", options);
  const hasMore = ids.length > options.limit;
  const page = hasMore ? ids.slice(0, options.limit) : ids;
  const rows = page
    .map((row) => getQuoteByRequestId(row.public_id))
    .filter((row): row is QuoteRequestRecord => Boolean(row));
  const last = page[page.length - 1];
  return {
    rows,
    nextCursor:
      hasMore && last
        ? encodePartnerCursor({ updatedAt: last.updated_at, id: last.id })
        : null,
  };
}

export function listPartnerOrderPage(options: {
  updatedSince: string | null;
  cursor: PartnerCursor | null;
  limit: number;
}): { rows: OrderRecord[]; nextCursor: string | null } {
  const ids = pageIds("orders", options);
  const hasMore = ids.length > options.limit;
  const page = hasMore ? ids.slice(0, options.limit) : ids;
  const repo = getOrderRepository();
  const rows = page
    .map((row) => repo.getOrderByOrderId(row.public_id))
    .filter((row): row is OrderRecord => Boolean(row));
  const last = page[page.length - 1];
  return {
    rows,
    nextCursor:
      hasMore && last
        ? encodePartnerCursor({ updatedAt: last.updated_at, id: last.id })
        : null,
  };
}
