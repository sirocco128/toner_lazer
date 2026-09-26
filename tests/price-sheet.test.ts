import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeUnitLanded, defaultLandedCostConfig } from "../lib/alibaba/landed-cost";
import {
  computePriceSheetRow,
  DEMO_PRICE_SHEET_PRODUCTS,
  DEFAULT_PRICE_SHEET_PARAMS,
  priceSheetGrandTotal,
  computePriceSheetRows,
  canClientComputePriceSheet,
} from "../lib/price-sheet";
import { sanitizePriceSheetProduct } from "../lib/price-sheet-catalog";

describe("price-sheet 3-tab engine", () => {
  it("matches computeUnitLanded sell for standard demo row", () => {
    const product = {
      ...DEMO_PRICE_SHEET_PRODUCTS[0]!,
      factoryCny: 28,
      qty: 50,
    };
    const row = computePriceSheetRow(product, DEFAULT_PRICE_SHEET_PARAMS);
    const landed = computeUnitLanded(
      product.offer!,
      50,
      28,
      defaultLandedCostConfig({
        cnyToThb: DEFAULT_PRICE_SHEET_PARAMS.cnyToThb,
        month: DEFAULT_PRICE_SHEET_PARAMS.month,
      }),
    );
    assert.ok(landed);
    assert.equal(row.source, "landed");
    assert.equal(row.sellThb, landed!.sellThb);
    assert.equal(row.landedCostThb, landed!.landedCostThb);
    assert.equal(row.sof, landed!.sof);
  });

  it("recomputes Final when qty changes", () => {
    const base = DEMO_PRICE_SHEET_PRODUCTS[1]!;
    const low = computePriceSheetRow(
      { ...base, qty: 20, factoryCny: 45 },
      DEFAULT_PRICE_SHEET_PARAMS,
    );
    const high = computePriceSheetRow(
      { ...base, qty: 500, factoryCny: 45 },
      DEFAULT_PRICE_SHEET_PARAMS,
    );
    assert.ok(high.sellThb <= low.sellThb);
    assert.equal(low.sof, 1.5);
    assert.equal(high.sof, 1);
  });

  it("falls back to catalog band when no offer or landed", () => {
    const row = computePriceSheetRow(
      {
        id: "CAT-1",
        name: "จากแคตตาล็อก",
        qty: 30,
        source: "catalog",
        catalogSellMin: 390,
        catalogSellMax: 520,
      },
      DEFAULT_PRICE_SHEET_PARAMS,
    );
    assert.equal(row.source, "catalog");
    assert.equal(row.sellThb, 390);
  });

  it("uses unit landed when offer is missing", () => {
    const row = computePriceSheetRow(
      {
        id: "SKU-1",
        name: "SKU ลงเรือ",
        qty: 100,
        source: "catalog",
        unitLandedCostThb: 120,
      },
      DEFAULT_PRICE_SHEET_PARAMS,
    );
    assert.equal(row.source, "unit_landed");
    assert.ok(row.sellThb > 120);
  });

  it("strips factory fields for sales sanitize", () => {
    const raw = {
      ...DEMO_PRICE_SHEET_PRODUCTS[0]!,
      factoryCny: 28,
      slug: "demo-box-01",
    };
    const clean = sanitizePriceSheetProduct(raw, false);
    assert.equal(clean.offer, undefined);
    assert.equal(clean.factoryCny, undefined);
    assert.equal(clean.unitLandedCostThb, undefined);
    assert.equal(canClientComputePriceSheet([clean], false), false);
  });

  it("sums Sheet3 grand total from Final × qty", () => {
    const rows = computePriceSheetRows(
      DEMO_PRICE_SHEET_PRODUCTS.map((p) => ({
        ...p,
        factoryCny: p.offer!.factoryMaxCny,
      })),
      DEFAULT_PRICE_SHEET_PARAMS,
    );
    const expected = rows.reduce((sum, row) => sum + row.sellThb * row.qty, 0);
    assert.equal(priceSheetGrandTotal(rows), expected);
    assert.ok(expected > 0);
  });
});
