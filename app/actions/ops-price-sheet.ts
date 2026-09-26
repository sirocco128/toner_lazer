"use server";

import type { FreightMode } from "@/lib/alibaba/types";
import { upsertCustomerFromQuote } from "@/lib/customer-repository";
import { actorMay, requireOpsActor } from "@/lib/ops-auth";
import { listOpsCatalog } from "@/lib/ops-pricing";
import {
  hydratePriceSheetLines,
  resolvePriceSheetProduct,
  sanitizePriceSheetProduct,
  seedPriceSheetProducts,
  type PriceSheetLineDraft,
} from "@/lib/price-sheet-catalog";
import {
  computePriceSheetRows,
  DEFAULT_PRICE_SHEET_PARAMS,
  type PriceSheetParams,
} from "@/lib/price-sheet";
import {
  buildPriceSheetQuoteInput,
  priceSheetQuoteLines,
  type PriceSheetQuoteContact,
  type PriceSheetQuoteLineInput,
} from "@/lib/price-sheet-quote";
import {
  insertQuoteRequest,
  linkQuoteCustomer,
  updateQuoteOps,
} from "@/lib/quote-repository";
import { createRequestId } from "@/lib/quote-service";

function parseParams(raw: Record<string, unknown> | undefined): PriceSheetParams {
  const forceMode =
    raw?.forceMode === "truck" || raw?.forceMode === "sea"
      ? (raw.forceMode as FreightMode)
      : undefined;
  return {
    ...DEFAULT_PRICE_SHEET_PARAMS,
    cnyToThb:
      Number(raw?.cnyToThb) > 0
        ? Number(raw?.cnyToThb)
        : DEFAULT_PRICE_SHEET_PARAMS.cnyToThb,
    profile: raw?.profile === "corporate" ? "corporate" : "standard",
    includeFreight: raw?.includeFreight !== false && raw?.includeFreight !== "false",
    includePackaging:
      raw?.includePackaging === true || raw?.includePackaging === "true",
    packagingMinThb:
      Number(raw?.packagingMinThb) > 0
        ? Number(raw?.packagingMinThb)
        : DEFAULT_PRICE_SHEET_PARAMS.packagingMinThb,
    packagingMaxThb:
      Number(raw?.packagingMaxThb) > 0
        ? Number(raw?.packagingMaxThb)
        : DEFAULT_PRICE_SHEET_PARAMS.packagingMaxThb,
    month: Number(raw?.month) || DEFAULT_PRICE_SHEET_PARAMS.month,
    forceMode,
  };
}

function parseLines(raw: unknown): PriceSheetLineDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const slug = String(row.slug || "").trim();
    if (!slug) return [];
    const qty = Math.max(1, Math.floor(Number(row.qty) || 1));
    const factoryCny = Number(row.factoryCny);
    return [
      {
        slug,
        qty,
        name: String(row.name || "").trim() || undefined,
        factoryCny: Number.isFinite(factoryCny) ? factoryCny : undefined,
      },
    ];
  });
}

function parseComputedRows(raw: unknown): PriceSheetQuoteLineInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = String(row.id || "").trim();
    const name = String(row.name || "").trim();
    const qty = Math.max(0, Math.floor(Number(row.qty) || 0));
    const sellThb = Number(row.sellThb);
    if (!id || !name || qty <= 0 || !Number.isFinite(sellThb) || sellThb <= 0) {
      return [];
    }
    return [
      {
        id,
        name,
        qty,
        sellThb,
        error: row.error ? String(row.error) : undefined,
      },
    ];
  });
}

function parseContact(raw: unknown): PriceSheetQuoteContact {
  if (!raw || typeof raw !== "object") return {};
  const row = raw as Record<string, unknown>;
  return {
    company: String(row.company || "").trim() || undefined,
    name: String(row.name || "").trim() || undefined,
    phone: String(row.phone || "").trim() || undefined,
    email: String(row.email || "").trim() || undefined,
  };
}

export async function searchPriceSheetCatalogAction(query: string) {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false as const, error: "ไม่มีสิทธิ์" };
  const items = await listOpsCatalog(query);
  return { ok: true as const, items };
}

export async function resolvePriceSheetProductAction(slug: string) {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false as const, error: "ไม่มีสิทธิ์" };
  const product = await resolvePriceSheetProduct(slug);
  if (!product) return { ok: false as const, error: "ไม่พบสินค้าในแคตตาล็อก" };
  const canSeeCost = actorMay(actor, "factory.read");
  return {
    ok: true as const,
    product: sanitizePriceSheetProduct(product, canSeeCost),
    canSeeCost,
  };
}

export async function seedPriceSheetProductsAction(limit = 3) {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false as const, error: "ไม่มีสิทธิ์" };
  const canSeeCost = actorMay(actor, "factory.read");
  const products = (await seedPriceSheetProducts(limit)).map((row) =>
    sanitizePriceSheetProduct(row, canSeeCost),
  );
  return { ok: true as const, products, canSeeCost };
}

export async function computePriceSheetAction(raw: {
  lines?: unknown;
  params?: Record<string, unknown>;
}) {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false as const, error: "ไม่มีสิทธิ์คิดราคา" };
  const params = parseParams(raw.params);
  const lines = parseLines(raw.lines);
  if (lines.length === 0) {
    return {
      ok: true as const,
      canSeeCost: actorMay(actor, "factory.read"),
      products: [],
      rows: [],
    };
  }
  return hydratePriceSheetLines(actor, lines, params);
}

/** Client fast-path helper: compute rows when products already carry cost inputs. */
export async function computePriceSheetLocalAction(raw: {
  products?: unknown;
  params?: Record<string, unknown>;
}) {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false as const, error: "ไม่มีสิทธิ์คิดราคา" };
  const canSeeCost = actorMay(actor, "factory.read");
  if (!canSeeCost) {
    return computePriceSheetAction({
      lines: raw.products,
      params: raw.params,
    });
  }
  const params = parseParams(raw.params);
  if (!Array.isArray(raw.products)) {
    return { ok: true as const, canSeeCost, products: [], rows: [] };
  }
  const products = raw.products.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object",
  );
  const lines = parseLines(products);
  if (lines.length > 0) {
    return hydratePriceSheetLines(actor, lines, params);
  }
  return {
    ok: true as const,
    canSeeCost,
    products: [],
    rows: computePriceSheetRows([], params),
  };
}

/** Create a real ops RFQ (quote_requests) from Sheet3 Final. */
export async function createOpsQuoteFromPriceSheetAction(raw: {
  rows?: unknown;
  params?: Record<string, unknown>;
  slugsById?: Record<string, string | undefined>;
  contact?: unknown;
}) {
  const actor = await requireOpsActor("quotes.write");
  if (!actor) {
    return { ok: false as const, error: "ไม่มีสิทธิ์สร้างใบเสนอราคา" };
  }
  const params = parseParams(raw.params);
  const rows = parseComputedRows(raw.rows);
  const slugsById =
    raw.slugsById && typeof raw.slugsById === "object" ? raw.slugsById : {};
  const lines = priceSheetQuoteLines(rows, slugsById);
  if (lines.length === 0) {
    return { ok: false as const, error: "ไม่มีแถว Final ที่สร้างใบเสนอราคาได้" };
  }
  const grandTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  let input;
  try {
    input = buildPriceSheetQuoteInput({
      actor,
      lines,
      params,
      grandTotal,
      contact: parseContact(raw.contact),
    });
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "สร้างใบเสนอราคาไม่ได้",
    };
  }

  const submittedAt = new Date().toISOString();
  const requestId = createRequestId(new Date(submittedAt));
  insertQuoteRequest({
    requestId,
    submittedAt,
    input,
    ipHash: "ops-price-sheet",
    userAgent: "ops-price-sheet",
    webhookStatus: "skipped",
    webhookNextAttemptAt: null,
    rawPayload: JSON.stringify({
      source: "ops-price-sheet",
      actor: actor.email,
      input,
      lines,
    }),
    consentAt: submittedAt,
  });

  updateQuoteOps({
    requestId,
    leadStatus: "quoted",
    salesNotes: `ร่างจากชีตราคา 3 แท็บ โดย ${actor.email}`,
    timelineNote: `สร้างจาก Sheet3 · ${lines.length} รายการ · รวม ~${grandTotal.toLocaleString("th-TH")} บาท`,
    actor: {
      email: actor.email,
      name: actor.name,
      role: actor.role,
    },
  });

  try {
    const customer = upsertCustomerFromQuote({
      company: input.company,
      email: input.email,
      phone: input.phone,
      contactName: input.name,
      quoteSubmittedAt: submittedAt,
    });
    linkQuoteCustomer(requestId, customer.id);
  } catch {
    // CRM upsert must not block ops quote creation
  }

  return {
    ok: true as const,
    requestId,
    href: `/ops/quotes/${encodeURIComponent(requestId)}`,
    lineCount: lines.length,
  };
}
