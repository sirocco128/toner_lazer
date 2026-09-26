/**
 * Upsert customer-orderable sell ladders onto SmartGift MySQL
 * (sg_offer + sg_offer_price + product_prices).
 */

import type { RowDataPacket } from "mysql2/promise";
import { isSmartgiftMysqlEnabled, smartgiftExec, smartgiftQuery } from "@/lib/smartgift-mysql";
import { THAI_VAT_RATE, roundSatang } from "@/lib/th-billing";

export type CatalogOfferHit = {
  offerCode: string;
  slug: string;
  name: string;
  supplierCode: string;
  categorySlug: string | null;
  giftTier: string | null;
  priceMin: number | null;
  priceMax: number | null;
  minOrder: number;
  hasPrice: boolean;
};

export type SellTierWrite = {
  qty: number;
  unitPrice: number;
};

const PRICE_SOURCE = "ops_landed";

function money(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function listCatalogOfferHits(): Promise<CatalogOfferHit[]> {
  if (!isSmartgiftMysqlEnabled()) return [];
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT o.offer_code, o.name, o.source_slug, o.supplier_code,
            o.interest_theme_slug, o.gift_tier, o.has_price,
            o.price_min, o.price_max,
            COALESCE(MIN(p.min_qty), 10) AS min_order
     FROM sg_offer o
     LEFT JOIN sg_offer_price p ON p.offer_code = o.offer_code
     GROUP BY o.offer_code
     ORDER BY o.offer_code`,
  );
  return rows.map((row) => {
    const offerCode = String(row.offer_code || "").trim();
    const sourceSlug = String(row.source_slug || "").trim();
    return {
      offerCode,
      slug: sourceSlug || offerCode.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: String(row.name || ""),
      supplierCode: String(row.supplier_code || ""),
      categorySlug: row.interest_theme_slug
        ? String(row.interest_theme_slug)
        : null,
      giftTier: row.gift_tier ? String(row.gift_tier) : null,
      priceMin: money(row.price_min as number | string | null),
      priceMax: money(row.price_max as number | string | null),
      minOrder: Math.max(1, Math.round(money(row.min_order as number) || 10)),
      hasPrice: Number(row.has_price) === 1,
    };
  });
}

const columnCache = new Map<string, Set<string>>();

async function tableColumns(table: string): Promise<Set<string>> {
  const cached = columnCache.get(table);
  if (cached) return cached;
  const rows = await smartgiftQuery<RowDataPacket[]>(
    table === "sg_offer_price"
      ? "SHOW COLUMNS FROM sg_offer_price"
      : "SHOW COLUMNS FROM product_prices",
  );
  const cols = new Set(rows.map((row) => String(row.Field)));
  columnCache.set(table, cols);
  return cols;
}

export async function applyOfferSellLadder(params: {
  hit: CatalogOfferHit;
  priceMin: number;
  priceMax: number;
  tiers: SellTierWrite[];
}): Promise<void> {
  const { hit, priceMin, priceMax, tiers } = params;
  const vatMul = 1 + THAI_VAT_RATE / 100;
  const supplier = hit.supplierCode || "";

  await smartgiftExec(
    `UPDATE sg_offer
     SET has_price = 1,
         price_min = :price_min,
         price_max = :price_max,
         price_source = :price_source
     WHERE offer_code = :offer_code`,
    {
      price_min: priceMin,
      price_max: priceMax,
      price_source: PRICE_SOURCE,
      offer_code: hit.offerCode,
    },
  );

  const priceCols = await tableColumns("sg_offer_price");
  for (const tier of tiers) {
    const vat = roundSatang(tier.unitPrice * vatMul);
    const sku = `${hit.offerCode}(${supplier || "CAT"})-${tier.qty}`;
    const params = {
      offer_code: hit.offerCode,
      supplier_code: supplier,
      min_qty: tier.qty,
      unit_price: tier.unitPrice,
      vat,
      price_source: PRICE_SOURCE,
      commercial_sku: sku,
    };
    if (priceCols.has("unit_price_with_vat") && priceCols.has("commercial_sku")) {
      await smartgiftExec(
        `INSERT INTO sg_offer_price
           (offer_code, supplier_code, min_qty, unit_price, unit_price_with_vat,
            currency, price_source, commercial_sku)
         VALUES (:offer_code, :supplier_code, :min_qty, :unit_price, :vat,
                 'THB', :price_source, :commercial_sku)
         ON DUPLICATE KEY UPDATE
           unit_price = VALUES(unit_price),
           unit_price_with_vat = VALUES(unit_price_with_vat),
           price_source = VALUES(price_source),
           commercial_sku = VALUES(commercial_sku)`,
        params,
      );
    } else {
      await smartgiftExec(
        `INSERT INTO sg_offer_price
           (offer_code, supplier_code, min_qty, unit_price, currency)
         VALUES (:offer_code, :supplier_code, :min_qty, :unit_price, 'THB')
         ON DUPLICATE KEY UPDATE unit_price = VALUES(unit_price)`,
        params,
      );
    }
  }

  try {
    const cols = await tableColumns("product_prices");
    if (!cols.has("sku") || !cols.has("min_qty")) return;
    const group = supplier || "default";
    for (const tier of tiers) {
      const vat = roundSatang(tier.unitPrice * vatMul);
      if (cols.has("price_list_group") && cols.has("unit_price_with_vat")) {
        await smartgiftExec(
          `INSERT INTO product_prices
             (sku, item_type, name, category_slug, gift_tier, price_list_group,
              min_qty, unit_price, unit_price_with_vat, price_missing, currency, source)
           VALUES (:sku, 'offer', :name, :category_slug, :gift_tier, :price_list_group,
                   :min_qty, :unit_price, :vat, 0, 'THB', :source)
           ON DUPLICATE KEY UPDATE
             unit_price = VALUES(unit_price),
             unit_price_with_vat = VALUES(unit_price_with_vat),
             name = VALUES(name),
             source = VALUES(source),
             price_missing = 0`,
          {
            sku: hit.offerCode,
            name: hit.name,
            category_slug: hit.categorySlug,
            gift_tier: hit.giftTier,
            price_list_group: group,
            min_qty: tier.qty,
            unit_price: tier.unitPrice,
            vat,
            source: PRICE_SOURCE,
          },
        );
      } else {
        await smartgiftExec(
          `INSERT INTO product_prices
             (sku, item_type, name, category_slug, min_qty, unit_price, currency, source)
           VALUES (:sku, 'offer', :name, :category_slug, :min_qty, :unit_price, 'THB', :source)
           ON DUPLICATE KEY UPDATE
             unit_price = VALUES(unit_price),
             name = VALUES(name),
             source = VALUES(source)`,
          {
            sku: hit.offerCode,
            name: hit.name,
            category_slug: hit.categorySlug,
            min_qty: tier.qty,
            unit_price: tier.unitPrice,
            source: PRICE_SOURCE,
          },
        );
      }
    }
  } catch {
    // product_prices is optional on older SmartGift schemas
  }
}
