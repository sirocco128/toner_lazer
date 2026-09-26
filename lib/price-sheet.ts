/**
 * Ops 3-tab price sheet — Sheet1 params → Sheet2 cost rows → Sheet3 final preview.
 * Sell path reuses computeUnitLanded (same engine as public catalog /ops/pricing).
 */

import {
  computeUnitLanded,
  defaultLandedCostConfig,
  factoryCnyForQty,
} from "@/lib/alibaba/landed-cost";
import {
  CORPORATE_MARKUP,
  evaluateForcedMinStep,
  profitFloorForQty,
  type ForcedMinQtyProfile,
} from "@/lib/alibaba/forced-min-qty";
import {
  INLAND_CNY_PER_CBM,
  INLAND_MIN_CNY,
  MARKUP_BANDS,
  SMALL_ORDER_FACTORS,
  SMARTGIFT_FX_CNY_THB,
} from "@/lib/alibaba/rates";
import type {
  AlibabaOffer,
  FreightCategory,
  FreightMode,
  FreightOrigin,
} from "@/lib/alibaba/types";
import {
  DEFAULT_PACKAGING_MAX_THB,
  DEFAULT_PACKAGING_MIN_THB,
} from "@/lib/product-price-options";
import { formatFormulaCheckNote } from "@/lib/price-formula-note";

export const PRICE_SHEET_TEMPLATE_HREF =
  "/ops/templates/price-sheet-3tab-template.xlsx";

export type PriceSheetTab = "sheet1" | "sheet2" | "sheet3";

export type PriceSheetParams = {
  cnyToThb: number;
  profile: ForcedMinQtyProfile;
  includeFreight: boolean;
  includePackaging: boolean;
  packagingMinThb: number;
  packagingMaxThb: number;
  month: number;
  forceMode?: FreightMode;
};

export type PriceSheetProductInput = {
  id: string;
  name: string;
  qty: number;
  /** Override factory CNY; empty → ladder/min-max from offer. */
  factoryCny?: number;
  slug?: string;
  image?: string;
  source?: "catalog" | "demo";
  hasOffer?: boolean;
  /** 1688 / factory offer — preferred path (computeUnitLanded). */
  offer?: AlibabaOffer;
  /** SKU master landed unit when offer dims are missing. */
  unitLandedCostThb?: number;
  catalogSellMin?: number;
  catalogSellMax?: number;
  packagingMinThb?: number;
  packagingMaxThb?: number;
};

export type PriceSheetComputedRow = {
  id: string;
  name: string;
  qty: number;
  factoryCny: number;
  factoryThb: number;
  inlandThb: number;
  freightThb: number;
  landedCostThb: number;
  sof: number;
  markup: number;
  sellThb: number;
  sellMin: number;
  sellMax: number;
  packageProfitThb: number;
  floorThb: number;
  meetsFloor: boolean;
  mode?: FreightMode;
  tier?: string;
  formulaNote: string;
  source: "landed" | "unit_landed" | "catalog";
  error?: string;
};

export const DEFAULT_PRICE_SHEET_PARAMS: PriceSheetParams = {
  cnyToThb: SMARTGIFT_FX_CNY_THB,
  profile: "standard",
  includeFreight: true,
  includePackaging: false,
  packagingMinThb: DEFAULT_PACKAGING_MIN_THB,
  packagingMaxThb: DEFAULT_PACKAGING_MAX_THB,
  month: new Date().getMonth() + 1,
};

/** Demo SKUs kept for Excel mock / tests — Sheet2 seeds from catalog instead. */
export const DEMO_PRICE_SHEET_PRODUCTS: PriceSheetProductInput[] = [
  {
    id: "DEMO-BOX-01",
    name: "กล่องของขวัญพรีเมียม A",
    qty: 50,
    source: "demo",
    hasOffer: true,
    offer: {
      slug: "demo-box-01",
      offerId: "demo-box-01",
      minOrder: 10,
      factoryMinCny: 24,
      factoryMaxCny: 28,
      weightKg: 0.45,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 8,
      origin: "guangzhou_shenzhen",
      category: "general",
      bulkQty: 300,
    },
  },
  {
    id: "DEMO-TUM-02",
    name: "ชุดแก้วเก็บความเย็น",
    qty: 100,
    source: "demo",
    hasOffer: true,
    offer: {
      slug: "demo-tum-02",
      offerId: "demo-tum-02",
      minOrder: 20,
      factoryMinCny: 38,
      factoryMaxCny: 45,
      weightKg: 0.65,
      lengthCm: 25,
      widthCm: 10,
      heightCm: 10,
      origin: "guangzhou_shenzhen",
      category: "general",
      bulkQty: 300,
    },
  },
  {
    id: "DEMO-HAM-03",
    name: "กระเช้าองค์กรพรีเมียม",
    qty: 20,
    source: "demo",
    hasOffer: true,
    offer: {
      slug: "demo-ham-03",
      offerId: "demo-ham-03",
      minOrder: 10,
      factoryMinCny: 72,
      factoryMaxCny: 80,
      weightKg: 1.2,
      lengthCm: 30,
      widthCm: 25,
      heightCm: 15,
      origin: "guangzhou_shenzhen",
      category: "general",
      bulkQty: 300,
    },
  },
];

export function sofBandTable(): { maxQtyLabel: string; sof: number }[] {
  return SMALL_ORDER_FACTORS.map((row) => ({
    maxQtyLabel:
      row.maxQty === Number.POSITIVE_INFINITY
        ? "500+"
        : row.maxQty === 499
          ? "301–499"
          : `≤${row.maxQty}`,
    sof: row.sof,
  }));
}

export function markupBandTable(): { maxCostLabel: string; markup: number }[] {
  return MARKUP_BANDS.map((row) => ({
    maxCostLabel:
      row.maxCostThb === Number.POSITIVE_INFINITY
        ? ">650"
        : `≤${row.maxCostThb}`,
    markup: row.markup,
  }));
}

export function inlandDefaults(): { rateCnyPerCbm: number; minCny: number } {
  return { rateCnyPerCbm: INLAND_CNY_PER_CBM, minCny: INLAND_MIN_CNY };
}

function withOfferOverrides(
  offer: AlibabaOffer,
  origin?: FreightOrigin,
  category?: FreightCategory,
): AlibabaOffer {
  return {
    ...offer,
    origin: origin ?? offer.origin ?? "guangzhou_shenzhen",
    category: category ?? offer.category ?? "general",
  };
}

function packAdds(product: PriceSheetProductInput, params: PriceSheetParams) {
  const min = params.includePackaging
    ? (product.packagingMinThb ?? params.packagingMinThb)
    : 0;
  const max = params.includePackaging
    ? (product.packagingMaxThb ?? params.packagingMaxThb)
    : 0;
  return { packMin: min, packMax: max };
}

function fromUnitLanded(
  product: PriceSheetProductInput,
  params: PriceSheetParams,
  unitLandedCostThb: number,
  factoryCny: number,
): PriceSheetComputedRow {
  const qty = Math.max(1, Math.floor(Number(product.qty) || 1));
  const step = evaluateForcedMinStep(
    unitLandedCostThb,
    qty,
    params.profile,
  );
  const { packMin, packMax } = packAdds(product, params);
  const sellMin = Math.round(step.sellThb + packMin);
  const sellMax = Math.round(step.sellThb + packMax);
  const sellThb = sellMin;
  const packageProfitThb = (sellThb - unitLandedCostThb) * qty;
  const meetsFloor = packageProfitThb >= step.floor;
  const formulaNote = formatFormulaCheckNote({
    qty,
    factoryCny,
    fx: params.cnyToThb,
    factoryThb: factoryCny * params.cnyToThb,
    inlandThb: 0,
    freightThb: 0,
    landedCostThb: unitLandedCostThb,
    sof: step.sof,
    markup: step.markup,
    sellThb,
    includeFreight: params.includeFreight,
    includePackaging: params.includePackaging,
    packagingThb: packMin || undefined,
    gpThb: sellThb - unitLandedCostThb,
    meetsFloor,
    floorThb: step.floor,
    profile: params.profile,
  });

  return {
    id: product.id,
    name: product.name,
    qty,
    factoryCny,
    factoryThb: factoryCny * params.cnyToThb,
    inlandThb: 0,
    freightThb: 0,
    landedCostThb: unitLandedCostThb,
    sof: step.sof,
    markup: step.markup,
    sellThb,
    sellMin,
    sellMax,
    packageProfitThb,
    floorThb: step.floor,
    meetsFloor,
    formulaNote,
    source: "unit_landed",
  };
}

function fromCatalogBand(
  product: PriceSheetProductInput,
  params: PriceSheetParams,
): PriceSheetComputedRow {
  const qty = Math.max(1, Math.floor(Number(product.qty) || 1));
  const { packMin, packMax } = packAdds(product, params);
  const baseMin = Math.max(0, Number(product.catalogSellMin) || 0);
  const baseMax = Math.max(baseMin, Number(product.catalogSellMax) || baseMin);
  const sellMin = Math.round(baseMin + packMin);
  const sellMax = Math.round(baseMax + packMax);
  const floorThb = profitFloorForQty(qty, params.profile);

  return {
    id: product.id,
    name: product.name,
    qty,
    factoryCny: 0,
    factoryThb: 0,
    inlandThb: 0,
    freightThb: 0,
    landedCostThb: 0,
    sof: 1,
    markup: 1,
    sellThb: sellMin,
    sellMin,
    sellMax,
    packageProfitThb: 0,
    floorThb,
    meetsFloor: sellMin > 0,
    formulaNote: "",
    source: "catalog",
    error:
      sellMin > 0
        ? undefined
        : "ยังไม่มีต้นทุนลงเรือ — ใช้ช่วงราคาแคตตาล็อกไม่ได้",
  };
}

export function computePriceSheetRow(
  product: PriceSheetProductInput,
  params: PriceSheetParams,
): PriceSheetComputedRow {
  const qty = Math.max(1, Math.floor(Number(product.qty) || 1));
  const config = defaultLandedCostConfig({
    cnyToThb: params.cnyToThb > 0 ? params.cnyToThb : SMARTGIFT_FX_CNY_THB,
    month: Math.min(12, Math.max(1, Math.floor(params.month) || 1)),
    forceMode: params.forceMode,
  });
  const rowParams: PriceSheetParams = {
    ...params,
    cnyToThb: config.cnyToThb,
    packagingMinThb: product.packagingMinThb ?? params.packagingMinThb,
    packagingMaxThb: product.packagingMaxThb ?? params.packagingMaxThb,
  };

  if (product.offer) {
    const offer = withOfferOverrides(product.offer);
    const factoryCny =
      product.factoryCny != null && Number.isFinite(product.factoryCny)
        ? Number(product.factoryCny)
        : factoryCnyForQty(offer, qty);

    const landed = computeUnitLanded(offer, qty, factoryCny, config);
    if (landed) {
      const sof = landed.sof;
      const markup =
        params.profile === "corporate" ? CORPORATE_MARKUP : landed.markup;
      const goodsThb = landed.factoryThb + landed.inlandThb;
      const baseSell =
        params.profile === "corporate"
          ? Math.round(
              (params.includeFreight ? landed.landedCostThb : goodsThb) *
                sof *
                CORPORATE_MARKUP,
            )
          : params.includeFreight
            ? landed.sellThb
            : landed.sellExFreightThb;
      const { packMin, packMax } = packAdds(product, rowParams);
      const sellMin = Math.round(baseSell + packMin);
      const sellMax = Math.round(baseSell + packMax);
      const sellThb = sellMin;
      const floorThb = profitFloorForQty(qty, params.profile);
      const packageProfitThb = (sellThb - landed.landedCostThb) * qty;
      const meetsFloor = packageProfitThb >= floorThb;

      return {
        id: product.id,
        name: product.name,
        qty,
        factoryCny,
        factoryThb: landed.factoryThb,
        inlandThb: landed.inlandThb,
        freightThb: landed.freightThb,
        landedCostThb: landed.landedCostThb,
        sof,
        markup,
        sellThb,
        sellMin,
        sellMax,
        packageProfitThb,
        floorThb,
        meetsFloor,
        mode: landed.mode,
        tier: landed.tier,
        formulaNote: formatFormulaCheckNote({
          qty,
          factoryCny,
          fx: config.cnyToThb,
          factoryThb: landed.factoryThb,
          inlandThb: landed.inlandThb,
          freightThb: landed.freightThb,
          landedCostThb: landed.landedCostThb,
          sof,
          markup,
          sellThb,
          includeFreight: params.includeFreight,
          includePackaging: params.includePackaging,
          packagingThb: packMin || undefined,
          mode: landed.mode,
          tier: landed.tier,
          gpThb: sellThb - landed.landedCostThb,
          meetsFloor,
          floorThb,
          profile: params.profile,
        }),
        source: "landed",
      };
    }

    if (
      product.unitLandedCostThb != null &&
      product.unitLandedCostThb > 0
    ) {
      return fromUnitLanded(
        product,
        rowParams,
        product.unitLandedCostThb,
        factoryCny,
      );
    }

    const catalog = fromCatalogBand(product, rowParams);
    return {
      ...catalog,
      error:
        catalog.sellThb > 0
          ? "คิดลงเรือไม่ได้ (ไม่มีน้ำหนัก/ขนาด) — ใช้ราคาแคตตาล็อก"
          : catalog.error,
    };
  }

  if (product.unitLandedCostThb != null && product.unitLandedCostThb > 0) {
    const factoryCny =
      product.factoryCny != null && Number.isFinite(product.factoryCny)
        ? Number(product.factoryCny)
        : 0;
    return fromUnitLanded(
      product,
      rowParams,
      product.unitLandedCostThb,
      factoryCny,
    );
  }

  return fromCatalogBand(product, rowParams);
}

export function computePriceSheetRows(
  products: PriceSheetProductInput[],
  params: PriceSheetParams,
): PriceSheetComputedRow[] {
  return products.map((product) => computePriceSheetRow(product, params));
}

export function priceSheetGrandTotal(rows: PriceSheetComputedRow[]): number {
  return rows.reduce((sum, row) => sum + row.sellThb * row.qty, 0);
}

/** True when the client can recompute without a server round-trip. */
export function canClientComputePriceSheet(
  products: PriceSheetProductInput[],
  canSeeCost: boolean,
): boolean {
  if (!canSeeCost) return false;
  return products.every(
    (p) =>
      Boolean(p.offer) ||
      (p.unitLandedCostThb != null && p.unitLandedCostThb > 0) ||
      (p.catalogSellMin != null && p.catalogSellMin > 0),
  );
}
