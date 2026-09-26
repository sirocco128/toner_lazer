import type { Product } from "@/lib/data";
import { isUsableImageSrc } from "@/lib/product-media";
import { parseProductId } from "@/lib/sku-master-ids";
import {
  getSku,
  listClearanceSkus,
  listSkusByCatalogSlugs,
} from "@/lib/sku-master-repository";
import { skuMasterTablesReady } from "@/lib/sku-master-schema";
import type { SkuRecord } from "@/lib/sku-master-types";

function applySku(product: Product, sku: SkuRecord): Product {
  const minOrder =
    sku.forcedMinQty && sku.forcedMinQty > product.minOrder
      ? sku.forcedMinQty
      : product.minOrder;
  const isClearance = sku.stockClass === "C";
  let priceMin = product.priceMin;
  let priceMax = product.priceMax;
  let priceRange = product.priceRange;
  if (isClearance && sku.sellPriceThb != null && sku.sellPriceThb > 0) {
    priceMin = sku.sellPriceThb;
    priceMax = sku.sellPriceThb;
    priceRange = `${sku.sellPriceThb.toLocaleString("th-TH")} บาท`;
  }
  const colors = sku.colorNameTh
    ? [{ name: sku.colorNameTh, hex: null }]
    : product.colors;
  const images =
    sku.imageUrl && isUsableImageSrc(sku.imageUrl)
      ? [sku.imageUrl, ...product.images.filter((src) => src !== sku.imageUrl)]
      : product.images;
  return {
    ...product,
    productId: sku.productId,
    stockClass: sku.stockClass,
    isBundle: sku.isBundle,
    isClearance,
    clearanceReason: sku.clearanceReason || undefined,
    minOrder,
    priceMin,
    priceMax,
    priceRange,
    colors,
    images,
  };
}

function skuAsProduct(sku: SkuRecord): Product {
  const slug = sku.catalogSlug || sku.productId.toLowerCase();
  return applySku(
    {
      name: sku.nameTh,
      slug,
      description: sku.clearanceReason
        ? `สินค้าเคลียร์: ${sku.clearanceReason}`
        : sku.isBundle
          ? `${sku.nameTh} — ราคาเป็นราคาชุด ไม่แยกราคาชิ้น`
          : sku.nameTh,
      material: sku.stockClass === "C" ? "เคลียร์สต็อก" : "ชุดของขวัญองค์กร",
      minOrder: sku.forcedMinQty || 1,
      priceRange:
        sku.sellPriceThb != null
          ? `${sku.sellPriceThb.toLocaleString("th-TH")} บาท`
          : "สอบถามราคา",
      priceMin: sku.sellPriceThb || 0,
      priceMax: sku.sellPriceThb || 0,
      currency: "THB",
      images: [sku.displayImageUrl],
      categorySlug: "custom",
      seo: {
        seoTitle: sku.nameTh.slice(0, 60),
        metaDescription: (sku.clearanceReason || sku.nameTh).slice(0, 155),
        canonicalPath: `/products/${slug}`,
      },
    },
    sku,
  );
}

export async function getCatalogProductFromSkuSlug(
  slug: string,
): Promise<Product | null> {
  const parsed = parseProductId(slug);
  if (!parsed) return null;
  try {
    if (!(await skuMasterTablesReady())) return null;
    const sku = await getSku(slug);
    return sku ? skuAsProduct(sku) : null;
  } catch {
    return null;
  }
}

export async function overlaySkuOnProducts(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;
  try {
    if (!(await skuMasterTablesReady())) return products;
    const bySlug = await listSkusByCatalogSlugs(products.map((item) => item.slug));
    const mapped = products.map((product) => {
      const sku = bySlug.get(product.slug);
      return sku ? applySku(product, sku) : product;
    });
    const clearance = await listClearanceSkus(80);
    const existing = new Set(mapped.map((item) => item.slug));
    for (const sku of clearance) {
      const slug = sku.catalogSlug || sku.productId.toLowerCase();
      if (existing.has(slug)) continue;
      existing.add(slug);
      mapped.push(skuAsProduct(sku));
    }
    return mapped;
  } catch {
    return products;
  }
}
