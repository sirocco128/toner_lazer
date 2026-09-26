import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFactoryProductsFromSheetRows,
  factoryUnitDims,
  parseFactoryCsv,
  parseFactoryWorkbook,
  PACK_RE,
} from "../lib/factory-workbook";
import {
  catalogIndexFromHits,
  computePriceBatchRows,
  defaultPriceBatchConfig,
  matchCatalogHit,
  previewRowsToCsv,
} from "../lib/ops-price-batch";

function zipStore(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 26, nameBytes.length);
    writeU32(local, 18, data.length);
    writeU32(local, 22, data.length);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 10, 0);
    writeU32(central, 20, data.length);
    writeU32(central, 24, data.length);
    writeU16(central, 28, nameBytes.length);
    writeU32(central, 42, offset);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const dirSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  writeU32(eocd, 0, 0x06054b50);
  writeU16(eocd, 8, locals.length);
  writeU16(eocd, 10, locals.length);
  writeU32(eocd, 12, dirSize);
  writeU32(eocd, 16, offset);
  const out = new Uint8Array(offset + dirSize + 22);
  let p = 0;
  for (const part of locals) {
    out.set(part, p);
    p += part.length;
  }
  for (const part of centrals) {
    out.set(part, p);
    p += part.length;
  }
  out.set(eocd, p);
  return out;
}

function writeU16(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
}

function writeU32(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
  buf[offset + 3] = (value >> 24) & 0xff;
}

describe("factory workbook parse", () => {
  it("reads packing notation", () => {
    const m = PACK_RE.exec("20 sets/ctn, 47.5*45.5*51cm, 17kgs");
    assert.ok(m);
    assert.equal(Number(m![1]), 20);
    assert.equal(Number(m![5]), 17);
  });

  it("parses a header CSV", () => {
    const { products } = parseFactoryCsv(`sku,name,rmb,per ctn,length,width,height,weight
TSQ01-2,Humidifier set,32,20,47.5,45.5,51,17
`);
    assert.equal(products.length, 1);
    assert.equal(products[0]!.code, "TSQ01-2");
    assert.equal(products[0]!.rmb, 32);
    assert.equal(products[0]!.upc, 20);
    const dims = factoryUnitDims(products[0]!);
    assert.equal(dims.weightKg, 17 / 20);
    assert.ok(dims.heightCm && dims.heightCm < 51);
  });

  it("parses factory block rows (code + RMB formula + packing)", () => {
    const products = buildFactoryProductsFromSheetRows([
      {
        r: 1,
        cells: {
          0: { v: "TSQ01-2", f: null },
          1: { v: "Light humidifier set", f: null },
          3: { v: "4.92", f: "32/6.5" },
        },
      },
      {
        r: 2,
        cells: {
          0: { v: "20 sets/ctn, 47.5*45.5*51cm, 17kgs", f: null },
        },
      },
    ]);
    assert.equal(products.length, 1);
    assert.equal(products[0]!.code, "TSQ01-2");
    assert.equal(products[0]!.rmb, 32);
    assert.equal(products[0]!.upc, 20);
    assert.equal(products[0]!.cartonKg, 17);
  });

  it("reads a stored xlsx zip", async () => {
    const shared = `<?xml version="1.0"?><sst><si><t>TSQ01-2</t></si><si><t>Light humidifier set</t></si></sst>`;
    const sheet = `<?xml version="1.0"?><worksheet><sheetData>
      <row r="1">
        <c r="A1" t="s"><v>0</v></c>
        <c r="B1" t="s"><v>1</v></c>
        <c r="D1"><f>32/6.5</f><v>4.92</v></c>
      </row>
      <row r="2">
        <c r="A2" t="inlineStr"><is><t>20 sets/ctn, 47.5*45.5*51cm, 17kgs</t></is></c>
      </row>
    </sheetData></worksheet>`;
    const buf = zipStore({
      "xl/sharedStrings.xml": shared,
      "xl/worksheets/sheet1.xml": sheet,
    });
    const parsed = await parseFactoryWorkbook(buf, "gift.xlsx");
    assert.equal(parsed.products.length, 1);
    assert.equal(parsed.products[0]!.code, "TSQ01-2");
    assert.equal(parsed.products[0]!.rmb, 32);
  });
});

describe("price batch preview", () => {
  it("matches offer codes and builds the public qty ladder", () => {
    const catalog = catalogIndexFromHits([
      {
        offerCode: "TSQ01-2",
        slug: "tsq01-2",
        name: "Humidifier on web",
        supplierCode: "P-02",
        categorySlug: "wellness",
        giftTier: "Select",
        priceMin: 850,
        priceMax: 1200,
        minOrder: 10,
        hasPrice: true,
      },
    ]);
    const product = parseFactoryCsv(`sku,name,rmb,per ctn,length,width,height,weight
TSQ01-2,Humidifier set,32,20,47.5,45.5,51,17
`).products[0]!;
    const rows = computePriceBatchRows(
      [product],
      defaultPriceBatchConfig({ cnyToThb: 5, month: 6 }),
      catalog,
      true,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.match, "matched");
    assert.equal(rows[0]!.offerCode, "TSQ01-2");
    assert.ok((rows[0]!.tiers.length ?? 0) >= 5);
    assert.ok(rows[0]!.priceMin && rows[0]!.priceMax);
    assert.ok(rows[0]!.priceMax! >= rows[0]!.priceMin!);
    assert.ok(rows[0]!.cost?.factoryCny === 32);
    assert.match(rows[0]!.formulaNote || "", /รีเช็ค/);
    assert.match(rows[0]!.tiers[0]!.formulaNote || "", /SOF/);
    const hit = matchCatalogHit(product, catalog);
    assert.equal(hit?.offerCode, "TSQ01-2");
    const csv = previewRowsToCsv(rows, true);
    assert.match(csv, /TSQ01-2/);
    assert.match(csv, /factory_cny/);
    assert.match(csv, /formula_check/);
  });

  it("keeps unmatched rows out of apply selection", () => {
    const catalog = catalogIndexFromHits([]);
    const product = parseFactoryCsv(`sku,name,rmb,per ctn,length,width,height,weight
ZZ-99,Unknown,10,10,20,10,10,5
`).products[0]!;
    const rows = computePriceBatchRows(
      [product],
      defaultPriceBatchConfig({ cnyToThb: 5, month: 6 }),
      catalog,
      false,
    );
    assert.equal(rows[0]!.match, "unmatched");
    assert.equal(rows[0]!.selected, false);
    assert.equal(rows[0]!.cost, undefined);
  });

  it("skips commercial A/B/C/D codes instead of matching catalog", () => {
    const catalog = catalogIndexFromHits([
      {
        offerCode: "A00001",
        slug: "a00001",
        name: "Should not match",
        supplierCode: "",
        categorySlug: null,
        giftTier: null,
        priceMin: 100,
        priceMax: 200,
        minOrder: 10,
        hasPrice: true,
      },
    ]);
    const parsed = parseFactoryCsv(`sku,name,rmb,per ctn,length,width,height,weight
A00001,Wrong sellable code,32,20,47.5,45.5,51,17
nt0001,Factory item,32,20,47.5,45.5,51,17
`);
    assert.match(parsed.warnings.join(" "), /รหัสขาย/);
    const rows = computePriceBatchRows(
      parsed.products,
      defaultPriceBatchConfig({ cnyToThb: 5, month: 6 }),
      catalog,
      false,
    );
    assert.equal(rows[0]!.match, "skip");
    assert.match(rows[0]!.warning || "", /รหัสขาย/);
    assert.equal(rows[0]!.selected, false);
    assert.equal(rows[1]!.code, "nt0001");
    assert.equal(rows[1]!.match, "unmatched");
  });

  it("strips formula notes when the actor cannot see factory cost", () => {
    const catalog = catalogIndexFromHits([
      {
        offerCode: "TSQ01-2",
        slug: "tsq01-2",
        name: "Humidifier on web",
        supplierCode: "P-02",
        categorySlug: "wellness",
        giftTier: "Select",
        priceMin: 850,
        priceMax: 1200,
        minOrder: 10,
        hasPrice: true,
      },
    ]);
    const product = parseFactoryCsv(`sku,name,rmb,per ctn,length,width,height,weight
TSQ01-2,Humidifier set,32,20,47.5,45.5,51,17
`).products[0]!;
    const withCost = computePriceBatchRows(
      [product],
      defaultPriceBatchConfig({ cnyToThb: 5, month: 6 }),
      catalog,
      true,
    );
    const stripped = computePriceBatchRows(
      [product],
      defaultPriceBatchConfig({ cnyToThb: 5, month: 6 }),
      catalog,
      false,
    );
    assert.ok(withCost[0]!.formulaNote);
    assert.equal(stripped[0]!.formulaNote, undefined);
    assert.equal(stripped[0]!.tiers[0]!.formulaNote, undefined);
    assert.doesNotMatch(previewRowsToCsv(stripped, false), /formula_check/);
  });
});
