import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addItem,
  approximatePriceSum,
  buildContactHrefFromBasket,
  createEmptyBasket,
  formatBasketProductInterest,
  lockUnitEstimate,
  PRICING_SNAPSHOT_VERSION,
  resolveAddQuantity,
  resolveLockedMinQty,
  totalBasketQuantity,
  updateQuantity,
} from "../lib/quote-basket.js";
import {
  quoteBasketAddLabel,
  quoteBasketAddedLabel,
  quoteBasketLockNote,
} from "../lib/ux-copy.js";

describe("quote basket min-order lock", () => {
  it("defaults add qty to catalog / SKU min-order", () => {
    assert.equal(resolveLockedMinQty(10), 10);
    assert.equal(resolveLockedMinQty(undefined), 1);
    assert.equal(resolveAddQuantity({ minOrder: 10 }), 10);
    assert.equal(resolveAddQuantity({ minOrder: 10, quantity: 1 }), 10);
    assert.equal(resolveAddQuantity({ minOrder: 10, quantity: 50 }), 50);
  });

  it("locks the displayed unit price band", () => {
    assert.deepEqual(lockUnitEstimate({ estimatedUnitMin: 470, estimatedUnitMax: 690 }), {
      estimatedUnitMin: 470,
      estimatedUnitMax: 690,
    });
    assert.deepEqual(lockUnitEstimate({ estimatedUnitMin: 690, estimatedUnitMax: 470 }), {
      estimatedUnitMin: 470,
      estimatedUnitMax: 690,
    });
  });

  it("adds a line at min-order with frozen price", () => {
    const basket = addItem(createEmptyBasket(), {
      productSlug: "hanging-neck-fan-df1420",
      productName: "พัดลมห้อยคอ DF1420",
      skuCode: "DF1420",
      minOrder: 10,
      estimatedUnitMin: 470,
      estimatedUnitMax: 690,
    });
    assert.equal(basket.items.length, 1);
    const item = basket.items[0]!;
    assert.equal(item.quantity, 10);
    assert.equal(item.lockedMinQty, 10);
    assert.equal(item.skuCode, "DF1420");
    assert.equal(item.estimatedUnitMin, 470);
    assert.equal(item.estimatedUnitMax, 690);
    assert.equal(item.pricingSnapshotVersion, PRICING_SNAPSHOT_VERSION);

    const totals = approximatePriceSum(basket);
    assert.equal(totals.hasEstimates, true);
    assert.equal(totals.min, 4700);
    assert.equal(totals.max, 6900);
  });

  it("adds another min-order lot without rewriting the locked price", () => {
    const first = addItem(createEmptyBasket(), {
      productSlug: "fan",
      productName: "Fan",
      minOrder: 10,
      estimatedUnitMin: 470,
      estimatedUnitMax: 690,
    });
    const second = addItem(first, {
      productSlug: "fan",
      productName: "Fan",
      minOrder: 10,
      estimatedUnitMin: 100,
      estimatedUnitMax: 200,
    });
    assert.equal(second.items.length, 1);
    assert.equal(second.items[0]!.quantity, 20);
    assert.equal(second.items[0]!.lockedMinQty, 10);
    assert.equal(second.items[0]!.estimatedUnitMin, 470);
    assert.equal(second.items[0]!.estimatedUnitMax, 690);
  });

  it("refuses to drop quantity below the locked min", () => {
    const basket = addItem(createEmptyBasket(), {
      productSlug: "fan",
      productName: "Fan",
      minOrder: 10,
      estimatedUnitMin: 470,
      estimatedUnitMax: 690,
    });
    const itemId = basket.items[0]!.id;
    const raised = updateQuantity(basket, itemId, 30);
    assert.equal(raised.items[0]!.quantity, 30);
    const clamped = updateQuantity(raised, itemId, 3);
    assert.equal(clamped.items[0]!.quantity, 10);
  });

  it("puts locked qty and price into the contact note", () => {
    const basket = addItem(createEmptyBasket(), {
      productSlug: "fan",
      productName: "Fan",
      skuCode: "DF1420",
      minOrder: 10,
      estimatedUnitMin: 470,
      estimatedUnitMax: 690,
    });
    const href = buildContactHrefFromBasket(basket);
    const note = new URL(href, "https://example.local").searchParams.get("note") || "";
    assert.match(note, /รหัส DF1420/);
    assert.match(note, /× 10/);
    assert.match(note, /ราคาล็อก/);
    assert.match(note, /ขั้นต่ำล็อก 10/);
  });

  it("joins every basket line into productInterest and sums quantity", () => {
    const first = addItem(createEmptyBasket(), {
      productSlug: "fan",
      productName: "พัดลมห้อยคอ",
      skuCode: "DF1420",
      minOrder: 10,
      estimatedUnitMin: 470,
      estimatedUnitMax: 690,
    });
    const basket = addItem(first, {
      productSlug: "humidifier-cat",
      productName: "เครื่องทำความชื้น(แมว)",
      skuCode: "DS0260",
      minOrder: 10,
      quantity: 11,
      estimatedUnitMin: 440,
      estimatedUnitMax: 650,
    });
    assert.equal(basket.items.length, 2);
    assert.equal(totalBasketQuantity(basket.items), 21);
    assert.equal(
      formatBasketProductInterest(basket.items),
      "พัดลมห้อยคอ DF1420 × 10 · เครื่องทำความชื้น(แมว) DS0260 × 11",
    );

    const href = buildContactHrefFromBasket(basket);
    const params = new URL(href, "https://example.local").searchParams;
    assert.match(params.get("productInterest") || "", /พัดลมห้อยคอ/);
    assert.match(params.get("productInterest") || "", /เครื่องทำความชื้น/);
    assert.equal(params.get("quantity"), "21");
    assert.equal(params.get("productSlug"), null);
  });

  it("truncates a long product-interest list with a remainder count", () => {
    const items = [
      {
        id: "a",
        basketId: "qb",
        productSlug: "a",
        productName: "สินค้าสั้น",
        quantity: 10,
        lockedMinQty: 10,
      },
      {
        id: "b",
        basketId: "qb",
        productSlug: "b",
        productName: "B".repeat(120),
        quantity: 5,
        lockedMinQty: 1,
      },
    ];
    const summary = formatBasketProductInterest(items, 80);
    assert.match(summary, /สินค้าสั้น/);
    assert.match(summary, /และอีก 1 รายการ/);
    assert.ok(summary.length <= 80);
  });

  it("buyer add copy names the locked set count without jargon", () => {
    assert.equal(quoteBasketAddLabel(10), "เพิ่ม 10 ชุดเข้าตะกร้าใบเสนอราคา");
    assert.match(quoteBasketAddedLabel(10), /10 ชุด/);
    assert.match(quoteBasketLockNote(10), /ล็อกจำนวนขั้นต่ำ 10 ชุด/);
    assert.doesNotMatch(quoteBasketLockNote(10), /\b(MOQ|SKU|RFQ)\b/);
  });
});
