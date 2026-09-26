/**
 * Map NextERP MySQL products/categories → public catalog types.
 */

import type { RowDataPacket } from "mysql2/promise";
import type { Category, Product } from "@/lib/data";
import { nexterpQuery } from "@/lib/nexterp-mysql";

export type NexterpProductRow = RowDataPacket & {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number | null;
  category_code: string | null;
  category_name_th: string | null;
  category_raw: string | null;
  uom: string;
  sell_price: number | string | null;
  is_active: number;
};

export type NexterpCategoryRow = RowDataPacket & {
  id: number;
  code: string;
  name_th: string;
  name_en: string | null;
  product_count: number;
};

const CATEGORY_CODE_TO_SLUG: Record<string, string> = {
  GIFT_SET: "tumbler-set",
  ECO: "eco-giftset",
  FLASH_DRIVE: "it-set",
  FLASH_DRIVE_CARD: "it-set",
  PACKAGING: "team-building-set",
  ALCOHOL: "team-building-set",
  OTHER: "team-building-set",
  SHIPPING: "team-building-set",
  UNCATEGORIZED: "tumbler-set",
};

const CATEGORY_IMAGE: Record<string, string> = {
  "eco-giftset": "/images/category-eco.jpg",
  "team-building-set": "/images/category-team.jpg",
  "tumbler-set": "/images/category-tumbler.jpg",
  "it-set": "/images/category-it.jpg",
};

const PRODUCT_IMAGE_BY_CATEGORY: Record<string, string> = {
  "eco-giftset": "/images/product-eco.jpg",
  "team-building-set": "/images/product-placeholder.jpg",
  "tumbler-set": "/images/product-tumbler.jpg",
  "it-set": "/images/product-it.jpg",
};

export function skuToSlug(sku: string): string {
  const base = sku
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return base || "product";
}

export function categoryCodeToSlug(code: string | null | undefined): string {
  if (!code) return "tumbler-set";
  return CATEGORY_CODE_TO_SLUG[code.toUpperCase()] || "tumbler-set";
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatPriceRange(min: number, max: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("th-TH", {
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  if (Math.abs(min - max) < 0.01) return `${fmt(min)} บาท`;
  return `${fmt(min)}–${fmt(max)} บาท`;
}

function looksLikeTumblerSet(name: string): boolean {
  return /กระบอก|แก้ว|tumbler|bottle|น้ำ|สมุด|ปากกา/i.test(name);
}

export function adaptNexterpProduct(row: NexterpProductRow): Product {
  const slug = skuToSlug(row.sku);
  const categorySlug = categoryCodeToSlug(row.category_code);
  const sell = toNumber(row.sell_price);
  const priceMin = sell != null ? Math.max(1, Math.round(sell * 0.95)) : 0;
  const priceMax = sell != null ? Math.round(sell * 1.08) : 0;
  const description =
    (row.description || "").trim() ||
    `${row.name} (รหัส ${row.sku}) — สินค้าจากระบบคลัง Smart Gift สั่งผลิต/สกรีนโลโก้ได้ตามออเดอร์`;

  const enableCustomDesign =
    categorySlug === "tumbler-set" && looksLikeTumblerSet(row.name);

  return {
    name: row.name,
    slug,
    description,
    material: row.uom ? `หน่วย: ${row.uom}` : "ตามสเปคโรงงาน",
    minOrder: categorySlug === "gift-set" || categorySlug === "tumbler-set" ? 30 : 30,
    priceRange:
      sell != null
        ? formatPriceRange(priceMin, priceMax)
        : "สอบถามราคา / ขอใบเสนอราคา",
    priceMin: sell != null ? priceMin : 0,
    priceMax: sell != null ? priceMax : 0,
    currency: "THB",
    images: [PRODUCT_IMAGE_BY_CATEGORY[categorySlug] || "/images/product-placeholder.jpg"],
    categorySlug,
    enableCustomDesign,
    customDesignPreset: enableCustomDesign ? "tumbler_set" : "product_photo",
    seo: {
      seoTitle: row.name.slice(0, 60),
      metaDescription: description.slice(0, 155),
      canonicalPath: `/products/${slug}`,
      ogImage:
        PRODUCT_IMAGE_BY_CATEGORY[categorySlug] || "/images/product-placeholder.jpg",
    },
  };
}

export function adaptNexterpCategory(row: NexterpCategoryRow): Category {
  const slug = categoryCodeToSlug(row.code);
  const heroImage = CATEGORY_IMAGE[slug] || "/images/category-tumbler.jpg";
  return {
    name: row.name_th,
    slug,
    description: `${row.name_th} จากคลังสินค้า Smart Gift (${row.product_count} รายการ) — สั่งผลิตและสกรีนโลโก้ได้`,
    heroImage,
    seo: {
      seoTitle: row.name_th,
      metaDescription: `เลือก${row.name_th} สกรีนโลโก้ สั่งผลิตตามออเดอร์ จากคลัง Smart Gift`,
      canonicalPath: `/giftset/${slug}`,
      ogImage: heroImage,
    },
  };
}

export async function listNexterpCategories(): Promise<Category[]> {
  const rows = await nexterpQuery<NexterpCategoryRow[]>(
    `SELECT c.id, c.code, c.name_th, c.name_en,
            COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
     GROUP BY c.id, c.code, c.name_th, c.name_en
     HAVING product_count > 0
     ORDER BY product_count DESC, c.name_th ASC`,
  );

  // Collapse ERP codes that map to the same public slug.
  const bySlug = new Map<string, Category>();
  for (const row of rows) {
    const adapted = adaptNexterpCategory(row);
    const existing = bySlug.get(adapted.slug);
    if (!existing) {
      bySlug.set(adapted.slug, adapted);
      continue;
    }
    bySlug.set(adapted.slug, {
      ...existing,
      description: `${existing.name} / ${adapted.name} จากคลัง Smart Gift`,
    });
  }
  return [...bySlug.values()];
}

export async function listNexterpProducts(options?: {
  limit?: number;
  offset?: number;
  categoryCode?: string;
  q?: string;
}): Promise<Product[]> {
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 500);
  const offset = Math.max(options?.offset ?? 0, 0);
  const params: Record<string, unknown> = {};

  let where = "WHERE p.is_active = 1";
  if (options?.categoryCode) {
    where += " AND c.code = :categoryCode";
    params.categoryCode = options.categoryCode;
  }
  if (options?.q?.trim()) {
    where += " AND (p.name LIKE :q OR p.sku LIKE :q)";
    params.q = `%${options.q.trim()}%`;
  }

  const rows = await nexterpQuery<NexterpProductRow[]>(
    `SELECT p.id, p.sku, p.name, p.description, p.category_id, p.category_raw,
            p.uom, p.sell_price, p.is_active,
            c.code AS category_code, c.name_th AS category_name_th
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${where}
     ORDER BY
       (p.sell_price IS NULL) ASC,
       p.sell_price ASC,
       p.name ASC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  return rows.map(adaptNexterpProduct);
}

export async function getNexterpProductBySlug(
  slug: string,
): Promise<Product | null> {
  const wanted = skuToSlug(slug);
  // Prefer exact SKU match when slug still looks like sku-ish
  const rows = await nexterpQuery<NexterpProductRow[]>(
    `SELECT p.id, p.sku, p.name, p.description, p.category_id, p.category_raw,
            p.uom, p.sell_price, p.is_active,
            c.code AS category_code, c.name_th AS category_name_th
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1
     ORDER BY p.id ASC
     LIMIT 2000`,
  );
  const found = rows.find((row) => skuToSlug(row.sku) === wanted);
  return found ? adaptNexterpProduct(found) : null;
}

export async function listNexterpSubstitutes(sku: string): Promise<
  Array<{
    sku: string;
    name: string;
    sellPrice: number | null;
    relationType: string;
    priority: number;
  }>
> {
  const rows = await nexterpQuery<
    Array<
      RowDataPacket & {
        related_sku: string;
        related_name: string;
        related_sell_price: number | string | null;
        relation_type: string;
        priority: number;
      }
    >
  >(
    `SELECT s.related_sku, r.name AS related_name, r.sell_price AS related_sell_price,
            s.relation_type, s.priority
     FROM product_substitutes s
     JOIN products r ON r.sku = s.related_sku
     WHERE s.product_sku = :sku
       AND s.is_active = 1
       AND r.is_active = 1
     ORDER BY s.priority ASC, s.score DESC
     LIMIT 20`,
    { sku },
  );

  return rows.map((row) => ({
    sku: row.related_sku,
    name: row.related_name,
    sellPrice: toNumber(row.related_sell_price),
    relationType: row.relation_type,
    priority: row.priority,
  }));
}
