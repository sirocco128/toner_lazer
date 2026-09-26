import { extractOfferImages } from "@/lib/alibaba/images";
import { computePublicPriceRange, defaultLandedCostConfig } from "@/lib/alibaba/landed-cost";
import type { AlibabaOffer } from "@/lib/alibaba/types";
import type { Product } from "@/lib/data";

export function alibabaEstimatesEnabled(): boolean {
  return process.env.ALIBABA_ESTIMATES_ENABLED === "true";
}

export function alibabaPublicImagesEnabled(): boolean {
  return (
    process.env.ALIBABA_PUBLIC_IMAGES === "true" &&
    process.env.ALIBABA_IMAGES_LICENSED === "true"
  );
}

export function overlayOfferOnProduct(
  product: Product,
  offer: AlibabaOffer | undefined,
  options?: { applyImages?: boolean; remoteImageUrls?: string },
): Product {
  if (!offer) return product;
  const range = computePublicPriceRange(offer, defaultLandedCostConfig());
  if (!range) return product;

  const next: Product = {
    ...product,
    priceMin: range.priceMin,
    priceMax: range.priceMax,
    priceRange: range.priceRange,
    minOrder: range.minOrder,
    priceExFreightMin: range.priceExFreightMin,
    priceExFreightMax: range.priceExFreightMax,
    packagingMin: range.packagingMin,
    packagingMax: range.packagingMax,
  };

  const applyImages = options?.applyImages ?? alibabaPublicImagesEnabled();
  if (!applyImages) return next;

  const allow = new Set(
    (options?.remoteImageUrls ?? process.env.NEXT_IMAGE_REMOTE_URLS ?? "")
      .split(",")
      .map((part) => {
        try {
          return new URL(part.trim()).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );

  const extra = extractOfferImages(offer.imageUrls).filter((url) => {
    try {
      return allow.has(new URL(url).origin);
    } catch {
      return false;
    }
  });

  if (extra.length === 0) return next;
  const merged = [...product.images];
  for (const url of extra) {
    if (!merged.includes(url)) merged.push(url);
  }
  return { ...next, images: merged };
}

export function overlayOffersOnProducts(
  products: Product[],
  offers: AlibabaOffer[],
  options?: { applyImages?: boolean; remoteImageUrls?: string },
): Product[] {
  if (!alibabaEstimatesEnabled() || offers.length === 0) return products;
  const bySlug = new Map(offers.map((offer) => [offer.slug, offer]));
  return products.map((product) =>
    overlayOfferOnProduct(product, bySlug.get(product.slug), options),
  );
}
