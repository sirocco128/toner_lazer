import {
  SMART_GIFT_CATEGORIES,
  type SmartGiftCategory,
} from "@/lib/smart-gift-method";
import { canonicalCategorySlug } from "@/lib/smartgift-products";

export type CatalogGroupProduct = {
  slug: string;
  categorySlug: string;
};

export function resolveCatalogGroup(slug: string): SmartGiftCategory | null {
  const raw = slug.trim().toLowerCase();
  if (!raw || raw === "clearance") return null;
  const canonical = canonicalCategorySlug(raw);
  return (
    SMART_GIFT_CATEGORIES.find((item) => item.slug === raw) ??
    SMART_GIFT_CATEGORIES.find((item) => item.slug === canonical) ??
    SMART_GIFT_CATEGORIES.find(
      (item) =>
        item.categorySlugs.includes(raw) || item.categorySlugs.includes(canonical),
    ) ??
    null
  );
}

export function productMatchesCatalogGroup(
  product: CatalogGroupProduct,
  group: SmartGiftCategory,
): boolean {
  if (group.productSlugs.includes(product.slug)) return true;
  const raw = product.categorySlug.trim().toLowerCase();
  const canonical = canonicalCategorySlug(raw);
  return (
    group.slug === raw ||
    group.slug === canonical ||
    group.categorySlugs.includes(raw) ||
    group.categorySlugs.includes(canonical)
  );
}

export function catalogGroupQuoteHref(group: SmartGiftCategory): string {
  const params = new URLSearchParams({
    product: group.title,
    note: `สนใจหมวด${group.title} (${group.points.join(" ")})`,
  });
  return `/contact?${params.toString()}`;
}

export function catalogGroupExtraLinks(
  group: SmartGiftCategory,
): Array<{ href: string; label: string }> {
  if (group.slug === "seasonal") {
    return [{ href: "/ideas", label: "ดูไอเดียตามเทศกาล" }];
  }
  if (group.slug === "custom" || group.slug === "packaging") {
    return [{ href: "/customize-gift-set", label: "บอกรายละเอียดงานที่ต้องการผลิต" }];
  }
  if (group.slug === "gift-set") {
    return [{ href: "/premium-giftset", label: "ดูวิธีทำชุดของขวัญ" }];
  }
  return [];
}
