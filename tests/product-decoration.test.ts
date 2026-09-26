import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decorationOptionsForProduct,
  decorationValuesForProduct,
} from "../lib/product-decoration.js";

describe("product decoration methods", () => {
  it("lists screen print for every known catalog product", () => {
    const slugs = [
      "tumbler-notebook-pen-set",
      "eco-tote-bamboo-set",
      "it-powerbank-set",
    ];
    for (const slug of slugs) {
      const values = decorationValuesForProduct(slug);
      assert.ok(values.includes("screen-print") || values.includes("laser"));
      const options = decorationOptionsForProduct(slug);
      assert.equal(options.length, values.length);
      assert.ok(options.every((item) => item.label.length > 0));
    }
  });

  it("falls back to all logo methods for unknown slugs", () => {
    const values = decorationValuesForProduct("custom-new-set");
    assert.deepEqual(values, [
      "screen-print",
      "emboss",
      "laser",
      "full-color",
      "uv-print",
      "embroidery",
    ]);
  });

  it("eco set prefers fabric methods", () => {
    assert.deepEqual(decorationValuesForProduct("eco-tote-bamboo-set"), [
      "screen-print",
      "embroidery",
      "uv-print",
      "full-color",
    ]);
  });
});
