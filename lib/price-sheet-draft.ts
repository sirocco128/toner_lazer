/**
 * Persist ops price-sheet draft in localStorage (params + product lines).
 */

import type {
  PriceSheetParams,
  PriceSheetProductInput,
} from "@/lib/price-sheet";

export const PRICE_SHEET_DRAFT_KEY = "smartgift:ops-price-sheet-draft:v1";

export type PriceSheetDraft = {
  savedAt: string;
  params: PriceSheetParams;
  products: PriceSheetProductInput[];
};

export function loadPriceSheetDraft(): PriceSheetDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PRICE_SHEET_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PriceSheetDraft;
    if (!parsed || !Array.isArray(parsed.products) || !parsed.params) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePriceSheetDraft(
  params: PriceSheetParams,
  products: PriceSheetProductInput[],
): void {
  if (typeof window === "undefined") return;
  try {
    const draft: PriceSheetDraft = {
      savedAt: new Date().toISOString(),
      params,
      products,
    };
    localStorage.setItem(PRICE_SHEET_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* private mode / quota */
  }
}

export function clearPriceSheetDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PRICE_SHEET_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
