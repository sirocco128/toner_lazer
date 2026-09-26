/**
 * SmartGift freight matrix (Guangzhou/Shenzhen + Yiwu rate cards).
 * Source: tenant pricing_rules_formula.yaml + LK CBM rate sheets.
 */

import type {
  FreightCategory,
  FreightMode,
  FreightOrigin,
  MembershipTier,
} from "@/lib/alibaba/types";

export type RateCell = { cbm: number; kg: number };

export const SMARTGIFT_FX_CNY_THB = 5;
/** Spec USD→THB used in catalog / forced-min-qty formulas. */
export const SMARTGIFT_FX_USD_THB = 32.5;
/**
 * Factory PO form fallback when the live market guide is unavailable.
 * Kept separate from the catalog formula rate above.
 */
export const FACTORY_MARKET_FX_USD_THB = 33;

export const DENSITY_THRESHOLD_KG_PER_CBM = 400;
export const MIN_CHARGEABLE_CBM = 0.01;
export const SEA_THRESHOLD_CBM = 5;
export const INLAND_CNY_PER_CBM = 150;
export const INLAND_MIN_CNY = 50;
export const PEAK_MONTHS = [9, 10, 11, 12, 1] as const;

export const SMALL_ORDER_FACTORS: { maxQty: number; sof: number }[] = [
  { maxQty: 20, sof: 1.5 },
  { maxQty: 50, sof: 1.4 },
  { maxQty: 100, sof: 1.3 },
  { maxQty: 300, sof: 1.2 },
  { maxQty: 499, sof: 1.1 },
  { maxQty: Number.POSITIVE_INFINITY, sof: 1.0 },
];

export const MARKUP_BANDS: { maxCostThb: number; markup: number }[] = [
  { maxCostThb: 250, markup: 3.0 },
  { maxCostThb: 350, markup: 2.73 },
  { maxCostThb: 500, markup: 2.62 },
  { maxCostThb: 650, markup: 2.45 },
  { maxCostThb: Number.POSITIVE_INFINITY, markup: 2.14 },
];

const MATRIX: Record<
  FreightOrigin,
  Record<FreightMode, Record<FreightCategory, Record<MembershipTier, RateCell>>>
> = {
  guangzhou_shenzhen: {
    truck: {
      general: {
        ELITE: { cbm: 5900, kg: 15 },
        GOLD: { cbm: 6400, kg: 16 },
        SILVER: { cbm: 6900, kg: 18 },
        MEMBER: { cbm: 7400, kg: 19 },
      },
      electronic_tisi: {
        ELITE: { cbm: 6400, kg: 16 },
        GOLD: { cbm: 6900, kg: 18 },
        SILVER: { cbm: 7400, kg: 19 },
        MEMBER: { cbm: 7900, kg: 20 },
      },
    },
    sea: {
      general: {
        ELITE: { cbm: 3900, kg: 10 },
        GOLD: { cbm: 4400, kg: 11 },
        SILVER: { cbm: 4900, kg: 13 },
        MEMBER: { cbm: 5400, kg: 14 },
      },
      electronic_tisi: {
        ELITE: { cbm: 4400, kg: 11 },
        GOLD: { cbm: 4900, kg: 13 },
        SILVER: { cbm: 5400, kg: 14 },
        MEMBER: { cbm: 5900, kg: 15 },
      },
    },
  },
  yiwu: {
    truck: {
      general: {
        ELITE: { cbm: 6400, kg: 16 },
        GOLD: { cbm: 6900, kg: 18 },
        SILVER: { cbm: 7400, kg: 19 },
        MEMBER: { cbm: 7900, kg: 20 },
      },
      electronic_tisi: {
        ELITE: { cbm: 6900, kg: 18 },
        GOLD: { cbm: 7400, kg: 19 },
        SILVER: { cbm: 7900, kg: 20 },
        MEMBER: { cbm: 8400, kg: 21 },
      },
    },
    sea: {
      general: {
        ELITE: { cbm: 3900, kg: 10 },
        GOLD: { cbm: 4400, kg: 11 },
        SILVER: { cbm: 4900, kg: 13 },
        MEMBER: { cbm: 5400, kg: 14 },
      },
      electronic_tisi: {
        ELITE: { cbm: 4400, kg: 11 },
        GOLD: { cbm: 4900, kg: 13 },
        SILVER: { cbm: 5400, kg: 14 },
        MEMBER: { cbm: 5900, kg: 15 },
      },
    },
  },
};

export function lookupRate(
  origin: FreightOrigin,
  mode: FreightMode,
  category: FreightCategory,
  tier: MembershipTier,
): RateCell {
  return MATRIX[origin][mode][category][tier];
}
