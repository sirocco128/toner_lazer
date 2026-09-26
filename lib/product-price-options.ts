/**
 * Client-safe product price toggles: China freight + packaging-in-set.
 * Catalog priceMin/Max already include China freight and exclude Thai packaging.
 */

export const DEFAULT_PACKAGING_MIN_THB = 45;
export const DEFAULT_PACKAGING_MAX_THB = 85;

export type ProductPriceBand = {
  priceMin: number;
  priceMax: number;
  priceExFreightMin?: number;
  priceExFreightMax?: number;
  packagingMin?: number;
  packagingMax?: number;
};

export type ProductPriceOptionFlags = {
  includeFreight: boolean;
  includePackaging: boolean;
};

export function canToggleChinaFreight(band: ProductPriceBand): boolean {
  return (
    isPositiveInt(band.priceExFreightMin) &&
    isPositiveInt(band.priceExFreightMax) &&
    band.priceExFreightMin <= band.priceMin &&
    band.priceExFreightMax <= band.priceMax &&
    (band.priceExFreightMin < band.priceMin ||
      band.priceExFreightMax < band.priceMax)
  );
}

export function applyProductPriceOptions(
  band: ProductPriceBand,
  flags: ProductPriceOptionFlags,
): { priceMin: number; priceMax: number; priceRange: string } {
  const useFreightSplit = canToggleChinaFreight(band);
  let min = band.priceMin;
  let max = band.priceMax;

  if (!flags.includeFreight && useFreightSplit) {
    min = band.priceExFreightMin as number;
    max = band.priceExFreightMax as number;
  }

  if (flags.includePackaging) {
    min += band.packagingMin ?? DEFAULT_PACKAGING_MIN_THB;
    max += band.packagingMax ?? DEFAULT_PACKAGING_MAX_THB;
  }

  min = Math.round(min);
  max = Math.round(max);
  if (max < min) max = min;

  return {
    priceMin: min,
    priceMax: max,
    priceRange: `${min}–${max} บาท/ชุด`,
  };
}

function isPositiveInt(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
