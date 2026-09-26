/**
 * Map SmartGift MySQL offers → public catalog Product / Category.
 */

import type { RowDataPacket } from "mysql2/promise";
import type { Category, Product } from "@/lib/data";
import { smartgiftQuery } from "@/lib/smartgift-mysql";

export type SmartgiftOfferRow = RowDataPacket & {
  offer_code: string;
  name: string;
  gift_tier: string | null;
  supplier_code: string | null;
  interest_theme: string | null;
  interest_theme_slug: string | null;
  unboxing_experience: string | null;
  image_url: string | null;
  source_slug: string | null;
  lead_days: number | string | null;
  product_family: string | null;
  has_price: number;
  catalog_match_status: string | null;
  min_order: number | string | null;
  price_min: number | string | null;
  price_max: number | string | null;
};

export type SmartgiftCategoryRow = RowDataPacket & {
  slug: string;
  name_th: string;
  name_en: string | null;
  vibe: string | null;
  target_recipient: string | null;
  offer_count: number;
};

export type SmartgiftItemRow = RowDataPacket & {
  offer_code: string;
  product_code: string;
  qty: number;
  name_th: string | null;
};

const CATEGORY_IMAGE: Record<string, string> = {
  "eco-friendly": "/images/category-eco.jpg",
  "classic-oriental": "/images/category-team.jpg",
  "novelty-self-care": "/images/category-tumbler.jpg",
  "executive-smart-tech": "/images/category-it.jpg",
  "gift-set": "/images/category-tumbler.jpg",
  drinkware: "/images/category-tumbler.jpg",
  technology: "/images/category-it.jpg",
  wellness: "/images/category-tumbler.jpg",
  office: "/images/category-team.jpg",
  bag: "/images/category-eco.jpg",
  eco: "/images/category-eco.jpg",
  custom: "/images/category-team.jpg",
};

const PRODUCT_IMAGE: Record<string, string> = {
  "eco-friendly": "/images/product-eco.jpg",
  "classic-oriental": "/images/product-placeholder.jpg",
  "novelty-self-care": "/images/product-tumbler.jpg",
  "executive-smart-tech": "/images/product-it.jpg",
  "gift-set": "/images/product-tumbler.jpg",
  drinkware: "/images/product-tumbler.jpg",
  technology: "/images/product-it.jpg",
  wellness: "/images/product-tumbler.jpg",
  office: "/images/product-placeholder.jpg",
  bag: "/images/category-bags.jpg",
  eco: "/images/category-eco.jpg",
  custom: "/images/category-custom.jpg",
};

const TAB_LABEL: Record<string, string> = {
  "eco-friendly": "รักษ์โลก",
  "classic-oriental": "ตะวันออก",
  "novelty-self-care": "Wellness",
  "executive-smart-tech": "Smart Tech",
  "gift-set": "ชุดของขวัญ",
  drinkware: "แก้ว/กระบอก",
  technology: "ไอที",
  wellness: "เวลเนส",
  office: "ออฟฟิศ",
  bag: "กระเป๋า/ถุงผ้า",
  eco: "รักษ์โลก",
  custom: "สั่งผลิต",
};

/** Old catalog / mock slugs → current sg_categories.slug */
export const SMARTGIFT_CATEGORY_ALIASES: Record<string, string> = {
  "eco-friendly": "eco",
  "eco-giftset": "eco",
  "tumbler-set": "drinkware",
  "it-set": "technology",
  "team-building-set": "office",
};

export function canonicalCategorySlug(slug: string): string {
  const key = String(slug || "")
    .trim()
    .toLowerCase();
  return SMARTGIFT_CATEGORY_ALIASES[key] || key;
}

export function offerCodeToSlug(code: string): string {
  const base = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return base || "offer";
}

export function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatThbRange(min: number, max: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("th-TH", {
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  if (Math.abs(min - max) < 0.01) return `${fmt(min)} บาท`;
  return `${fmt(min)}–${fmt(max)} บาท`;
}

function looksLikeCustomSet(name: string, slug: string): boolean {
  if (
    slug === "eco-friendly" ||
    slug === "novelty-self-care" ||
    slug === "gift-set" ||
    slug === "drinkware" ||
    slug === "eco"
  ) {
    return true;
  }
  return /กระบอก|แก้ว|tumbler|bottle|สมุด|ปากกา|mug/i.test(name);
}

export function adaptSmartgiftOffer(
  row: SmartgiftOfferRow,
  components: Array<{ product_code: string; qty: number; name_th: string | null }>,
): Product {
  const slug = (row.source_slug || "").trim() || offerCodeToSlug(row.offer_code);
  const categorySlug = row.interest_theme_slug || "gift-set";
  const priceMin = toNumber(row.price_min);
  const priceMax = toNumber(row.price_max);
  const minOrder = Math.max(1, Math.round(toNumber(row.min_order) || 10));
  const bom = components
    .map((item) => ({
      name: item.name_th || item.product_code,
      qty: Math.max(1, Math.round(item.qty || 1)),
      sku: item.product_code,
    }))
    .filter((item) => item.name);
  const description = [
    row.unboxing_experience?.trim(),
    bom.length ? `ประกอบด้วย ${bom.map((item) => item.name).join(" · ")}` : "",
    row.gift_tier ? `ระดับ ${row.gift_tier}` : "",
    `รหัส ${row.offer_code}`,
    "สกรีนโลโก้ได้ สั่งผลิตตามออเดอร์ — ราคาตามจำนวน ไม่ใช่ราคาชำระบนเว็บ",
  ]
    .filter(Boolean)
    .join(" — ");

  const priced = priceMin != null && priceMax != null && priceMin > 0;
  const cover =
    (row.image_url || "").trim() ||
    PRODUCT_IMAGE[categorySlug] ||
    "/images/product-placeholder.jpg";
  return {
    name: row.name,
    slug,
    description,
    material: row.product_family
      ? `ชุดของขวัญ · ${row.product_family}`
      : "ชุดของขวัญองค์กร สั่งผลิต",
    minOrder,
    priceRange: priced
      ? formatThbRange(priceMin, priceMax)
      : "สอบถามราคา / ขอใบเสนอราคา",
    priceMin: priced ? priceMin : 0,
    priceMax: priced ? priceMax : 0,
    currency: "THB",
    images: [cover],
    categorySlug,
    categoryName: row.interest_theme || undefined,
    productId: row.offer_code,
    isBundle: bom.length > 1,
    leadDays: toNumber(row.lead_days),
    components: bom,
    enableCustomDesign: looksLikeCustomSet(row.name, categorySlug),
    customDesignPreset: looksLikeCustomSet(row.name, categorySlug)
      ? "tumbler_set"
      : "product_photo",
    seo: {
      seoTitle: row.name.slice(0, 60),
      metaDescription: description.slice(0, 155),
      canonicalPath: `/products/${slug}`,
      ogImage: cover,
    },
  };
}

export function adaptSmartgiftCategory(row: SmartgiftCategoryRow): Category {
  const heroImage = CATEGORY_IMAGE[row.slug] || "/images/category-tumbler.jpg";
  const name = row.name_th;
  const description =
    [row.vibe, row.target_recipient, `${row.offer_count} รายการในแคตตาล็อก SmartGift`]
      .filter(Boolean)
      .join(" — ") || name;
  return {
    name,
    slug: row.slug,
    description,
    heroImage,
    seo: {
      seoTitle: name.slice(0, 60),
      metaDescription: description.slice(0, 155),
      canonicalPath: `/giftset/${row.slug}`,
      ogImage: heroImage,
      keywords: TAB_LABEL[row.slug] || name,
    },
  };
}

export async function listSmartgiftCategories(): Promise<Category[]> {
  const rows = await smartgiftQuery<SmartgiftCategoryRow[]>(
    `SELECT c.slug, c.name_th, c.name_en, c.vibe, c.target_recipient,
            COUNT(o.offer_code) AS offer_count
     FROM sg_categories c
     LEFT JOIN sg_offer o ON o.interest_theme_slug = c.slug
     GROUP BY c.slug, c.name_th, c.name_en, c.vibe, c.target_recipient
     HAVING offer_count > 0
     ORDER BY offer_count DESC, c.name_th ASC`,
  );
  return rows.map(adaptSmartgiftCategory);
}

export async function listSmartgiftOffers(options?: {
  limit?: number;
  categorySlug?: string;
  q?: string;
  slug?: string;
  pricedOnly?: boolean;
}): Promise<Product[]> {
  const limit = Math.min(Math.max(options?.limit ?? 240, 1), 2500);
  const pricedOnly =
    options?.pricedOnly ??
    !(options?.slug?.trim() || options?.q?.trim() || options?.categorySlug);
  const params: Record<string, unknown> = {};
  let where = "WHERE 1=1";
  if (pricedOnly) {
    where += " AND o.has_price = 1";
  }
  if (options?.categorySlug) {
    where += " AND o.interest_theme_slug = :categorySlug";
    params.categorySlug = canonicalCategorySlug(options.categorySlug);
  }
  if (options?.slug?.trim()) {
    const wanted = offerCodeToSlug(options.slug);
    where +=
      " AND (o.source_slug = :slug OR o.source_slug = :wantedSlug OR LOWER(o.offer_code) = :wantedSlug OR o.offer_code = :offerCode)";
    params.slug = options.slug.trim();
    params.wantedSlug = wanted;
    params.offerCode = options.slug.trim().toUpperCase();
  }
  if (options?.q?.trim()) {
    where +=
      " AND (o.name LIKE :q OR o.offer_code LIKE :q OR o.source_slug LIKE :q)";
    params.q = `%${options.q.trim()}%`;
  }

  const rows = await smartgiftQuery<SmartgiftOfferRow[]>(
    `SELECT o.offer_code, o.name, o.gift_tier, o.supplier_code,
            o.interest_theme, o.interest_theme_slug, o.unboxing_experience,
            o.image_url, o.source_slug, o.lead_days,
            o.product_family, o.has_price, o.catalog_match_status,
            COALESCE(MIN(p.min_qty), 10) AS min_order,
            COALESCE(o.price_min, MIN(p.unit_price)) AS price_min,
            COALESCE(o.price_max, MAX(p.unit_price)) AS price_max
     FROM sg_offer o
     LEFT JOIN sg_offer_price p ON p.offer_code = o.offer_code
     ${where}
     GROUP BY o.offer_code
     ORDER BY o.has_price DESC, (o.price_min IS NULL) ASC,
              o.price_min ASC, o.name ASC
     LIMIT ${limit}`,
    params,
  );

  const byOffer = new Map<string, SmartgiftItemRow[]>();
  const codes = [...new Set(rows.map((row) => row.offer_code))];
  if (codes.length > 0) {
    const inParams: Record<string, string> = {};
    const inList = codes
      .map((code, index) => {
        const key = `code${index}`;
        inParams[key] = code;
        return `:${key}`;
      })
      .join(", ");
    const items = await smartgiftQuery<SmartgiftItemRow[]>(
      `SELECT i.offer_code, i.product_code, i.qty, p.name_th
       FROM sg_offer_item i
       LEFT JOIN sg_products p ON p.code = i.product_code
       WHERE i.offer_code IN (${inList})
       ORDER BY i.offer_code, i.line_no`,
      inParams,
    );
    for (const item of items) {
      const list = byOffer.get(item.offer_code) || [];
      list.push(item);
      byOffer.set(item.offer_code, list);
    }
  }

  return rows.map((row) => adaptSmartgiftOffer(row, byOffer.get(row.offer_code) || []));
}

export async function getSmartgiftOfferBySlug(
  slug: string,
): Promise<Product | null> {
  const rows = await listSmartgiftOffers({ slug, limit: 8, pricedOnly: false });
  if (rows.length === 0) return null;
  const wanted = offerCodeToSlug(slug);
  return (
    rows.find(
      (row) =>
        row.slug === slug ||
        row.slug === wanted ||
        offerCodeToSlug(row.slug) === wanted,
    ) ?? rows[0] ?? null
  );
}
