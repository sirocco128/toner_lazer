/**
 * Client-safe Quote Basket helpers (P2 stub).
 * Persist draft baskets to localStorage only.
 * Approximate totals use product priceMin/Max — estimates, not quotes.
 */

import type {
  AddQuoteBasketItemInput,
  ApproximatePriceSum,
  QuoteBasket,
  QuoteBasketItem,
} from "@/lib/quote-basket-types";
import { PRODUCT_INTEREST_MAX } from "@/lib/quote-types";

export const QUOTE_BASKET_STORAGE_KEY = "giftpro:quote-basket:v1";
export const QUOTE_BASKET_EVENT = "smartgift:quote-basket-changed";
export const PRICING_SNAPSHOT_VERSION = "moq-lock-v1";

/** Clear disclaimer shown near any approximate price UI. */
export const PRICE_ESTIMATE_DISCLAIMER =
  "ราคาที่แสดงเป็นค่าประมาณจากช่วงราคาสินค้า รวมค่าขนส่งจากจีนโดยประมาณ ไม่ใช่ใบเสนอราคาจริง และยังไม่รวมค่าตกแต่ง บรรจุภัณฑ์ในไทย หรือค่าจัดส่งในประเทศ เมื่อกดส่งคำขอ ระบบจะพาไปแบบฟอร์มขอใบเสนอราคาพร้อมสรุปรายการในตะกร้า";

const BASKET_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function generateBasketId(): string {
  return randomId("qb");
}

export function emitBasketChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(QUOTE_BASKET_EVENT));
}

/** Catalog min-order or SKU forced min — never below 1. */
export function resolveLockedMinQty(minOrder?: number): number {
  const n = Math.floor(Number(minOrder));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * Add qty is the SKU/catalog min-order unless a larger amount is passed.
 * Price snapshot is taken from the unit estimates the buyer saw on the card.
 */
export function resolveAddQuantity(input: {
  quantity?: number;
  minOrder?: number;
}): number {
  const minQty = resolveLockedMinQty(input.minOrder);
  if (input.quantity == null) return minQty;
  const qty = Math.floor(Number(input.quantity));
  if (!Number.isInteger(qty) || qty < 1) return minQty;
  return Math.max(minQty, qty);
}

function finiteMoney(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Lock the unit estimate the buyer saw. When min/max differ, the high end is
 * the price at minimum order; keep both as the frozen band for that qty.
 */
export function lockUnitEstimate(input: {
  estimatedUnitMin?: number;
  estimatedUnitMax?: number;
}): { estimatedUnitMin?: number; estimatedUnitMax?: number } {
  const min = finiteMoney(input.estimatedUnitMin);
  const max = finiteMoney(input.estimatedUnitMax);
  if (min == null && max == null) return {};
  if (min == null) return { estimatedUnitMin: max, estimatedUnitMax: max };
  if (max == null) return { estimatedUnitMin: min, estimatedUnitMax: min };
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return { estimatedUnitMin: lo, estimatedUnitMax: hi };
}

function generateItemId(): string {
  return randomId("qbi");
}

function generateSessionId(): string {
  return randomId("sess");
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createEmptyBasket(): QuoteBasket {
  const createdAt = nowIso();
  const id = generateBasketId();
  return {
    id,
    publicTokenHash: randomId("tok"),
    status: "draft",
    currency: "THB",
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(Date.now() + BASKET_TTL_MS).toISOString(),
    sourceSession: generateSessionId(),
    items: [],
  };
}

export function addItem(
  basket: QuoteBasket,
  input: AddQuoteBasketItemInput,
): QuoteBasket {
  const minQty = resolveLockedMinQty(input.minOrder ?? input.quantity);
  const quantity = resolveAddQuantity({
    quantity: input.quantity,
    minOrder: minQty,
  });
  const lockedPrice = lockUnitEstimate(input);
  const existing = basket.items.find(
    (item) =>
      item.productSlug === input.productSlug &&
      (item.variantId ?? "") === (input.variantId ?? ""),
  );

  let items: QuoteBasketItem[];
  if (existing) {
    const lockedMinQty = Math.max(existing.lockedMinQty || 1, minQty);
    items = basket.items.map((item) =>
      item.id === existing.id
        ? {
            ...item,
            quantity: item.quantity + quantity,
            lockedMinQty,
            skuCode: input.skuCode || item.skuCode,
            decorationMethod: input.decorationMethod ?? item.decorationMethod,
            packagingOption: input.packagingOption ?? item.packagingOption,
            note: input.note ?? item.note,
            productName: input.productName || item.productName,
          }
        : item,
    );
  } else {
    const item: QuoteBasketItem = {
      id: generateItemId(),
      basketId: basket.id,
      productSlug: input.productSlug,
      productName: input.productName,
      skuCode: input.skuCode,
      variantId: input.variantId,
      quantity,
      lockedMinQty: minQty,
      decorationMethod: input.decorationMethod,
      packagingOption: input.packagingOption,
      note: input.note,
      estimatedUnitMin: lockedPrice.estimatedUnitMin,
      estimatedUnitMax: lockedPrice.estimatedUnitMax,
      pricingSnapshotVersion: PRICING_SNAPSHOT_VERSION,
    };
    items = [...basket.items, item];
  }

  return {
    ...basket,
    items,
    updatedAt: nowIso(),
    status: "draft",
  };
}

export function removeItem(basket: QuoteBasket, itemId: string): QuoteBasket {
  return {
    ...basket,
    items: basket.items.filter((item) => item.id !== itemId),
    updatedAt: nowIso(),
  };
}

export function updateQuantity(
  basket: QuoteBasket,
  itemId: string,
  quantity: number,
): QuoteBasket {
  return {
    ...basket,
    items: basket.items.map((item) => {
      if (item.id !== itemId) return item;
      const floor = resolveLockedMinQty(item.lockedMinQty);
      const nextQty = Math.max(floor, Math.floor(quantity));
      return { ...item, quantity: Number.isInteger(nextQty) ? nextQty : floor };
    }),
    updatedAt: nowIso(),
  };
}

export function updateItemFields(
  basket: QuoteBasket,
  itemId: string,
  patch: Partial<
    Pick<QuoteBasketItem, "note" | "decorationMethod" | "packagingOption" | "logoColorCount">
  >,
): QuoteBasket {
  return {
    ...basket,
    items: basket.items.map((item) =>
      item.id === itemId ? { ...item, ...patch } : item,
    ),
    updatedAt: nowIso(),
  };
}

/**
 * Sum approximate line totals from estimatedUnitMin/Max × quantity.
 * Missing estimates are skipped; hasEstimates is false if none present.
 */
export function approximatePriceSum(basket: QuoteBasket): ApproximatePriceSum {
  let min = 0;
  let max = 0;
  let hasEstimates = false;

  for (const item of basket.items) {
    if (
      typeof item.estimatedUnitMin === "number" &&
      typeof item.estimatedUnitMax === "number" &&
      Number.isFinite(item.estimatedUnitMin) &&
      Number.isFinite(item.estimatedUnitMax)
    ) {
      hasEstimates = true;
      min += item.estimatedUnitMin * item.quantity;
      max += item.estimatedUnitMax * item.quantity;
    }
  }

  return { min, max, hasEstimates };
}

export function formatBahtRange(min: number, max: number): string {
  const fmt = new Intl.NumberFormat("th-TH");
  if (min === max) return `${fmt.format(min)} บาท`;
  return `${fmt.format(min)}–${fmt.format(max)} บาท`;
}

export type QuoteInterestLine = {
  productName: string;
  quantity: number;
  skuCode?: string;
};

export function basketInterestLines(basket: QuoteBasket): QuoteInterestLine[] {
  return basket.items.map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
    skuCode: item.skuCode,
  }));
}

export function totalBasketQuantity(items: QuoteBasketItem[]): number {
  return items.reduce((sum, item) => {
    const qty = Math.floor(Number(item.quantity));
    return sum + (Number.isInteger(qty) && qty > 0 ? qty : 0);
  }, 0);
}

/** Join every basket line into the RFQ product-interest field. */
export function formatBasketProductInterest(
  items: QuoteBasketItem[],
  maxChars = PRODUCT_INTEREST_MAX,
): string {
  if (items.length === 0) return "";
  const parts = items.map((item) => {
    const sku = item.skuCode ? ` ${item.skuCode}` : "";
    return `${item.productName}${sku} × ${item.quantity}`;
  });
  const full = parts.join(" · ");
  if (full.length <= maxChars) return full;

  let acc = "";
  let used = 0;
  for (const part of parts) {
    const remainAfterThis = items.length - used - 1;
    const candidate = used === 0 ? part : `${acc} · ${part}`;
    const suffix =
      remainAfterThis > 0 ? ` และอีก ${remainAfterThis} รายการ` : "";
    if (candidate.length + suffix.length > maxChars) {
      if (used === 0) {
        const ellipsis = "…";
        return `${part.slice(0, Math.max(1, maxChars - ellipsis.length))}${ellipsis}`;
      }
      return `${acc} และอีก ${items.length - used} รายการ`;
    }
    acc = candidate;
    used += 1;
  }
  return acc;
}

function isQuoteBasket(value: unknown): value is QuoteBasket {
  if (!value || typeof value !== "object") return false;
  const candidate = value as QuoteBasket;
  return (
    typeof candidate.id === "string" &&
    Array.isArray(candidate.items) &&
    candidate.currency === "THB"
  );
}

function normalizeBasket(basket: QuoteBasket): QuoteBasket {
  return {
    ...basket,
    items: basket.items.map((item) => {
      const lockedMinQty = item.lockedMinQty
        ? resolveLockedMinQty(item.lockedMinQty)
        : 1;
      const qty = Math.floor(Number(item.quantity));
      return {
        ...item,
        lockedMinQty,
        quantity: Number.isInteger(qty) && qty > 0 ? Math.max(lockedMinQty, qty) : lockedMinQty,
      };
    }),
  };
}

export function loadBasketFromStorage(): QuoteBasket {
  if (typeof window === "undefined") {
    return createEmptyBasket();
  }
  try {
    const raw = window.localStorage.getItem(QUOTE_BASKET_STORAGE_KEY);
    if (!raw) return createEmptyBasket();
    const parsed: unknown = JSON.parse(raw);
    if (!isQuoteBasket(parsed)) return createEmptyBasket();
    if (parsed.expiresAt && Date.parse(parsed.expiresAt) < Date.now()) {
      window.localStorage.removeItem(QUOTE_BASKET_STORAGE_KEY);
      return createEmptyBasket();
    }
    return normalizeBasket(parsed);
  } catch {
    return createEmptyBasket();
  }
}

export function saveBasketToStorage(basket: QuoteBasket): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUOTE_BASKET_STORAGE_KEY, JSON.stringify(basket));
  } catch {
    // Quota / private mode — ignore; UI still works in-memory for the session.
  }
  emitBasketChanged();
}

export function clearBasketStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(QUOTE_BASKET_STORAGE_KEY);
  } catch {
    // ignore
  }
  emitBasketChanged();
}

/** Build /contact href with a human-readable basket summary for RFQ notes. */
export function buildContactHrefFromBasket(basket: QuoteBasket): string {
  const lines = [
    `[ตะกร้าใบเสนอราคา] รหัส: ${basket.id}`,
    ...basket.items.map((item, index) => {
      const sku = item.skuCode ? ` รหัส ${item.skuCode}` : "";
      const unit =
        typeof item.estimatedUnitMin === "number" &&
        typeof item.estimatedUnitMax === "number"
          ? ` | ราคาล็อก: ${formatBahtRange(item.estimatedUnitMin, item.estimatedUnitMax)}/ชุด`
          : "";
      const floor =
        item.lockedMinQty > 1 ? ` | ขั้นต่ำล็อก ${item.lockedMinQty}` : "";
      return (
        `${index + 1}. ${item.productName}${sku} (/${item.productSlug}) × ${item.quantity}` +
        unit +
        floor +
        (item.decorationMethod ? ` | ตกแต่ง: ${item.decorationMethod}` : "") +
        (item.logoColorCount ? ` | สีโลโก้: ${item.logoColorCount}` : "") +
        (item.note ? ` | โน้ต: ${item.note}` : "")
      );
    }),
  ];
  const note = lines.join("\n");
  const first = basket.items[0];
  const params = new URLSearchParams({
    source: "quote-basket",
    basketId: basket.id,
    note,
  });
  if (first) {
    params.set("productInterest", formatBasketProductInterest(basket.items));
    params.set("quantity", String(totalBasketQuantity(basket.items)));
    if (basket.items.length === 1) {
      params.set("productSlug", first.productSlug);
      if (first.decorationMethod) {
        params.set("decorationMethod", first.decorationMethod);
      }
    }
  }
  if (basket.neededDate) {
    params.set("neededDate", basket.neededDate);
  }
  return `/contact?${params.toString()}`;
}
