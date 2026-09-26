/**
 * Partner catalog serializers — public-safe payloads for external BFF frontends.
 * Never leak factory CNY/ORI codes, MOQ, or (on browse) sell ladders.
 */

import type { Product } from "@/lib/data";
import { isUsableImageSrc, PRODUCT_IMAGE_FALLBACK } from "@/lib/product-media";
import type {
  PartnerCatalogProduct,
  PartnerCatalogPromotion,
  PartnerCatalogRetail,
} from "@/lib/partner-api-types";
import { getSiteConfig } from "@/lib/site";
import { listSkuFiles } from "@/lib/sku-files";
import {
  listClearanceSkus,
  listSkus,
} from "@/lib/sku-master-repository";
import { skuMasterTablesReady } from "@/lib/sku-master-schema";
import type { SkuRecord } from "@/lib/sku-master-types";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";
import { listSmartgiftOffers } from "@/lib/smartgift-products";

export function parseCatalogLimit(
  raw: string | null,
  fallback = 100,
  max = 500,
): number {
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

export function partnerCatalogSiteBase(): string {
  return getSiteConfig().url.replace(/\/+$/, "");
}

export function toAbsoluteMediaUrl(
  src: string,
  siteBase = partnerCatalogSiteBase(),
): string {
  const value = String(src || "").trim();
  if (!value) return `${siteBase}${PRODUCT_IMAGE_FALLBACK}`;
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${siteBase}${value}`;
  return `${siteBase}/${value}`;
}

/** Strip factory / supplier / price phrases from public copy. */
export function scrubPublicCatalogText(text: string): string {
  return String(text || "")
    .replace(/\(\s*P-\d+\s*\)/gi, "")
    .replace(/ซัพพลายเออร์\s+P-\d+/gi, "")
    .replace(/รหัส\s+[A-Za-z0-9_-]+/gi, "")
    .replace(/ราคาตามจำนวน[^—]*/gi, "")
    .replace(/ไม่ใช่ราคาชำระบนเว็บ/gi, "")
    .replace(/\s*—\s*(?:—\s*)+/g, " — ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s—·]+|[\s—·]+$/g, "")
    .trim();
}

export function serializePartnerCatalogProduct(
  product: Product,
  siteBase = partnerCatalogSiteBase(),
): PartnerCatalogProduct {
  const offerCode = String(product.productId || product.slug || "").trim();
  const images = (product.images || [])
    .filter((src) => isUsableImageSrc(src))
    .map((src) => toAbsoluteMediaUrl(src, siteBase));
  if (images.length === 0) {
    images.push(toAbsoluteMediaUrl(PRODUCT_IMAGE_FALLBACK, siteBase));
  }
  return {
    offerCode,
    slug: product.slug,
    name: scrubPublicCatalogText(product.name),
    description: scrubPublicCatalogText(product.description),
    material: scrubPublicCatalogText(product.material),
    categorySlug: product.categorySlug,
    categoryName: product.categoryName?.trim() || null,
    images,
    leadDays:
      product.leadDays == null || !Number.isFinite(product.leadDays)
        ? null
        : Number(product.leadDays),
    components: (product.components || []).map((item) => ({
      name: scrubPublicCatalogText(item.name),
      qty: Math.max(1, Math.round(item.qty || 1)),
    })),
  };
}

function assertNoSensitiveProductFields(payload: PartnerCatalogProduct): void {
  const json = JSON.stringify(payload);
  if (
    /"minOrder"|"priceMin"|"priceMax"|"priceRange"|factoryUnit|oriProduct|supplier/i.test(
      json,
    )
  ) {
    throw new Error("partner_catalog_leak");
  }
}

export async function listPartnerCatalogProducts(options: {
  q?: string | null;
  category?: string | null;
  limit?: number;
}): Promise<PartnerCatalogProduct[]> {
  if (!isSmartgiftMysqlEnabled()) {
    throw new Error("catalog unavailable");
  }
  const limit = options.limit ?? 100;
  const products = await listSmartgiftOffers({
    pricedOnly: false,
    limit,
    q: options.q?.trim() || undefined,
    categorySlug: options.category?.trim() || undefined,
  });
  const siteBase = partnerCatalogSiteBase();
  return products.map((product) => {
    const row = serializePartnerCatalogProduct(product, siteBase);
    assertNoSensitiveProductFields(row);
    return row;
  });
}

export async function collectSkuImages(
  sku: SkuRecord,
  siteBase = partnerCatalogSiteBase(),
): Promise<string[]> {
  const urls: string[] = [];
  const push = (src: string | null | undefined) => {
    if (!isUsableImageSrc(src)) return;
    const abs = toAbsoluteMediaUrl(String(src).trim(), siteBase);
    if (!urls.includes(abs)) urls.push(abs);
  };

  push(sku.imageUrl);
  try {
    const files = await listSkuFiles({ productId: sku.productId });
    for (const file of files) {
      if (file.fileKind === "photo") push(file.servePath);
    }
  } catch {
    /* photos optional when MinIO/schema missing */
  }
  if (urls.length === 0 && isUsableImageSrc(sku.displayImageUrl)) {
    push(sku.displayImageUrl);
  }
  if (urls.length === 0) {
    push(PRODUCT_IMAGE_FALLBACK);
  }
  return urls;
}

function skuSlug(sku: SkuRecord): string {
  return (sku.catalogSlug || sku.productId).trim().toLowerCase();
}

export function serializePartnerCatalogPromotion(
  sku: SkuRecord,
  images: string[],
): PartnerCatalogPromotion {
  return {
    productId: sku.productId,
    slug: skuSlug(sku),
    nameTh: sku.nameTh,
    nameEn: sku.nameEn,
    stockClass: sku.stockClass,
    isBundle: sku.isBundle,
    colorNameTh: sku.colorNameTh,
    clearanceReason: sku.clearanceReason,
    tags: [...sku.tags],
    onHandQty: Math.max(0, Math.floor(sku.onHandQty || 0)),
    images,
  };
}

export function serializePartnerCatalogRetail(
  sku: SkuRecord,
  images: string[],
): PartnerCatalogRetail {
  const sell = sku.sellPriceThb;
  if (sell == null || !(sell > 0)) {
    throw new Error("retail_requires_price");
  }
  return {
    productId: sku.productId,
    slug: skuSlug(sku),
    nameTh: sku.nameTh,
    nameEn: sku.nameEn,
    stockClass: sku.stockClass,
    isBundle: sku.isBundle,
    colorNameTh: sku.colorNameTh,
    sellPriceThb: sell,
    currency: "THB",
    onHandQty: Math.max(0, Math.floor(sku.onHandQty || 0)),
    images,
  };
}

export async function listPartnerCatalogPromotions(options: {
  limit?: number;
}): Promise<PartnerCatalogPromotion[]> {
  if (!(await skuMasterTablesReady())) {
    throw new Error("catalog unavailable");
  }
  const limit = options.limit ?? 100;
  const fetchCap = Math.min(Math.max(limit * 2, limit), 2000);
  const [clearance, promoTagged] = await Promise.all([
    listClearanceSkus(fetchCap),
    listSkus({ tag: "promo", limit: fetchCap }),
  ]);
  const byId = new Map<string, SkuRecord>();
  for (const sku of [...clearance, ...promoTagged]) {
    if (!byId.has(sku.productId)) byId.set(sku.productId, sku);
  }
  const merged = [...byId.values()].slice(0, limit);
  const siteBase = partnerCatalogSiteBase();
  const rows: PartnerCatalogPromotion[] = [];
  for (const sku of merged) {
    const images = await collectSkuImages(sku, siteBase);
    rows.push(serializePartnerCatalogPromotion(sku, images));
  }
  return rows;
}

export async function listPartnerCatalogRetail(options: {
  q?: string | null;
  limit?: number;
}): Promise<PartnerCatalogRetail[]> {
  if (!(await skuMasterTablesReady())) {
    throw new Error("catalog unavailable");
  }
  const limit = options.limit ?? 100;
  const fetchCap = Math.min(Math.max(limit * 4, limit), 2000);
  const candidates = await listSkus({
    q: options.q?.trim() || undefined,
    limit: fetchCap,
  });
  const priced = candidates
    .filter((sku) => sku.sellPriceThb != null && sku.sellPriceThb > 0)
    .slice(0, limit);
  const siteBase = partnerCatalogSiteBase();
  const rows: PartnerCatalogRetail[] = [];
  for (const sku of priced) {
    const images = await collectSkuImages(sku, siteBase);
    rows.push(serializePartnerCatalogRetail(sku, images));
  }
  return rows;
}
