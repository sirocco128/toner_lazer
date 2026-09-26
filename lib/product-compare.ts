import type { Product } from "@/lib/data";
import { decorationOptionsForProduct } from "@/lib/product-decoration";
import { STOCK_CLASS_LABELS, type StockClass } from "@/lib/sku-master-types";

export const COMPARE_STORAGE_KEY = "smartgift:compare:v1";
export const COMPARE_EVENT = "smartgift:compare-changed";
export const COMPARE_LIMIT = 3;

export type ProductCompareItem = {
  slug: string;
  name: string;
  sku: string;
  category: string;
  image: string;
  material: string;
  capacity: string;
  dimensions: string;
  minOrder: number;
  priceRange: string;
  leadDays: number | null;
  stockStatus: string;
  customization: string;
  components: string;
};

export function stockStatusForProduct(product: Pick<
  Product,
  "stockClass" | "isClearance"
>): string {
  if (product.isClearance) return "เคลียร์สต็อก — จำนวนจำกัด";
  if (product.stockClass && product.stockClass in STOCK_CLASS_LABELS) {
    return STOCK_CLASS_LABELS[product.stockClass as StockClass];
  }
  return "สั่งผลิตตามออเดอร์ · ไม่ใช่ของพร้อมส่ง";
}

export function toCompareItem(
  product: Pick<
    Product,
    | "slug"
    | "name"
    | "productId"
    | "categoryName"
    | "categorySlug"
    | "images"
    | "material"
    | "capacity"
    | "dimensions"
    | "minOrder"
    | "priceRange"
    | "leadDays"
    | "components"
    | "stockClass"
    | "isClearance"
  >,
): ProductCompareItem {
  const customization = decorationOptionsForProduct(product.slug)
    .map((item) => item.label)
    .join(" · ");
  return {
    slug: product.slug,
    name: product.name,
    sku: product.productId || product.slug,
    category: product.categoryName || product.categorySlug,
    image: product.images[0] || "",
    material: product.material || "—",
    capacity: product.capacity || "—",
    dimensions: product.dimensions || "—",
    minOrder: product.minOrder,
    priceRange: product.priceRange || "สอบถามราคา",
    leadDays: product.leadDays ?? null,
    stockStatus: stockStatusForProduct(product),
    customization: customization || "สกรีน · พิมพ์ UV · เลเซอร์ · ปัก",
    components:
      product.components && product.components.length > 0
        ? product.components
            .map((item) => `${item.name}${item.qty > 1 ? ` ×${item.qty}` : ""}`)
            .join(" · ")
        : "—",
  };
}

export function loadCompareList(): ProductCompareItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object" && typeof item.slug === "string")
      .slice(0, COMPARE_LIMIT) as ProductCompareItem[];
  } catch {
    return [];
  }
}

export function saveCompareList(items: ProductCompareItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify(items.slice(0, COMPARE_LIMIT)),
    );
  } catch {
    /* private mode */
  }
}

export function toggleCompareItem(
  list: ProductCompareItem[],
  item: ProductCompareItem,
): { list: ProductCompareItem[]; added: boolean; atLimit: boolean } {
  const exists = list.some((row) => row.slug === item.slug);
  if (exists) {
    return {
      list: list.filter((row) => row.slug !== item.slug),
      added: false,
      atLimit: false,
    };
  }
  if (list.length >= COMPARE_LIMIT) {
    return { list, added: false, atLimit: true };
  }
  return { list: [...list, item], added: true, atLimit: false };
}

export function catalogHrefForProduct(slug: string): string {
  return `/catalog?product=${encodeURIComponent(slug)}#flipbook`;
}

export function quoteHrefForProduct(slug: string, name: string): string {
  const params = new URLSearchParams({
    quote: "1",
    productSlug: slug,
    productInterest: name,
  });
  return `/contact?${params.toString()}`;
}
