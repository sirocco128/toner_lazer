import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cn } from "../lib/utils";
import {
  categoryTabLabel,
  isUsableImageSrc,
  productCoverImage,
  PRODUCT_IMAGE_FALLBACK,
  skuOpsImageSrc,
} from "../lib/product-media";

describe("cn()", () => {
  it("merges conflicting Tailwind classes", () => {
    const merged = cn("px-2 py-1", "px-4");
    assert.equal(merged.includes("px-4"), true);
    assert.equal(merged.includes("px-2"), false);
    assert.equal(merged.includes("py-1"), true);
  });
});

describe("product catalog images", () => {
  it("falls back when images are missing or empty", () => {
    assert.equal(productCoverImage([]), PRODUCT_IMAGE_FALLBACK);
    assert.equal(productCoverImage(["", "  "]), PRODUCT_IMAGE_FALLBACK);
    assert.equal(isUsableImageSrc(""), false);
    assert.equal(
      productCoverImage(["/images/product-tumbler.jpg"]),
      "/images/product-tumbler.jpg",
    );
  });

  it("uses a category mockup when the product has no photo", () => {
    assert.equal(
      productCoverImage([], "it-set"),
      "/images/product-it-set.jpg",
    );
    assert.equal(categoryTabLabel("it-set", "Gift Set อุปกรณ์ไอที"), "ไอที");
    assert.equal(
      productCoverImage([], "executive-smart-tech"),
      "/images/product-it-set.jpg",
    );
    assert.equal(categoryTabLabel("eco-friendly", "Eco"), "รักษ์โลก");
  });

  it("ops SKU thumbs use a real URL or the licensed placeholder, never a category mockup", () => {
    assert.equal(skuOpsImageSrc(""), PRODUCT_IMAGE_FALLBACK);
    assert.equal(skuOpsImageSrc(null, "  "), PRODUCT_IMAGE_FALLBACK);
    assert.equal(
      skuOpsImageSrc("", "https://smartgiftthailand.com/assets/products/tdd03-2.jpg"),
      "https://smartgiftthailand.com/assets/products/tdd03-2.jpg",
    );
    assert.equal(
      skuOpsImageSrc("/images/saved.jpg", "https://offer.example/x.jpg"),
      "/images/saved.jpg",
    );
    assert.notEqual(skuOpsImageSrc(""), "/images/product-it-set.jpg");
  });
});
