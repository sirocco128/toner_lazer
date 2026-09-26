import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BundleComponentOption } from "../lib/sku-master-types";

describe("bundle picker DTO", () => {
  it("does not carry component sell prices", () => {
    const option: BundleComponentOption = {
      productId: "A00012",
      nameTh: "กระบอกน้ำ",
      stockClass: "A",
      oriProductCode: "nt0001",
    };
    assert.equal("sellPriceThb" in option, false);
    assert.deepEqual(Object.keys(option).sort(), [
      "nameTh",
      "oriProductCode",
      "productId",
      "stockClass",
    ]);
  });
});
