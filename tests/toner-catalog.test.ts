import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TONER_PRICING,
  TONER_CATALOG,
  buildNexterpSyncPlan,
  buildNexterpTonerCategories,
  buildNexterpTonerProducts,
  findToner,
  grossMargin,
  missingRequiredColumns,
  normalizeModel,
  priceToner,
  tonerPricingConfigFromEnv,
  tonerProductName,
} from "../lib/toner-catalog";
import { adaptNexterpProduct, categoryCodeToSlug } from "../lib/nexterp-products";
import type { NexterpProductRow } from "../lib/nexterp-products";

function item(sku: string) {
  const found = TONER_CATALOG.find((t) => t.sku === sku);
  assert.ok(found, `missing ${sku}`);
  return found;
}

describe("toner catalog data", () => {
  it("has unique SKUs and OEM codes", () => {
    const skus = TONER_CATALOG.map((t) => t.sku);
    assert.equal(new Set(skus).size, skus.length);
    const codes = TONER_CATALOG.map((t) => t.oemCode);
    assert.equal(new Set(codes).size, codes.length);
  });

  it("has printers and a positive Advice price for every item", () => {
    for (const t of TONER_CATALOG) {
      assert.ok(t.compatiblePrinters.length > 0, t.sku);
      assert.ok(t.adviceOnlinePrice > 0, t.sku);
      if (t.adviceNormalPrice != null) {
        assert.ok(t.adviceNormalPrice >= t.adviceOnlinePrice, t.sku);
      }
    }
  });
});

describe("priceToner", () => {
  it("matches the business plan for HP 85A (20% off + 10 THB box)", () => {
    const p = priceToner(item("TL-HP-CE285A"));
    assert.equal(p.supplierPrice, 184);
    assert.equal(p.landedCost, 194);
    assert.equal(p.direct, 490);
    assert.equal(p.economy, 390);
    assert.equal(p.dealer, 220);
    assert.equal(p.costPerPage, 0.12);
    assert.equal(p.dealerCapped, false);
  });

  it("keeps every dealer price below the Advice online price", () => {
    for (const t of TONER_CATALOG) {
      const p = priceToner(t);
      assert.ok(p.dealer < t.adviceOnlinePrice, `${t.sku} dealer ${p.dealer}`);
      assert.ok(p.dealer > p.landedCost, `${t.sku} dealer below cost`);
    }
  });

  it("hits the target margins on direct and economy tiers", () => {
    for (const t of TONER_CATALOG) {
      const p = priceToner(t);
      assert.ok(grossMargin(p.direct, p.landedCost) >= 0.6 - 1e-9, t.sku);
      assert.ok(grossMargin(p.economy, p.landedCost) >= 0.5 - 1e-9, t.sku);
      assert.equal(p.direct % 10, 0);
      assert.equal(p.economy % 10, 0);
    }
  });

  it("uses 10% discount when configured", () => {
    const p = priceToner(item("TL-HP-CE285A"), {
      ...DEFAULT_TONER_PRICING,
      supplierDiscount: 0.1,
    });
    assert.equal(p.landedCost, 217);
  });

  it("caps the dealer tier below Advice when margins would exceed it", () => {
    const p = priceToner(item("TL-BR-TN1000"), {
      ...DEFAULT_TONER_PRICING,
      supplierDiscount: 0,
    });
    assert.equal(p.dealerCapped, true);
    assert.ok(p.dealer < 175);
  });

  it("returns null cost per page when yield is unknown", () => {
    assert.equal(priceToner(item("TL-HP-CF226A")).costPerPage, null);
  });
});

describe("tonerPricingConfigFromEnv", () => {
  it("reads valid values and ignores bad ones", () => {
    const c = tonerPricingConfigFromEnv({
      TONER_SUPPLIER_DISCOUNT: "0.1",
      TONER_BOX_COST_THB: "12",
      TONER_DIRECT_MARGIN: "abc",
    });
    assert.equal(c.supplierDiscount, 0.1);
    assert.equal(c.boxCostThb, 12);
    assert.equal(c.directMargin, DEFAULT_TONER_PRICING.directMargin);
  });
});

describe("findToner", () => {
  it("normalizes brand and series words", () => {
    assert.equal(normalizeModel("HP LaserJet Pro M1132 MFP"), "M1132");
    assert.equal(normalizeModel("dcp-l2540dw"), "DCPL2540DW");
  });

  it("finds by printer model", () => {
    assert.deepEqual(findToner("HP M1132").map((t) => t.sku), ["TL-HP-CE285A"]);
    assert.deepEqual(findToner("Brother DCP-L2540DW").map((t) => t.sku), [
      "TL-BR-TN2380",
    ]);
    assert.deepEqual(findToner("Samsung Xpress M2070FW").map((t) => t.sku), [
      "TL-SS-D111S",
    ]);
  });

  it("finds by cartridge model or OEM code", () => {
    assert.deepEqual(findToner("85A").map((t) => t.sku), ["TL-HP-CE285A"]);
    assert.deepEqual(findToner("ce285a").map((t) => t.sku), ["TL-HP-CE285A"]);
    assert.deepEqual(findToner("TN 3350").map((t) => t.sku), ["TL-BR-TN3350"]);
  });

  it("returns nothing for unknown or too-short queries", () => {
    assert.deepEqual(findToner("Canon LBP2900"), []);
    assert.deepEqual(findToner("h"), []);
  });
});

describe("NEXTERP rows", () => {
  it("builds one category per brand", () => {
    assert.deepEqual(
      buildNexterpTonerCategories().map((c) => c.code),
      ["TONER_HP", "TONER_BROTHER", "TONER_SAMSUNG"],
    );
  });

  it("builds products with direct price and toner category", () => {
    const rows = buildNexterpTonerProducts();
    assert.equal(rows.length, TONER_CATALOG.length);
    const hp85 = rows.find((r) => r.sku === "TL-HP-CE285A");
    assert.ok(hp85);
    assert.equal(hp85.sell_price, 490);
    assert.equal(hp85.category_code, "TONER_HP");
    assert.equal(hp85.uom, "ตลับ");
    assert.match(hp85.description, /M1132/);
    assert.doesNotMatch(hp85.name, /Color\s*Fly/i);
  });

  it("names cartridges without repeating identical codes", () => {
    assert.equal(
      tonerProductName(item("TL-HP-CE285A")),
      "ตลับหมึกเลเซอร์เทียบเท่า 85A (CE285A) สำหรับ HP",
    );
    assert.equal(
      tonerProductName(item("TL-BR-TN3350")),
      "ตลับหมึกเลเซอร์เทียบเท่า TN-3350 สำหรับ Brother",
    );
  });
});

describe("buildNexterpSyncPlan", () => {
  const categories = buildNexterpTonerCategories();
  const products = buildNexterpTonerProducts();

  it("inserts everything into an empty NEXTERP", () => {
    const plan = buildNexterpSyncPlan({
      categories,
      products,
      existingCategories: [],
      existingProducts: [],
    });
    assert.equal(plan.categoryInserts.length, 3);
    assert.equal(plan.productInserts.length, TONER_CATALOG.length);
    assert.equal(plan.productUpdates.length, 0);
  });

  it("is idempotent when NEXTERP already matches", () => {
    const existingCategories = categories.map((c, i) => ({ id: 100 + i, code: c.code }));
    const catId = new Map(existingCategories.map((c) => [c.code, c.id]));
    const existingProducts = products.map((p, i) => ({
      id: 500 + i,
      sku: p.sku,
      name: p.name,
      description: p.description,
      category_id: catId.get(p.category_code) ?? null,
      category_raw: p.category_raw,
      uom: p.uom,
      sell_price: p.sell_price.toFixed(2),
      is_active: 1,
    }));
    const plan = buildNexterpSyncPlan({
      categories,
      products,
      existingCategories,
      existingProducts,
    });
    assert.equal(plan.categoryInserts.length, 0);
    assert.equal(plan.productInserts.length, 0);
    assert.equal(plan.productUpdates.length, 0);
    assert.equal(plan.unchanged.length, TONER_CATALOG.length);
  });

  it("updates only the fields that changed", () => {
    const existingCategories = [{ id: 1, code: "toner_hp" }];
    const hp85 = products.find((p) => p.sku === "TL-HP-CE285A");
    assert.ok(hp85);
    const plan = buildNexterpSyncPlan({
      categories,
      products: [hp85],
      existingCategories,
      existingProducts: [
        {
          id: 9,
          sku: "tl-hp-ce285a",
          name: hp85.name,
          description: hp85.description,
          category_id: 1,
          category_raw: "TONER",
          uom: "ตลับ",
          sell_price: 450,
          is_active: 1,
        },
      ],
    });
    assert.equal(plan.productUpdates.length, 1);
    assert.deepEqual(plan.productUpdates[0], {
      id: 9,
      sku: "TL-HP-CE285A",
      fields: { sell_price: 490 },
    });
  });
});

describe("missingRequiredColumns", () => {
  it("flags NOT NULL columns without default that the sync does not write", () => {
    const missing = missingRequiredColumns(
      [
        { name: "id", nullable: false, hasDefault: false, autoIncrement: true },
        { name: "sku", nullable: false, hasDefault: false, autoIncrement: false },
        { name: "tenant_id", nullable: false, hasDefault: false, autoIncrement: false },
        { name: "created_at", nullable: false, hasDefault: true, autoIncrement: false },
        { name: "barcode", nullable: true, hasDefault: false, autoIncrement: false },
      ],
      ["sku", "name"],
    );
    assert.deepEqual(missing, ["tenant_id"]);
  });
});

describe("NEXTERP toner rows in the public catalog", () => {
  function row(overrides: Partial<NexterpProductRow>): NexterpProductRow {
    return {
      id: 1,
      sku: "TL-HP-CE285A",
      name: "ตลับหมึกเลเซอร์เทียบเท่า 85A (CE285A) สำหรับ HP",
      description: null,
      category_id: 1,
      category_code: "TONER_HP",
      category_name_th: "หมึกเลเซอร์เทียบเท่า สำหรับ HP",
      category_raw: "TONER",
      uom: "ตลับ",
      sell_price: "490.00",
      is_active: 1,
      ...overrides,
    } as NexterpProductRow;
  }

  it("maps toner category codes to toner slugs", () => {
    assert.equal(categoryCodeToSlug("TONER_HP"), "toner-hp");
    assert.equal(categoryCodeToSlug("TONER_BROTHER"), "toner-brother");
    assert.equal(categoryCodeToSlug("TONER_CANON"), "toner");
  });

  it("shows the exact sell price, per-cartridge ordering and no gift copy", () => {
    const p = adaptNexterpProduct(row({}));
    assert.equal(p.categorySlug, "toner-hp");
    assert.equal(p.minOrder, 1);
    assert.equal(p.priceMin, 490);
    assert.equal(p.priceMax, 490);
    assert.equal(p.enableCustomDesign, false);
    assert.doesNotMatch(p.description, /สกรีน|Smart Gift/);
  });
});
