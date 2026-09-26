/**
 * Chargeable CBM / kg, membership tier, and China→TH freight (THB / shipment).
 */

import {
  DENSITY_THRESHOLD_KG_PER_CBM,
  MIN_CHARGEABLE_CBM,
  PEAK_MONTHS,
  SEA_THRESHOLD_CBM,
  lookupRate,
} from "@/lib/alibaba/rates";
import type {
  FreightCategory,
  FreightMode,
  FreightOrigin,
  LandedCostConfig,
  MembershipTier,
} from "@/lib/alibaba/types";

export function cbmFromCm(
  lengthCm?: number,
  widthCm?: number,
  heightCm?: number,
): number | null {
  if (
    !isPositive(lengthCm) ||
    !isPositive(widthCm) ||
    !isPositive(heightCm)
  ) {
    return null;
  }
  return (lengthCm * widthCm * heightCm) / 1_000_000;
}

export function shipmentTotals(
  qty: number,
  weightKg: number | undefined,
  unitCbm: number | null,
): { kg: number; cbm: number } | null {
  const safeQty = Math.max(1, Math.floor(qty));
  const hasWeight = isPositive(weightKg);
  const hasCbm = unitCbm !== null && unitCbm > 0;
  if (!hasWeight && !hasCbm) return null;

  const kg = hasWeight ? weightKg * safeQty : 0;
  const rawCbm = hasCbm ? unitCbm * safeQty : 0;
  return { kg, cbm: rawCbm };
}

export function membershipTier(cbm: number, kg: number): MembershipTier {
  if (cbm >= 10 || kg >= 3000) return "ELITE";
  if (cbm >= 5 || kg >= 1500) return "GOLD";
  if (cbm >= 1 || kg >= 300) return "SILVER";
  return "MEMBER";
}

export function selectFreightMode(
  shipmentCbm: number,
  config: Pick<LandedCostConfig, "month" | "forceMode" | "seaThresholdCbm">,
): FreightMode {
  if (config.forceMode) return config.forceMode;
  const month = clampMonth(config.month);
  if ((PEAK_MONTHS as readonly number[]).includes(month)) return "truck";
  const seaAt = config.seaThresholdCbm ?? SEA_THRESHOLD_CBM;
  return shipmentCbm >= seaAt ? "sea" : "truck";
}

/**
 * LK rule: density > 400 kg/CBM bills by kg; otherwise by CBM.
 * Minimum 0.01 CBM per shipment.
 */
export function internationalFreightThb(
  shipmentCbm: number,
  shipmentKg: number,
  origin: FreightOrigin,
  mode: FreightMode,
  category: FreightCategory,
  config: Pick<LandedCostConfig, "densityThresholdKgPerCbm" | "minChargeableCbm">,
): { thb: number; tier: MembershipTier; billedCbm: number } {
  const minCbm = config.minChargeableCbm ?? MIN_CHARGEABLE_CBM;
  const billedCbm = Math.max(shipmentCbm, minCbm);
  const kg = Math.max(0, shipmentKg);
  const tier = membershipTier(billedCbm, kg);
  const rate = lookupRate(origin, mode, category, tier);
  const threshold =
    config.densityThresholdKgPerCbm ?? DENSITY_THRESHOLD_KG_PER_CBM;
  const density = billedCbm > 0 ? kg / billedCbm : 0;
  const thb =
    density > threshold ? roundMoney(kg * rate.kg) : roundMoney(billedCbm * rate.cbm);
  return { thb, tier, billedCbm };
}

function isPositive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clampMonth(month: number): number {
  if (!Number.isFinite(month)) return new Date().getMonth() + 1;
  const n = Math.round(month);
  if (n < 1 || n > 12) return new Date().getMonth() + 1;
  return n;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
