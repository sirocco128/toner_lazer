/**
 * Ops SKU price ladder from stored cost conditions.
 * Same formula as forced-min-qty: landed × SOF × markup vs profit floors.
 */

import { SMARTGIFT_FX_CNY_THB } from "@/lib/alibaba/rates";
import {
  computeForcedMinQty,
  MOQ_LADDER,
  unitLandedFromFactory,
  type ForcedMinQtyProfile,
  type ForcedMinQtyStep,
} from "@/lib/alibaba/forced-min-qty";
import {
  formatLandedLadderFormulaNote,
  formulaBandLegend,
} from "@/lib/price-formula-note";
import type { SkuRecord } from "@/lib/sku-master-types";

export const PRICE_STRUCTURE_QTYS = MOQ_LADDER;

export type SkuPriceInputs = Pick<
  SkuRecord,
  | "stockClass"
  | "isBundle"
  | "sellPriceThb"
  | "factoryUnitCny"
  | "factoryUnitUsd"
  | "unitLandedCostThb"
  | "forcedMinQty"
>;

export type SkuPriceStructureStep = ForcedMinQtyStep & {
  isForcedMin: boolean;
  formulaNote: string;
};

export type SkuPriceStructure = {
  kind: "ladder" | "fixed" | "empty";
  profile: ForcedMinQtyProfile;
  landedCostThb: number | null;
  forcedMinQty: number | null;
  sellPriceThb: number | null;
  steps: SkuPriceStructureStep[];
  note: string;
};

export function parsePriceProfile(raw?: string | null): ForcedMinQtyProfile {
  return raw === "corporate" ? "corporate" : "standard";
}

export function skuPriceStructure(
  sku: SkuPriceInputs,
  profile: ForcedMinQtyProfile = "standard",
): SkuPriceStructure {
  const sellPriceThb = positiveMoney(sku.sellPriceThb);

  if (sku.stockClass === "C") {
    return fixedStructure(
      profile,
      sellPriceThb,
      sku.forcedMinQty,
      sellPriceThb ? "ราคาเคลียร์ที่ตั้งไว้ ไม่ใช้บันไดจำนวน" : "ยังไม่มีราคาเคลียร์",
    );
  }

  if (sku.isBundle) {
    return fixedStructure(
      profile,
      sellPriceThb,
      sku.forcedMinQty,
      sellPriceThb ? "ราคาบันเดิลที่ตั้งไว้" : "ยังไม่มีราคาบันเดิล",
    );
  }

  const landed = unitLandedFromFactory(
    sku.factoryUnitCny,
    sku.factoryUnitUsd,
    sku.unitLandedCostThb,
    SMARTGIFT_FX_CNY_THB,
  );
  if (landed == null) {
    return fixedStructure(
      profile,
      sellPriceThb,
      sku.forcedMinQty,
      sellPriceThb
        ? "มีราคาตั้ง แต่ยังไม่มีต้นทุนลงเรือ จึงยังไม่แตกบันได"
        : "ยังไม่มีต้นทุน — ใส่ CNY / USD หรือต้นทุนลงเรือที่หน้ารหัสขาย",
    );
  }

  const computed = computeForcedMinQty({
    unitLandedCostThb: landed,
    profile,
  });
  const forcedMinQty = sku.forcedMinQty ?? computed.forcedMinQty;
  return {
    kind: "ladder",
    profile,
    landedCostThb: landed,
    forcedMinQty,
    sellPriceThb,
    steps: computed.steps.map((step) => ({
      ...step,
      isForcedMin: step.qty === forcedMinQty,
      formulaNote: formatLandedLadderFormulaNote({
        qty: step.qty,
        landedCostThb: landed,
        sof: step.sof,
        markup: step.markup,
        sellThb: step.sellThb,
        packageProfitThb: step.packageProfitThb,
        floor: step.floor,
        meetsFloor: step.meetsFloor,
        profile,
      }),
    })),
    note:
      profile === "corporate"
        ? `องค์กร: markup 1.47 · กำไรชุดอย่างน้อย 20,000\n${formulaBandLegend(profile)}`
        : `ทั่วไป: ต้นทุนลงเรือ × SOF × markup · กำไรชุด 5,000 (<500) / 3,000 (500+)\n${formulaBandLegend(profile)}`,
  };
}

export function stepForQty(
  structure: SkuPriceStructure,
  qty: number,
): SkuPriceStructureStep | undefined {
  return structure.steps.find((step) => step.qty === qty);
}

function positiveMoney(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function fixedStructure(
  profile: ForcedMinQtyProfile,
  sellPriceThb: number | null,
  forcedMinQty: number | null,
  note: string,
): SkuPriceStructure {
  return {
    kind: sellPriceThb ? "fixed" : "empty",
    profile,
    landedCostThb: null,
    forcedMinQty,
    sellPriceThb,
    steps: [],
    note,
  };
}
