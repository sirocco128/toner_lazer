/**
 * P2 Quote Basket target shapes (runbook §34).
 * Stub persists draft baskets in localStorage only — no server/ERP yet.
 */

export type QuoteBasketStatus = "draft" | "submitted" | "expired";

export type QuoteBasket = {
  id: string;
  /** Stub: opaque client token; production will store hash server-side. */
  publicTokenHash: string;
  status: QuoteBasketStatus;
  currency: "THB";
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  sourceSession: string;
  /** Target delivery date YYYY-MM-DD for the bulk RFQ. */
  neededDate?: string;
  items: QuoteBasketItem[];
};

export type QuoteBasketItem = {
  id: string;
  basketId: string;
  productSlug: string;
  productName: string;
  /** Catalog / SKU code shown on the card, e.g. DF1420. */
  skuCode?: string;
  variantId?: string;
  quantity: number;
  /** Floor qty locked from catalog min-order or SKU forced min. */
  lockedMinQty: number;
  decorationMethod?: string;
  packagingOption?: string;
  note?: string;
  estimatedUnitMin?: number;
  estimatedUnitMax?: number;
  pricingSnapshotVersion?: string;
  logoColorCount?: string;
};

export type AddQuoteBasketItemInput = {
  productSlug: string;
  productName: string;
  skuCode?: string;
  /** Catalog min-order or SKU forced min — used when quantity is omitted. */
  minOrder?: number;
  quantity?: number;
  estimatedUnitMin?: number;
  estimatedUnitMax?: number;
  decorationMethod?: string;
  packagingOption?: string;
  note?: string;
  variantId?: string;
  logoColorCount?: string;
};

export type ApproximatePriceSum = {
  min: number;
  max: number;
  hasEstimates: boolean;
};
