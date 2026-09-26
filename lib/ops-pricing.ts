/**
 * Ops quote calculator — same landed-cost engine as public catalog prices.
 * Factory CNY / markup / GP stay off the payload unless factory.read.
 */

import {
  computeQuoteLadder,
  defaultLandedCostConfig,
  markupForLandedCost,
  quoteQtyBreaks,
  quoteSellWithOptions,
} from "@/lib/alibaba/landed-cost";
import { loadOffersFromFile } from "@/lib/alibaba/offers";
import type {
  AlibabaOffer,
  FreightCategory,
  FreightMode,
  FreightOrigin,
} from "@/lib/alibaba/types";
import {
  CORPORATE_BREAKS,
  CORPORATE_MARKUP,
  evaluateForcedMinStep,
  type ForcedMinQtyProfile,
} from "@/lib/alibaba/forced-min-qty";
import type { Product } from "@/lib/data";
import { actorMay, type OpsActor } from "@/lib/ops-roles";
import {
  applyProductPriceOptions,
  DEFAULT_PACKAGING_MAX_THB,
  DEFAULT_PACKAGING_MIN_THB,
} from "@/lib/product-price-options";
import { formatFormulaCheckNote } from "@/lib/price-formula-note";
import { getProductBySlug, getProducts } from "@/lib/strapi";

export type OpsCatalogItem = {
  slug: string;
  name: string;
  image: string;
  minOrder: number;
  priceMin: number;
  priceMax: number;
  priceRange: string;
  priceExFreightMin?: number;
  priceExFreightMax?: number;
  packagingMin?: number;
  packagingMax?: number;
  categorySlug: string;
  hasOffer: boolean;
};

export type OpsQuoteCost = {
  factoryCny: number;
  factoryThb: number;
  inlandThb: number;
  freightThb: number;
  landedCostThb: number;
  sof: number;
  markup: number;
  gpThb: number;
  tier: string;
};

export type OpsQuoteRow = {
  qty: number;
  sellThb: number;
  sellMin: number;
  sellMax: number;
  source: "landed" | "catalog";
  mode?: FreightMode;
  belowFloor?: boolean;
  cost?: OpsQuoteCost;
  formulaNote?: string;
};

export type OpsPricingResult = {
  ok: true;
  product: OpsCatalogItem | null;
  rows: OpsQuoteRow[];
  note: string;
  fx: number;
  canSeeCost: boolean;
};

export type OpsPricingFailure = {
  ok: false;
  error: string;
};

export type OpsPricingComputeInput = {
  slug?: string;
  extraQty?: number;
  includeFreight: boolean;
  includePackaging: boolean;
  month: number;
  profile?: ForcedMinQtyProfile;
  forceMode?: FreightMode;
  origin?: FreightOrigin;
  category?: FreightCategory;
  cnyToThb?: number;
  factoryCny?: number;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
};

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

export function resetOpsPricingOfferCache(): void {
  offerCache = null;
}

export function toOpsCatalogItem(
  product: Product,
  hasOffer: boolean,
): OpsCatalogItem {
  return {
    slug: product.slug,
    name: product.name,
    image: product.images[0] || "/images/product-placeholder.jpg",
    minOrder: product.minOrder,
    priceMin: product.priceMin,
    priceMax: product.priceMax,
    priceRange: product.priceRange,
    priceExFreightMin: product.priceExFreightMin,
    priceExFreightMax: product.priceExFreightMax,
    packagingMin: product.packagingMin,
    packagingMax: product.packagingMax,
    categorySlug: product.categorySlug,
    hasOffer,
  };
}

export async function listOpsCatalog(query = ""): Promise<OpsCatalogItem[]> {
  const products = await getProducts();
  const bySlug = new Map(offers().map((offer) => [offer.slug, offer]));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? products.filter((product) =>
        `${product.name} ${product.slug} ${product.categorySlug}`
          .toLowerCase()
          .includes(q),
      )
    : products;
  return filtered
    .slice(0, 80)
    .map((product) => toOpsCatalogItem(product, bySlug.has(product.slug)));
}

function mergeOfferOverrides(
  offer: AlibabaOffer,
  input: OpsPricingComputeInput,
  canSeeCost: boolean,
): AlibabaOffer {
  if (!canSeeCost) return offer;
  const next: AlibabaOffer = { ...offer };
  if (input.origin) next.origin = input.origin;
  if (input.category) next.category = input.category;
  if (isPositive(input.weightKg)) next.weightKg = input.weightKg;
  if (isPositive(input.lengthCm)) next.lengthCm = input.lengthCm;
  if (isPositive(input.widthCm)) next.widthCm = input.widthCm;
  if (isPositive(input.heightCm)) next.heightCm = input.heightCm;
  if (isPositive(input.factoryCny)) {
    next.factoryMinCny = input.factoryCny;
    next.factoryMaxCny = input.factoryCny;
    next.ladders = undefined;
  }
  return next;
}

function catalogBandRows(
  product: Product,
  extraQty: number | undefined,
  flags: { includeFreight: boolean; includePackaging: boolean },
): OpsQuoteRow[] {
  const priced = applyProductPriceOptions(product, flags);
  const qty = Math.max(
    product.minOrder,
    Number.isFinite(extraQty) ? Math.floor(extraQty as number) : product.minOrder,
  );
  return [
    {
      qty,
      sellThb: priced.priceMin,
      sellMin: priced.priceMin,
      sellMax: priced.priceMax,
      source: "catalog",
    },
  ];
}

export async function computeOpsPricing(
  actor: OpsActor,
  input: OpsPricingComputeInput,
): Promise<OpsPricingResult | OpsPricingFailure> {
  const canSeeCost = actorMay(actor, "factory.read");
  const slug = (input.slug || "").trim();
  const product = slug ? await getProductBySlug(slug) : null;
  if (slug && !product) {
    return { ok: false, error: "ไม่พบสินค้านี้ในแคตตาล็อกเว็บ" };
  }

  const fx =
    isPositive(input.cnyToThb) && canSeeCost
      ? input.cnyToThb
      : defaultLandedCostConfig().cnyToThb;
  const month = clampMonth(input.month);
  const config = defaultLandedCostConfig({
    cnyToThb: fx,
    month,
    ...(input.forceMode ? { forceMode: input.forceMode } : {}),
  });
  const flags = {
    includeFreight: Boolean(input.includeFreight),
    includePackaging: Boolean(input.includePackaging),
  };

  const fileOffer = product
    ? offers().find((offer) => offer.slug === product.slug)
    : undefined;

  if (!fileOffer && product) {
    return {
      ok: true,
      product: toOpsCatalogItem(product, false),
      rows: catalogBandRows(product, input.extraQty, flags),
      note: "ใช้ช่วงราคาเดียวกับหน้าเว็บ — ยังไม่มีต้นทุนโรงงาน/ขนาดกล่องพอจะแตกตามจำนวน",
      fx,
      canSeeCost,
    };
  }

  if (!fileOffer) {
    return { ok: false, error: "เลือกสินค้าจากแคตตาล็อกก่อน" };
  }

  const offer = mergeOfferOverrides(fileOffer, input, canSeeCost);
  const profile = input.profile === "corporate" ? "corporate" : "standard";
  const qtys = quoteQtyBreaks(
    offer.minOrder || product?.minOrder || 30,
    [input.extraQty ?? 0],
    profile === "corporate" ? CORPORATE_BREAKS : undefined,
  );
  const ladder = computeQuoteLadder(offer, qtys, config);
  if (!ladder) {
    return {
      ok: true,
      product: product ? toOpsCatalogItem(product, true) : null,
      rows: product ? catalogBandRows(product, input.extraQty, flags) : [],
      note: "คิดรายจำนวนไม่ได้ เพราะยังไม่มีน้ำหนักหรือขนาดกล่อง — ใช้ช่วงราคาบนเว็บแทน",
      fx,
      canSeeCost,
    };
  }

  const pack = {
    min: product?.packagingMin ?? DEFAULT_PACKAGING_MIN_THB,
    max: product?.packagingMax ?? DEFAULT_PACKAGING_MAX_THB,
  };
  const rows: OpsQuoteRow[] = ladder.map((row) => {
    const priced =
      profile === "corporate"
        ? {
            sellThb: Math.round(
              row.landed.landedCostThb * row.landed.sof * CORPORATE_MARKUP,
            ),
            sellExFreightThb: Math.round(
              (row.landed.factoryThb + row.landed.inlandThb) *
                row.landed.sof *
                CORPORATE_MARKUP,
            ),
          }
        : row.landed;
    const sell = quoteSellWithOptions(priced, flags, pack);
    const floor = evaluateForcedMinStep(
      row.landed.landedCostThb,
      row.qty,
      profile,
    );
    const goodsThb = row.landed.factoryThb + row.landed.inlandThb;
    const usedMarkup =
      profile === "corporate"
        ? CORPORATE_MARKUP
        : flags.includeFreight
          ? row.landed.markup
          : markupForLandedCost(goodsThb);
    const gpThb = Math.round((sell.sellThb - row.landed.landedCostThb) * row.qty);
    const out: OpsQuoteRow = {
      qty: row.qty,
      sellThb: sell.sellThb,
      sellMin: sell.sellMin,
      sellMax: sell.sellMax,
      source: "landed",
      mode: row.landed.mode,
      belowFloor: !floor.meetsFloor,
    };
    if (canSeeCost) {
      out.cost = {
        factoryCny: row.factoryCny,
        factoryThb: round2(row.landed.factoryThb),
        inlandThb: round2(row.landed.inlandThb),
        freightThb: round2(row.landed.freightThb),
        landedCostThb: round2(row.landed.landedCostThb),
        sof: row.landed.sof,
        markup: usedMarkup,
        gpThb,
        tier: row.landed.tier,
      };
      out.formulaNote = formatFormulaCheckNote({
        qty: row.qty,
        factoryCny: row.factoryCny,
        fx,
        factoryThb: row.landed.factoryThb,
        inlandThb: row.landed.inlandThb,
        freightThb: row.landed.freightThb,
        landedCostThb: row.landed.landedCostThb,
        sof: row.landed.sof,
        markup: usedMarkup,
        sellThb: sell.sellThb,
        includeFreight: flags.includeFreight,
        includePackaging: flags.includePackaging,
        packagingThb: flags.includePackaging ? pack.min : 0,
        mode: row.landed.mode,
        tier: row.landed.tier,
        gpThb,
        meetsFloor: floor.meetsFloor,
        floorThb: floor.floor,
        profile,
      });
    }
    return out;
  });

  return {
    ok: true,
    product: product ? toOpsCatalogItem(product, true) : null,
    rows,
    note:
      profile === "corporate"
        ? "โปรไฟล์องค์กร: markup 1.47 เท่าของต้นทุนรวม (สูตรมาสเตอร์ SKU) ไม่ใช่ช่วงราคาหน้าเว็บสาธารณะ — ดูสูตรรีเช็ครายจำนวนในตาราง"
        : "สูตรเดียวกับราคาบนเว็บ: ต้นทุนโรงงาน × SOF × markup ตามช่วง + ค่าขนส่งจีน (รถ/เรือตามเดือนและ CBM) — ดูสูตรรีเช็ครายจำนวนในตาราง",
    fx,
    canSeeCost,
  };
}

function isPositive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clampMonth(month: number): number {
  const n = Math.round(Number(month));
  if (!Number.isFinite(n) || n < 1 || n > 12) return new Date().getMonth() + 1;
  return n;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
