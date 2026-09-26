import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adaptSmartgiftOffer,
  canonicalCategorySlug,
  formatThbRange,
  offerCodeToSlug,
  type SmartgiftOfferRow,
} from "../lib/smartgift-products";

describe("smartgift catalog adapter", () => {
  it("turns offer codes into URL slugs", () => {
    assert.equal(offerCodeToSlug("TSQ01-2"), "tsq01-2");
    assert.equal(offerCodeToSlug("TGC06-4"), "tgc06-4");
  });

  it("maps legacy category slugs onto the live SmartGift catalog", () => {
    assert.equal(canonicalCategorySlug("eco-friendly"), "eco");
    assert.equal(canonicalCategorySlug("eco-giftset"), "eco");
    assert.equal(canonicalCategorySlug("drinkware"), "drinkware");
  });

  it("formats a THB qty ladder as a range", () => {
    assert.equal(formatThbRange(890, 1180), "890–1,180 บาท");
    assert.equal(formatThbRange(850, 850), "850 บาท");
  });

  it("maps TSQ01-2 header + BOM + prices to a public product", () => {
    const row = {
      offer_code: "TSQ01-2",
      name: "Light เครื่องทำความชื้น + เครื่องนวดคอ TSQ01-2(P-02)",
      gift_tier: "Select",
      supplier_code: "P-02",
      interest_theme: "Novelty & Self-Care (Warm & Wellness)",
      interest_theme_slug: "novelty-self-care",
      unboxing_experience: "ชุดของขวัญสัมผัสพรีเมียมจากซัพพลายเออร์ P-02",
      product_family: "PF-NOVELTY-WELLNESS",
      has_price: 1,
      catalog_match_status: "TSQ01-2",
      min_order: 10,
      price_min: 890,
      price_max: 1180,
    } as SmartgiftOfferRow;

    const product = adaptSmartgiftOffer(row, [
      { product_code: "PM-MSG", qty: 1, name_th: "เครื่องนวดคอพกพา" },
      { product_code: "PM-PB10K", qty: 1, name_th: "พาวเวอร์แบงก์ 10000mAh" },
    ]);

    assert.equal(product.slug, "tsq01-2");
    assert.equal(product.categorySlug, "novelty-self-care");
    assert.equal(product.minOrder, 10);
    assert.equal(product.priceMin, 890);
    assert.equal(product.priceMax, 1180);
    assert.equal(product.priceRange, "890–1,180 บาท");
    assert.equal(product.seo.canonicalPath, "/products/tsq01-2");
    assert.match(product.description, /เครื่องนวดคอพกพา/);
  });

  it("uses the live website slug and photo when present", () => {
    const row = {
      offer_code: "TDD03-2",
      name: "ชุดแก้วทัมเบลอร์และลำโพงสเตอริโอคู่",
      gift_tier: null,
      supplier_code: "WEB",
      interest_theme: "ชุดของขวัญ",
      interest_theme_slug: "gift-set",
      unboxing_experience: null,
      image_url: "https://smartgiftthailand.com/assets/products/tdd03-2.jpg",
      source_slug: "tumbler-stereo-speaker-set",
      lead_days: 30,
      product_family: "gift-set",
      has_price: 1,
      catalog_match_status: "website",
      min_order: 10,
      price_min: 470,
      price_max: 680,
    } as SmartgiftOfferRow;

    const product = adaptSmartgiftOffer(row, []);
    assert.equal(product.slug, "tumbler-stereo-speaker-set");
    assert.equal(product.images[0], "https://smartgiftthailand.com/assets/products/tdd03-2.jpg");
    assert.equal(product.seo.canonicalPath, "/products/tumbler-stereo-speaker-set");
    assert.equal(product.priceRange, "470–680 บาท");
  });
});
