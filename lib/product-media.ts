/**
 * Public catalog image helpers — never invent product photos.
 * Empty or broken URLs fall back to licensed placeholders in /public/images.
 */

export const PRODUCT_IMAGE_FALLBACK = "/images/product-placeholder.jpg";

const CATEGORY_COVER_FALLBACK: Record<string, string> = {
  "tumbler-set": "/images/category-tumbler.jpg",
  "eco-giftset": "/images/category-eco.jpg",
  "it-set": "/images/product-it-set.jpg",
  "team-building-set": "/images/category-team.jpg",
  "eco-friendly": "/images/product-eco-set.jpg",
  "classic-oriental": "/images/category-team.jpg",
  "novelty-self-care": "/images/product-tumbler-set.jpg",
  "executive-smart-tech": "/images/product-it-set.jpg",
  "gift-set": "/images/hero-giftset.jpg",
  drinkware: "/images/category-tumbler.jpg",
  technology: "/images/product-it-set.jpg",
  wellness: "/images/product-tumbler-set.jpg",
  bag: "/images/category-bags.jpg",
  bags: "/images/category-bags.jpg",
  eco: "/images/category-eco.jpg",
  lifestyle: "/images/category-lifestyle.jpg",
  apparel: "/images/category-apparel.jpg",
  campaign: "/images/category-campaign.jpg",
  packaging: "/images/category-packaging.jpg",
  seasonal: "/images/hero-giftset.jpg",
  custom: "/images/category-custom.jpg",
  office: "/images/mockup-notebook.jpg",
};

export function isUsableImageSrc(src: string | null | undefined): boolean {
  const value = String(src || "").trim();
  if (!value) return false;
  if (value === "#" || value === "/" || value === "null" || value === "undefined") {
    return false;
  }
  return true;
}

/** Ops SKU thumbs: real URL or licensed placeholder — never invent a product photo. */
export function skuOpsImageSrc(
  ...candidates: Array<string | null | undefined>
): string {
  for (const src of candidates) {
    if (isUsableImageSrc(src)) return String(src).trim();
  }
  return PRODUCT_IMAGE_FALLBACK;
}

export function productCoverImage(
  images: string[] | null | undefined,
  categorySlug?: string | null,
): string {
  const found = (images || []).find((src) => isUsableImageSrc(src));
  if (found) return found.trim();
  const byCategory = categorySlug ? CATEGORY_COVER_FALLBACK[categorySlug] : undefined;
  return byCategory || PRODUCT_IMAGE_FALLBACK;
}

const SHORT_CATEGORY_TABS: Record<string, string> = {
  "eco-giftset": "รักษ์โลก",
  "it-set": "ไอที",
  "tumbler-set": "แก้ว/กระบอก",
  "team-building-set": "ออฟฟิศ",
  "eco-friendly": "รักษ์โลก",
  "classic-oriental": "ตะวันออก",
  "novelty-self-care": "Wellness",
  "executive-smart-tech": "Smart Tech",
  "gift-set": "ชุดของขวัญ",
  drinkware: "แก้ว/กระบอก",
  technology: "ไอที",
  wellness: "เวลเนส",
  office: "ออฟฟิศ",
  bag: "กระเป๋า",
  bags: "กระเป๋า",
  eco: "รักษ์โลก",
  lifestyle: "ชีวิตประจำวัน",
  apparel: "เสื้อผ้า",
  campaign: "แคมเปญ",
  packaging: "บรรจุภัณฑ์",
  seasonal: "ตามฤดูกาล",
  custom: "สั่งผลิต",
  clearance: "เคลียร์",
};

export function categoryTabLabel(slug: string, name: string): string {
  return SHORT_CATEGORY_TABS[slug] || name;
}
