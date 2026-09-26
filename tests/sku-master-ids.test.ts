import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canMoveToClearance,
  formatProductId,
  isCommercialProductId,
  isSellableBundleClass,
  normalizeOriCode,
  parseProductId,
  uniqueProductIdsInOrder,
} from "../lib/sku-master-ids";
import { SERIAL_STATUS_LABELS, STOCK_CLASS_SHORT } from "../lib/sku-master-types";

describe("sku product ids", () => {
  it("formats independent A/B running numbers", () => {
    assert.equal(formatProductId("A", 1), "A00001");
    assert.equal(formatProductId("B", 1), "B00001");
    assert.equal(formatProductId("C", 3), "C00003");
    assert.deepEqual(parseProductId("A00001"), { stockClass: "A", runningNo: 1 });
    assert.equal(parseProductId("Z00001"), null);
    assert.equal(isCommercialProductId("A00001"), true);
    assert.equal(isCommercialProductId("nt0001"), false);
    assert.equal(isCommercialProductId("TSQ01-2"), false);
  });

  it("allows A/B in bundles and A/B → C moves", () => {
    assert.equal(isSellableBundleClass("A"), true);
    assert.equal(isSellableBundleClass("B"), true);
    assert.equal(isSellableBundleClass("C"), false);
    assert.equal(canMoveToClearance("A"), true);
    assert.equal(canMoveToClearance("C"), false);
    assert.equal(normalizeOriCode(" NT0001 "), "nt0001");
    assert.equal(STOCK_CLASS_SHORT.B, "สั่งผลิต");
    assert.equal(SERIAL_STATUS_LABELS.on_hand, "ในคลัง");
  });

  it("keeps first-seen product_id order when grouping", () => {
    assert.deepEqual(uniqueProductIdsInOrder(["B00002", "A00001", "B00002", "nope", "A00001"]), [
      "B00002",
      "A00001",
    ]);
  });
});
