import {
  STOCK_CLASSES,
  type StockClass,
} from "@/lib/sku-master-types";

const PRODUCT_ID_PATTERN = /^([ABCD])(\d{5})$/;

export function isStockClass(value: string | null | undefined): value is StockClass {
  return (STOCK_CLASSES as readonly string[]).includes(String(value || ""));
}

export function formatProductId(stockClass: StockClass, runningNo: number): string {
  const n = Math.floor(runningNo);
  if (!Number.isInteger(n) || n < 1 || n > 99999) {
    throw new Error("invalid_running_no");
  }
  return `${stockClass}${String(n).padStart(5, "0")}`;
}

export function parseProductId(
  productId: string,
): { stockClass: StockClass; runningNo: number } | null {
  const match = PRODUCT_ID_PATTERN.exec(String(productId || "").trim().toUpperCase());
  if (!match) return null;
  const stockClass = match[1] as StockClass;
  const runningNo = Number(match[2]);
  if (!Number.isInteger(runningNo) || runningNo < 1) return null;
  return { stockClass, runningNo };
}

/** True when the value is our sellable A/B/C/D code, not a factory item code. */
export function isCommercialProductId(value: string | null | undefined): boolean {
  return parseProductId(String(value || "")) != null;
}

export function normalizeOriCode(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function isSellableBundleClass(stockClass: StockClass): boolean {
  return stockClass === "A" || stockClass === "B";
}

export function canMoveToClearance(stockClass: StockClass): boolean {
  return stockClass === "A" || stockClass === "B";
}

/** Deduplicate commercial codes while keeping first-seen order (group boards). */
export function uniqueProductIdsInOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const parsed = parseProductId(raw);
    if (!parsed) continue;
    const productId = formatProductId(parsed.stockClass, parsed.runningNo);
    if (seen.has(productId)) continue;
    seen.add(productId);
    out.push(productId);
  }
  return out;
}
