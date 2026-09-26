/**
 * SmartGift landed cost → public THB priceMin/priceMax (estimates, not quotes).
 */

import {
  cbmFromCm,
  internationalFreightThb,
  selectFreightMode,
  shipmentTotals,
} from "@/lib/alibaba/shipping";
import {
  INLAND_CNY_PER_CBM,
  INLAND_MIN_CNY,
  MARKUP_BANDS,
  SMALL_ORDER_FACTORS,
  SMARTGIFT_FX_CNY_THB,
} from "@/lib/alibaba/rates";
import type {
  AlibabaOffer,
  LandedCostConfig,
  PublicPriceRange,
  UnitLandedBreakdown,
} from "@/lib/alibaba/types";
import {
  DEFAULT_PACKAGING_MAX_THB,
  DEFAULT_PACKAGING_MIN_THB,
} from "@/lib/product-price-options";

export function defaultLandedCostConfig(
  overrides: Partial<LandedCostConfig> = {},
): LandedCostConfig {
  return {
    cnyToThb: envNumber("ALIBABA_FX_CNY_THB", SMARTGIFT_FX_CNY_THB),
    densityThresholdKgPerCbm: 400,
    minChargeableCbm: 0.01,
    seaThresholdCbm: 5,
    inlandRateCnyPerCbm: envNumber("ALIBABA_INLAND_CNY_PER_CBM", INLAND_CNY_PER_CBM),
    inlandMinCny: envNumber("ALIBABA_INLAND_MIN_CNY", INLAND_MIN_CNY),
    month: new Date().getMonth() + 1,
    ...overrides,
  };
}

export function smallOrderFactor(qty: number): number {
  const n = Math.max(1, qty);
  const row = SMALL_ORDER_FACTORS.find((item) => n <= item.maxQty);
  return row?.sof ?? 1;
}

export function markupForLandedCost(landedCostThb: number): number {
  const row = MARKUP_BANDS.find((item) => landedCostThb <= item.maxCostThb);
  return row?.markup ?? 2.14;
}

export function computeUnitLanded(
  offer: AlibabaOffer,
  qty: number,
  factoryCny: number,
  config: LandedCostConfig,
): UnitLandedBreakdown | null {
  const unitCbm = cbmFromCm(offer.lengthCm, offer.widthCm, offer.heightCm);
  const totals = shipmentTotals(qty, offer.weightKg, unitCbm);
  if (!totals) return null;

  const origin = offer.origin ?? "guangzhou_shenzhen";
  const category = offer.category ?? "general";
  const mode = selectFreightMode(totals.cbm, config);
  const freight = internationalFreightThb(
    totals.cbm,
    totals.kg,
    origin,
    mode,
    category,
    config,
  );

  const inlandCny =
    offer.inlandFreightCny ??
    Math.max(freight.billedCbm * config.inlandRateCnyPerCbm, config.inlandMinCny);
  const fx = config.cnyToThb;
  const factoryThb = factoryCny * fx;
  const inlandThb = (inlandCny * fx) / qty;
  const freightThb = freight.thb / qty;
  const goodsThb = factoryThb + inlandThb;
  const landedCostThb = goodsThb + freightThb;
  const sof = smallOrderFactor(qty);
  const markup = markupForLandedCost(landedCostThb);
  const markupExFreight = markupForLandedCost(goodsThb);
  const sellExFreightThb = Math.round(goodsThb * sof * markupExFreight);
  const sellThb = Math.round(landedCostThb * sof * markup);

  return {
    qty,
    factoryThb,
    inlandThb,
    freightThb,
    landedCostThb,
    sof,
    markup,
    sellThb,
    sellExFreightThb,
    mode,
    tier: freight.tier,
    shipmentCbm: freight.billedCbm,
    shipmentKg: totals.kg,
  };
}

/**
 * Public band: cheap end = factory min @ bulk + sea when volume allows;
 * high end = factory max @ MOQ (typically truck MEMBER).
 */
export function computePublicPriceRange(
  offer: AlibabaOffer,
  config: LandedCostConfig = defaultLandedCostConfig(),
): PublicPriceRange | null {
  const minOrder = Math.max(1, Math.floor(offer.minOrder || 1));
  const bulkQty = Math.max(minOrder, Math.floor(offer.bulkQty ?? 300));

  const high = computeUnitLanded(offer, minOrder, offer.factoryMaxCny, config);
  const low = computeUnitLanded(offer, bulkQty, offer.factoryMinCny, config);
  if (!high || !low) return null;

  let priceMin = low.sellThb;
  let priceMax = high.sellThb;
  if (priceMax < priceMin) {
    const swap = priceMin;
    priceMin = priceMax;
    priceMax = swap;
  }

  let priceExFreightMin = low.sellExFreightThb;
  let priceExFreightMax = high.sellExFreightThb;
  if (priceExFreightMax < priceExFreightMin) {
    const swap = priceExFreightMin;
    priceExFreightMin = priceExFreightMax;
    priceExFreightMax = swap;
  }

  return {
    priceMin,
    priceMax,
    priceExFreightMin,
    priceExFreightMax,
    packagingMin: DEFAULT_PACKAGING_MIN_THB,
    packagingMax: DEFAULT_PACKAGING_MAX_THB,
    priceRange: `${priceMin}–${priceMax} บาท/ชุด`,
    minOrder,
    currency: "THB",
  };
}

/** Same steps as ops SKU forced-min (`MOQ_LADDER`). */
export const DEFAULT_QUOTE_QTYS = [10, 20, 50, 100, 300, 500, 1000] as const;

export function factoryCnyForQty(offer: AlibabaOffer, qty: number): number {
  const n = Math.max(1, Math.floor(qty));
  if (offer.ladders && offer.ladders.length > 0) {
    const sorted = [...offer.ladders].sort((a, b) => a.minQty - b.minQty);
    let price = sorted[0]!.priceCny;
    for (const row of sorted) {
      if (n >= row.minQty) price = row.priceCny;
    }
    return price;
  }
  const bulk = Math.max(offer.minOrder, Math.floor(offer.bulkQty ?? 300));
  return n >= bulk ? offer.factoryMinCny : offer.factoryMaxCny;
}

export function quoteQtyBreaks(
  minOrder: number,
  extra: number[] = [],
  ladder: readonly number[] = DEFAULT_QUOTE_QTYS,
): number[] {
  const moq = Math.max(1, Math.floor(minOrder || 1));
  const values = new Set<number>([moq]);
  for (const qty of ladder) {
    if (qty >= moq) values.add(qty);
  }
  for (const qty of extra) {
    const n = Math.floor(qty);
    if (Number.isInteger(n) && n >= moq) values.add(n);
  }
  return [...values].sort((a, b) => a - b);
}

export type QuoteLadderRow = {
  qty: number;
  factoryCny: number;
  landed: UnitLandedBreakdown;
};

export function computeQuoteLadder(
  offer: AlibabaOffer,
  qtys: number[],
  config: LandedCostConfig = defaultLandedCostConfig(),
): QuoteLadderRow[] | null {
  const rows: QuoteLadderRow[] = [];
  for (const qty of qtys) {
    const factoryCny = factoryCnyForQty(offer, qty);
    const landed = computeUnitLanded(offer, qty, factoryCny, config);
    if (!landed) return null;
    rows.push({ qty: landed.qty, factoryCny, landed });
  }
  return rows;
}

export function quoteSellWithOptions(
  landed: Pick<UnitLandedBreakdown, "sellThb" | "sellExFreightThb">,
  flags: { includeFreight: boolean; includePackaging: boolean },
  packaging = {
    min: DEFAULT_PACKAGING_MIN_THB,
    max: DEFAULT_PACKAGING_MAX_THB,
  },
): { sellThb: number; sellMin: number; sellMax: number } {
  const base = flags.includeFreight ? landed.sellThb : landed.sellExFreightThb;
  const addMin = flags.includePackaging ? packaging.min : 0;
  const addMax = flags.includePackaging ? packaging.max : 0;
  return {
    sellThb: Math.round(base + addMin),
    sellMin: Math.round(base + addMin),
    sellMax: Math.round(base + addMax),
  };
}

function envNumber(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}
