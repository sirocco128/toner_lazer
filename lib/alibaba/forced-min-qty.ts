/**
 * Forced minimum order qty from landed cost × SOF × markup vs profit floors.
 * USD in this formula is the catalog spec rate (32.50), not the live factory-PO guide.
 */

import {
  markupForLandedCost,
  smallOrderFactor,
} from "@/lib/alibaba/landed-cost";
import { SMARTGIFT_FX_USD_THB } from "@/lib/alibaba/rates";

export const MOQ_LADDER = [10, 20, 50, 100, 300, 500, 1000] as const;

export const SMALL_ORDER_PROFIT_FLOOR = 5000;
export const STANDARD_PROFIT_FLOOR = 3000;
export const CORPORATE_MARKUP = 1.47;
export const CORPORATE_PROFIT_FLOOR = 20_000;
export const CORPORATE_PROFIT_TARGET = 30_000;
export const CORPORATE_ANCHOR_QTY = 1000;
export const CORPORATE_BREAKS = [100, 300, 500, 1000] as const;

export type ForcedMinQtyProfile = "standard" | "corporate";

export type ForcedMinQtyInput = {
  unitLandedCostThb: number;
  profile?: ForcedMinQtyProfile;
};

export type ForcedMinQtyStep = {
  qty: number;
  sof: number;
  markup: number;
  sellThb: number;
  unitProfitThb: number;
  packageProfitThb: number;
  floor: number;
  meetsFloor: boolean;
};

export type ForcedMinQtyResult = {
  forcedMinQty: number;
  profile: ForcedMinQtyProfile;
  unitLandedCostThb: number;
  steps: ForcedMinQtyStep[];
};

export function factoryUsdToThb(usd: number): number {
  return usd * SMARTGIFT_FX_USD_THB;
}

export function profitFloorForQty(
  qty: number,
  profile: ForcedMinQtyProfile = "standard",
): number {
  if (profile === "corporate") return CORPORATE_PROFIT_FLOOR;
  return qty < 500 ? SMALL_ORDER_PROFIT_FLOOR : STANDARD_PROFIT_FLOOR;
}

export function markupForProfile(
  unitLandedCostThb: number,
  profile: ForcedMinQtyProfile,
): number {
  if (profile === "corporate") return CORPORATE_MARKUP;
  return markupForLandedCost(unitLandedCostThb);
}

export function evaluateForcedMinStep(
  unitLandedCostThb: number,
  qty: number,
  profile: ForcedMinQtyProfile = "standard",
): ForcedMinQtyStep {
  const sof = smallOrderFactor(qty);
  const markup = markupForProfile(unitLandedCostThb, profile);
  const sellThb = Math.round(unitLandedCostThb * sof * markup);
  const unitProfitThb = sellThb - unitLandedCostThb;
  const packageProfitThb = unitProfitThb * qty;
  const floor = profitFloorForQty(qty, profile);
  return {
    qty,
    sof,
    markup,
    sellThb,
    unitProfitThb,
    packageProfitThb,
    floor,
    meetsFloor: packageProfitThb >= floor,
  };
}

export function computeForcedMinQty(input: ForcedMinQtyInput): ForcedMinQtyResult {
  const unitLandedCostThb = Number(input.unitLandedCostThb);
  const profile = input.profile ?? "standard";
  if (!Number.isFinite(unitLandedCostThb) || unitLandedCostThb <= 0) {
    throw new Error("invalid_unit_landed_cost");
  }

  const ladder =
    profile === "corporate" ? [...CORPORATE_BREAKS] : [...MOQ_LADDER];
  const steps = ladder.map((qty) =>
    evaluateForcedMinStep(unitLandedCostThb, qty, profile),
  );
  const first = steps.find((step) => step.meetsFloor);
  return {
    forcedMinQty: first?.qty ?? ladder[ladder.length - 1] ?? 1000,
    profile,
    unitLandedCostThb,
    steps,
  };
}

export function assertMeetsForcedMinQty(quantity: number, forcedMinQty: number): void {
  const qty = Math.floor(quantity);
  const min = Math.floor(forcedMinQty);
  if (!Number.isInteger(min) || min < 1) return;
  if (!Number.isInteger(qty) || qty < min) {
    throw new Error("qty_below_forced_min");
  }
}

export function unitLandedFromFactory(
  factoryUnitCny: number | null | undefined,
  factoryUnitUsd: number | null | undefined,
  explicitLandedThb: number | null | undefined,
  cnyToThb = 5,
): number | null {
  if (explicitLandedThb != null && Number.isFinite(explicitLandedThb) && explicitLandedThb > 0) {
    return explicitLandedThb;
  }
  if (factoryUnitUsd != null && Number.isFinite(factoryUnitUsd) && factoryUnitUsd > 0) {
    return factoryUsdToThb(factoryUnitUsd);
  }
  if (factoryUnitCny != null && Number.isFinite(factoryUnitCny) && factoryUnitCny > 0) {
    return factoryUnitCny * cnyToThb;
  }
  return null;
}
