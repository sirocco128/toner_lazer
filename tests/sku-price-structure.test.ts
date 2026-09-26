import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeForcedMinQty } from "../lib/alibaba/forced-min-qty";
import {
  parsePriceProfile,
  PRICE_STRUCTURE_QTYS,
  skuPriceStructure,
  stepForQty,
  type SkuPriceInputs,
} from "../lib/sku-price-structure";

function sku(overrides: Partial<SkuPriceInputs> = {}): SkuPriceInputs {
  return {
    stockClass: "B",
    isBundle: false,
    sellPriceThb: null,
    factoryUnitCny: null,
    factoryUnitUsd: null,
    unitLandedCostThb: null,
    forcedMinQty: null,
    ...overrides,
  };
}

describe("sku price structure", () => {
  it("parses corporate profile from the list query", () => {
    assert.equal(parsePriceProfile("corporate"), "corporate");
    assert.equal(parsePriceProfile("standard"), "standard");
    assert.equal(parsePriceProfile(""), "standard");
  });

  it("builds the standard qty ladder from stored landed cost", () => {
    const structure = skuPriceStructure(sku({ unitLandedCostThb: 50 }));
    const expected = computeForcedMinQty({ unitLandedCostThb: 50 });
    assert.equal(structure.kind, "ladder");
    assert.deepEqual(
      structure.steps.map((step) => step.qty),
      [...PRICE_STRUCTURE_QTYS],
    );
    assert.equal(structure.forcedMinQty, expected.forcedMinQty);
    assert.equal(stepForQty(structure, expected.forcedMinQty)?.isForcedMin, true);
    assert.equal(stepForQty(structure, 10)?.meetsFloor, false);
    assert.equal(stepForQty(structure, 10)?.sellThb, expected.steps[0]!.sellThb);
    assert.match(stepForQty(structure, 10)?.formulaNote || "", /ลงเรือ 50\.00/);
    assert.match(structure.note, /SOF/);
  });

  it("highlights the stored forced minimum even if the live ladder would differ", () => {
    const structure = skuPriceStructure(
      sku({ unitLandedCostThb: 50, forcedMinQty: 100 }),
    );
    assert.equal(structure.forcedMinQty, 100);
    assert.equal(stepForQty(structure, 100)?.isForcedMin, true);
    assert.equal(stepForQty(structure, 50)?.isForcedMin, false);
  });

  it("fills only corporate breaks when the corporate profile is selected", () => {
    const structure = skuPriceStructure(sku({ unitLandedCostThb: 50 }), "corporate");
    assert.deepEqual(
      structure.steps.map((step) => step.qty),
      [100, 300, 500, 1000],
    );
    assert.equal(stepForQty(structure, 10), undefined);
  });

  it("uses a single clearance price instead of the production ladder", () => {
    const structure = skuPriceStructure(
      sku({
        stockClass: "C",
        sellPriceThb: 120,
        unitLandedCostThb: 50,
      }),
    );
    assert.equal(structure.kind, "fixed");
    assert.equal(structure.sellPriceThb, 120);
    assert.equal(structure.steps.length, 0);
  });

  it("uses the bundle sell price without component ladders", () => {
    const structure = skuPriceStructure(
      sku({ isBundle: true, sellPriceThb: 890, unitLandedCostThb: 50 }),
    );
    assert.equal(structure.kind, "fixed");
    assert.equal(structure.sellPriceThb, 890);
    assert.equal(structure.steps.length, 0);
  });

  it("stays empty until cost conditions are entered", () => {
    const structure = skuPriceStructure(sku());
    assert.equal(structure.kind, "empty");
    assert.match(structure.note, /ต้นทุน/);
  });
});
