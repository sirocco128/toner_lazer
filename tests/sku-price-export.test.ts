import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSkuPriceExportCsv,
  buildSkuPriceExportXlsx,
  skuPriceExportFileName,
  summarizeSkuPriceExport,
} from "../lib/sku-price-export";
import type { SkuRecord } from "../lib/sku-master-types";

function sampleSku(overrides: Partial<SkuRecord> = {}): SkuRecord {
  return {
    productId: "B00001",
    stockClass: "B",
    runningNo: 1,
    oriProductId: 10,
    oriProductCode: "TSQ01-2",
    oriProductNameTh: "โรงงานทดสอบ",
    colorNameTh: null,
    nameTh: "แก้วมัค พร้อม towel",
    nameEn: null,
    sellPriceThb: null,
    isBundle: false,
    clearanceReason: null,
    catalogSlug: null,
    imageUrl: null,
    displayImageUrl: "/images/product-placeholder.svg",
    factoryUnitCny: 32,
    factoryUnitUsd: null,
    unitLandedCostThb: 180,
    forcedMinQty: 50,
    pcsPerCtn: 20,
    lengthCm: 47.5,
    widthCm: 45.5,
    heightCm: 51,
    cartonKg: 17,
    dimsAreCarton: true,
    onHandQty: 0,
    tags: [],
    ...overrides,
  };
}

describe("sku-price-export", () => {
  it("exports factory sku column for re-import and review ladder", () => {
    const csv = buildSkuPriceExportCsv([sampleSku()], {
      profile: "standard",
      canSeeCost: true,
    });
    assert.match(csv, /^\uFEFF?sku,name,rmb,/);
    assert.match(csv, /TSQ01-2/);
    assert.match(csv, /B00001/);
    assert.match(csv, /,yes,/);
    assert.match(csv, /qty_10/);
    assert.ok(csv.includes("32"));
  });

  it("summarizes import-ready rows", () => {
    const summary = summarizeSkuPriceExport(
      [
        sampleSku(),
        sampleSku({
          productId: "B00002",
          oriProductCode: null,
          oriProductId: null,
        }),
        sampleSku({ productId: "A00001", isBundle: true, oriProductCode: "BD-1" }),
      ],
      { canSeeCost: true },
    );
    assert.equal(summary.total, 3);
    assert.equal(summary.importReady, 1);
    assert.equal(summary.missingFactoryCode, 1);
    assert.equal(summary.bundles, 1);
  });

  it("builds a real xlsx zip with summary + import sheets", () => {
    const buf = buildSkuPriceExportXlsx([sampleSku()], { canSeeCost: true });
    assert.ok(buf.length > 100);
    assert.equal(buf[0], 0x50); // P
    assert.equal(buf[1], 0x4b); // K
    const asText = buf.toString("utf8");
    assert.match(asText, /sheet1\.xml/);
    assert.match(asText, /sheet2\.xml/);
  });

  it("marks rows without factory code as not import-ready", () => {
    const csv = buildSkuPriceExportCsv(
      [
        sampleSku({
          oriProductCode: null,
          oriProductId: null,
          factoryUnitCny: null,
          unitLandedCostThb: null,
        }),
      ],
      { canSeeCost: true },
    );
    assert.match(csv, /,no,/);
    assert.match(csv, /ไม่มีรหัสโรงงาน/);
  });

  it("exports ORI packing dims into factory columns", () => {
    const csv = buildSkuPriceExportCsv([sampleSku()], {
      profile: "standard",
      canSeeCost: true,
    });
    assert.match(csv, /,20,47\.5,45\.5,51,17,/);
  });

  it("hides factory cost when canSeeCost is false", () => {
    const csv = buildSkuPriceExportCsv([sampleSku()], { canSeeCost: false });
    const dataLine = csv.split("\n")[1]!;
    assert.match(dataLine, /^TSQ01-2,แก้วมัค พร้อม towel,,20,47\.5,45\.5,51,17,B00001,/);
    assert.ok(!dataLine.includes(",32,"));
  });

  it("names export file with date stamp", () => {
    assert.equal(
      skuPriceExportFileName("xlsx", new Date("2026-09-09T07:00:00Z")),
      "sku-price-export-20260909.xlsx",
    );
    assert.equal(
      skuPriceExportFileName("csv", new Date("2026-09-09T07:00:00Z")),
      "sku-price-export-20260909.csv",
    );
  });
});
