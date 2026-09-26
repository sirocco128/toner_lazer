"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { isP2QuoteToolsEnabled } from "@/lib/feature-flags";
import { trackEvent } from "@/lib/analytics";
import {
  PRICE_ESTIMATE_DISCLAIMER,
  addItem,
  loadBasketFromStorage,
  resolveAddQuantity,
  saveBasketToStorage,
} from "@/lib/quote-basket";
import {
  quoteBasketAddLabel,
  quoteBasketAddedLabel,
  quoteBasketLockNote,
} from "@/lib/ux-copy";

type AddToQuoteButtonProps = {
  productSlug: string;
  productName: string;
  /** Catalog min-order or SKU forced min. */
  minOrder?: number;
  skuCode?: string;
  priceMin?: number;
  priceMax?: number;
  /** Override flag for tests; defaults to NEXT_PUBLIC_ENABLE_P2_QUOTE_TOOLS. */
  enabled?: boolean;
};

export function AddToQuoteButton({
  productSlug,
  productName,
  minOrder = 1,
  skuCode,
  priceMin,
  priceMax,
  enabled = isP2QuoteToolsEnabled(),
}: AddToQuoteButtonProps) {
  const [status, setStatus] = useState<"idle" | "added">("idle");
  const [mounted, setMounted] = useState(false);
  const addQty = resolveAddQuantity({ minOrder });

  useEffect(() => {
    setMounted(true);
  }, []);

  const onAdd = useCallback(() => {
    const basket = loadBasketFromStorage();
    const next = addItem(basket, {
      productSlug,
      productName,
      skuCode,
      minOrder: addQty,
      quantity: addQty,
      estimatedUnitMin: priceMin,
      estimatedUnitMax: priceMax,
    });
    saveBasketToStorage(next);
    setStatus("added");
    trackEvent("add_to_cart", {
      item_id: productSlug,
      quantity: addQty,
    });
  }, [productSlug, productName, skuCode, addQty, priceMin, priceMax]);

  if (!enabled) {
    return null;
  }

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest/50"
      >
        {quoteBasketAddLabel(addQty)}
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/25 bg-paper px-6 text-sm font-semibold text-forest transition hover:border-brass hover:bg-forest-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          {status === "added"
            ? quoteBasketAddedLabel(addQty)
            : quoteBasketAddLabel(addQty)}
        </button>
        {status === "added" ? (
          <Link
            href="/quote-basket"
            className="text-sm font-medium text-brass underline-offset-2 hover:underline"
          >
            ดูตะกร้าใบเสนอราคา
          </Link>
        ) : null}
      </div>
      <p className="text-xs text-ink/55">{quoteBasketLockNote(addQty)}</p>
      <p className="text-xs text-ink/55">{PRICE_ESTIMATE_DISCLAIMER}</p>
    </div>
  );
}
