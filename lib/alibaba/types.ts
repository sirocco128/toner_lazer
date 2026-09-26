/**
 * Normalized 1688 / SmartGift offer used to estimate THB catalog prices.
 * Factory CNY and freight internals stay off the public Product type.
 */

export type FreightOrigin = "guangzhou_shenzhen" | "yiwu";
export type FreightMode = "truck" | "sea";
export type FreightCategory = "general" | "electronic_tisi";
export type MembershipTier = "ELITE" | "GOLD" | "SILVER" | "MEMBER";

export type OfferLadder = {
  minQty: number;
  priceCny: number;
};

export type AlibabaOffer = {
  /** Catalog slug to match Strapi / mock product. */
  slug: string;
  offerId: string;
  origin?: FreightOrigin;
  category?: FreightCategory;
  minOrder: number;
  /** Lowest factory unit price (CNY), typically bulk ladder. */
  factoryMinCny: number;
  /** Highest factory unit price (CNY), typically MOQ ladder. */
  factoryMaxCny: number;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  imageUrls?: string[];
  /** Override inland CN freight (CNY / shipment). */
  inlandFreightCny?: number;
  /** Optional qty used for the cheap end of the public band. */
  bulkQty?: number;
  ladders?: OfferLadder[];
};

export type LandedCostConfig = {
  cnyToThb: number;
  densityThresholdKgPerCbm: number;
  minChargeableCbm: number;
  seaThresholdCbm: number;
  inlandRateCnyPerCbm: number;
  inlandMinCny: number;
  /** 1–12; peak months force truck. */
  month: number;
  forceMode?: FreightMode;
};

export type PublicPriceRange = {
  priceMin: number;
  priceMax: number;
  priceExFreightMin: number;
  priceExFreightMax: number;
  packagingMin: number;
  packagingMax: number;
  priceRange: string;
  minOrder: number;
  currency: "THB";
};

export type UnitLandedBreakdown = {
  qty: number;
  factoryThb: number;
  inlandThb: number;
  freightThb: number;
  landedCostThb: number;
  sof: number;
  markup: number;
  sellThb: number;
  sellExFreightThb: number;
  mode: FreightMode;
  tier: MembershipTier;
  shipmentCbm: number;
  shipmentKg: number;
};
