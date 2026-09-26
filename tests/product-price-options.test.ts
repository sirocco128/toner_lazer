import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PACKAGING_MAX_THB,
  DEFAULT_PACKAGING_MIN_THB,
  applyProductPriceOptions,
  canToggleChinaFreight,
} from "../lib/product-price-options";

const BAND = {
  priceMin: 569,
  priceMax: 1048,
  priceExFreightMin: 500,
  priceExFreightMax: 900,
  packagingMin: DEFAULT_PACKAGING_MIN_THB,
  packagingMax: DEFAULT_PACKAGING_MAX_THB,
};

describe("product price options", () => {
  it("keeps loaded China-freight prices when packaging is off", () => {
    const priced = applyProductPriceOptions(BAND, {
      includeFreight: true,
      includePackaging: false,
    });
    assert.equal(priced.priceMin, 569);
    assert.equal(priced.priceMax, 1048);
    assert.equal(priced.priceRange, "569–1048 บาท/ชุด");
  });

  it("folds packaging into the unit price when รวมแพ็ค is on", () => {
    const priced = applyProductPriceOptions(BAND, {
      includeFreight: true,
      includePackaging: true,
    });
    assert.equal(priced.priceMin, 569 + DEFAULT_PACKAGING_MIN_THB);
    assert.equal(priced.priceMax, 1048 + DEFAULT_PACKAGING_MAX_THB);
  });

  it("can drop China freight when a split band exists", () => {
    assert.equal(canToggleChinaFreight(BAND), true);
    const priced = applyProductPriceOptions(BAND, {
      includeFreight: false,
      includePackaging: false,
    });
    assert.equal(priced.priceMin, 500);
    assert.equal(priced.priceMax, 900);
  });

  it("combines ex-freight + packaging", () => {
    const priced = applyProductPriceOptions(BAND, {
      includeFreight: false,
      includePackaging: true,
    });
    assert.equal(priced.priceMin, 500 + DEFAULT_PACKAGING_MIN_THB);
    assert.equal(priced.priceMax, 900 + DEFAULT_PACKAGING_MAX_THB);
  });

  it("does not drop freight when split prices are missing", () => {
    const band = { priceMin: 350, priceMax: 590 };
    assert.equal(canToggleChinaFreight(band), false);
    const priced = applyProductPriceOptions(band, {
      includeFreight: false,
      includePackaging: false,
    });
    assert.equal(priced.priceMin, 350);
    assert.equal(priced.priceMax, 590);
  });
});
