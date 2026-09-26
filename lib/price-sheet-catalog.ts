/**
 * Resolve catalog products into price-sheet rows (1688 offer → SKU landed → catalog band).
 */

import { loadOffersFromFile } from "@/lib/alibaba/offers";
import type { AlibabaOffer } from "@/lib/alibaba/types";
import { unitLandedFromFactory } from "@/lib/alibaba/forced-min-qty";
import { SMARTGIFT_FX_CNY_THB } from "@/lib/alibaba/rates";
import type { Product } from "@/lib/data";
import { actorMay, type OpsActor } from "@/lib/ops-roles";
import {
  listOpsCatalog,
  toOpsCatalogItem,
  type OpsCatalogItem,
} from "@/lib/ops-pricing";
import {
  computePriceSheetRow,
  type PriceSheetParams,
  type PriceSheetProductInput,
} from "@/lib/price-sheet";
import { listSkusByCatalogSlugs } from "@/lib/sku-master-repository";
import { getProductBySlug, getProducts } from "@/lib/strapi";

let offerCache: AlibabaOffer[] | null = null;

function offers(): AlibabaOffer[] {
  if (offerCache) return offerCache;
  try {
    offerCache = loadOffersFromFile();
  } catch {
    offerCache = [];
  }
  return offerCache;
}

export function resetPriceSheetOfferCache(): void {
  offerCache = null;
}

export type PriceSheetLineDraft = {
  slug: string;
  qty: number;
  factoryCny?: number;
  name?: string;
};

function productToSheetInput(
  product: Product,
  offer: AlibabaOffer | undefined,
  unitLandedCostThb: number | null,
  factoryUnitCny: number | null,
): PriceSheetProductInput {
  const qty = Math.max(1, Math.floor(product.minOrder || 10));
  const id = (product.productId || product.slug).trim() || product.slug;
  const base: PriceSheetProductInput = {
    id,
    name: product.name,
    qty,
    slug: product.slug,
    image: product.images[0] || "/images/product-placeholder.jpg",
    source: "catalog",
    hasOffer: Boolean(offer),
    catalogSellMin: product.priceMin,
    catalogSellMax: product.priceMax,
    packagingMinThb: product.packagingMin,
    packagingMaxThb: product.packagingMax,
  };

  if (offer) {
    return {
      ...base,
      offer: { ...offer },
      factoryCny: offer.factoryMaxCny,
      unitLandedCostThb: unitLandedCostThb ?? undefined,
    };
  }

  if (unitLandedCostThb != null && unitLandedCostThb > 0) {
    return {
      ...base,
      unitLandedCostThb,
      factoryCny: factoryUnitCny && factoryUnitCny > 0 ? factoryUnitCny : undefined,
    };
  }

  return base;
}

export async function resolvePriceSheetProduct(
  slug: string,
): Promise<PriceSheetProductInput | null> {
  const wanted = slug.trim();
  if (!wanted) return null;
  const product = await getProductBySlug(wanted);
  if (!product) return null;

  const offer = offers().find((row) => row.slug === product.slug);
  const skuMap = await listSkusByCatalogSlugs([product.slug]);
  const sku = skuMap.get(product.slug);
  const landed = sku
    ? unitLandedFromFactory(
        sku.factoryUnitCny,
        sku.factoryUnitUsd,
        sku.unitLandedCostThb,
        SMARTGIFT_FX_CNY_THB,
      )
    : null;

  return productToSheetInput(
    product,
    offer,
    landed,
    sku?.factoryUnitCny ?? null,
  );
}

export async function seedPriceSheetProducts(
  limit = 3,
): Promise<PriceSheetProductInput[]> {
  const catalog = await listOpsCatalog();
  const preferred = [
    ...catalog.filter((item) => item.hasOffer),
    ...catalog.filter((item) => !item.hasOffer),
  ].slice(0, Math.max(1, Math.min(limit, 12)));

  const out: PriceSheetProductInput[] = [];
  for (const item of preferred) {
    const row = await resolvePriceSheetProduct(item.slug);
    if (row) out.push(row);
  }

  // If catalog empty (CMS down), leave empty — UI shows picker + hint.
  if (out.length === 0) {
    const products = await getProducts();
    for (const product of products.slice(0, limit)) {
      out.push(
        productToSheetInput(
          product,
          offers().find((o) => o.slug === product.slug),
          null,
          null,
        ),
      );
    }
  }
  return out;
}

/** Strip factory / landed internals for actors without factory.read. */
export function sanitizePriceSheetProduct(
  product: PriceSheetProductInput,
  canSeeCost: boolean,
): PriceSheetProductInput {
  if (canSeeCost) return product;
  return {
    id: product.id,
    name: product.name,
    qty: product.qty,
    slug: product.slug,
    image: product.image,
    source: product.source,
    hasOffer: product.hasOffer,
    catalogSellMin: product.catalogSellMin,
    catalogSellMax: product.catalogSellMax,
    packagingMinThb: product.packagingMinThb,
    packagingMaxThb: product.packagingMaxThb,
    // Keep enough for client catalog-band / server will recompute when needed.
  };
}

export function sanitizePriceSheetProducts(
  products: PriceSheetProductInput[],
  canSeeCost: boolean,
): PriceSheetProductInput[] {
  return products.map((row) => sanitizePriceSheetProduct(row, canSeeCost));
}

export async function hydratePriceSheetLines(
  actor: OpsActor,
  lines: PriceSheetLineDraft[],
  params: PriceSheetParams,
) {
  const canSeeCost = actorMay(actor, "factory.read");
  const fullProducts: PriceSheetProductInput[] = [];

  for (const line of lines) {
    const resolved = await resolvePriceSheetProduct(line.slug);
    if (!resolved) continue;
    const next: PriceSheetProductInput = {
      ...resolved,
      qty: Math.max(1, Math.floor(Number(line.qty) || resolved.qty)),
      name: line.name?.trim() || resolved.name,
    };
    if (
      canSeeCost &&
      line.factoryCny != null &&
      Number.isFinite(line.factoryCny)
    ) {
      next.factoryCny = Number(line.factoryCny);
    }
    fullProducts.push(next);
  }

  const rows = fullProducts.map((product) => {
    const row = computePriceSheetRow(
      product,
      withProductPackaging(product, params),
    );
    if (canSeeCost) return row;
    return {
      ...row,
      factoryCny: 0,
      factoryThb: 0,
      inlandThb: 0,
      freightThb: 0,
      landedCostThb: 0,
      markup: 0,
      packageProfitThb: 0,
      floorThb: 0,
      formulaNote: "",
    };
  });

  return {
    ok: true as const,
    canSeeCost,
    products: sanitizePriceSheetProducts(fullProducts, canSeeCost),
    rows,
  };
}

function withProductPackaging(
  product: PriceSheetProductInput,
  params: PriceSheetParams,
): PriceSheetParams {
  return {
    ...params,
    packagingMinThb: product.packagingMinThb ?? params.packagingMinThb,
    packagingMaxThb: product.packagingMaxThb ?? params.packagingMaxThb,
  };
}

export function catalogItemLabel(item: OpsCatalogItem): string {
  return `${item.name} · ${item.priceRange}`;
}

export { toOpsCatalogItem, listOpsCatalog };
