import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyProductKind,
  productLabelFromParts,
  PRODUCT_KIND_LABELS,
} from "../lib/product-kind";

describe("product kind classification (customer sales history)", () => {
  it("maps catalog slugs to gift-set types", () => {
    assert.equal(
      classifyProductKind({ productSlug: "tumbler-notebook-pen-set" }),
      "tumbler",
    );
    assert.equal(
      classifyProductKind({ productSlug: "eco-tote-bamboo-set" }),
      "eco",
    );
    assert.equal(
      classifyProductKind({ productSlug: "it-powerbank-set" }),
      "it",
    );
    assert.equal(classifyProductKind({ productSlug: "tumbler-set" }), "tumbler");
  });

  it("reads Thai product names when there is no slug", () => {
    assert.equal(
      classifyProductKind({ productSummary: "กระบอกน้ำสแตนเลสสกรีนโลโก้" }),
      "tumbler",
    );
    assert.equal(
      classifyProductKind({ productInterest: "แฟลชไดร์ฟ + พาวเวอร์แบงก์" }),
      "it",
    );
    assert.equal(
      classifyProductKind({ productSummary: "ถุงผ้ารักษ์โลกงาน ESG" }),
      "eco",
    );
    assert.equal(classifyProductKind({ productSummary: "งานสั่งผลิตทั่วไป" }), "other");
  });

  it("prefers named interest for the display label", () => {
    assert.equal(
      productLabelFromParts({
        productSlug: "tumbler-notebook-pen-set",
        productInterest: "ชุดต้อนรับพนักงานใหม่",
        productSummary: "สินค้าสั่งผลิตสกรีนโลโก้",
      }),
      "ชุดต้อนรับพนักงานใหม่",
    );
    assert.match(
      productLabelFromParts({ productSlug: "tumbler-notebook-pen-set" }),
      /กระบอกน้ำ/,
    );
    assert.equal(PRODUCT_KIND_LABELS.tumbler, "กระบอกน้ำ / แก้ว");
  });
});
