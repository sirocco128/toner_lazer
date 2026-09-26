import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categories, products } from "../lib/data";
import {
  buildCatalogBook,
  catalogPageNumberForSlug,
} from "../lib/catalog-book";
import {
  catalogPdfUrl,
  flipHtml5EmbedUrl,
  flipHtml5PageUrl,
  parseFlipPageParam,
} from "../lib/fliphtml5";
import { toggleCompareItem, COMPARE_LIMIT } from "../lib/product-compare";
import { adaptSmartgiftOffer, type SmartgiftOfferRow } from "../lib/smartgift-products";
import { isThemeId, parseThemeId, THEME_IDS } from "../lib/theme-presets";

describe("theme presets", () => {
  it("accepts the three spec palettes plus the existing forest default", () => {
    assert.deepEqual([...THEME_IDS], ["forest", "navy", "festive", "teal"]);
    assert.equal(isThemeId("navy"), true);
    assert.equal(isThemeId("purple"), false);
    assert.equal(parseThemeId("festive"), "festive");
    assert.equal(parseThemeId("nope"), "forest");
  });
});

describe("FlipHTML5 deep links", () => {
  it("appends #p= for a 1-based page and strips prior hash", () => {
    assert.equal(
      flipHtml5PageUrl("https://online.fliphtml5.com/abcd/book#old", 12),
      "https://online.fliphtml5.com/abcd/book#p=12",
    );
    assert.equal(parseFlipPageParam("12"), 12);
    assert.equal(parseFlipPageParam("p=4"), 4);
    assert.equal(parseFlipPageParam("0"), null);
    assert.equal(flipHtml5EmbedUrl("https://evil.example/flip"), null);
  });

  it("allows https PDF URLs only", () => {
    assert.equal(
      catalogPdfUrl("https://cdn.example.com/catalog.pdf"),
      "https://cdn.example.com/catalog.pdf",
    );
    assert.equal(catalogPdfUrl("http://cdn.example.com/catalog.pdf"), null);
    assert.equal(catalogPdfUrl("javascript:alert(1)"), null);
  });
});

describe("catalog page numbers", () => {
  it("maps a product slug to a 1-based flip page", () => {
    const book = buildCatalogBook({
      products,
      categories,
      title: "สมุด",
      subtitle: "ทดสอบ",
      closingTitle: "ปิด",
      closingBody: "จบ",
    });
    const slug = products[0]!.slug;
    const page = catalogPageNumberForSlug(book.pages, slug);
    assert.ok(page && page >= 1);
    assert.equal(book.pages[page - 1]?.kind, "product");
  });
});

describe("compare list limit", () => {
  it("rejects a fourth item", () => {
    const items = Array.from({ length: COMPARE_LIMIT }, (_, index) => ({
      slug: `p-${index}`,
      name: `P${index}`,
      sku: `S${index}`,
      category: "gift-set",
      image: "",
      material: "—",
      capacity: "—",
      dimensions: "—",
      minOrder: 30,
      priceRange: "สอบถามราคา",
      leadDays: null,
      stockStatus: "สั่งผลิต",
      customization: "สกรีน",
      components: "—",
    }));
    const extra = { ...items[0]!, slug: "p-new", name: "New" };
    const result = toggleCompareItem(items, extra);
    assert.equal(result.added, false);
    assert.equal(result.atLimit, true);
    assert.equal(result.list.length, COMPARE_LIMIT);
  });
});

describe("smartgift offer binding", () => {
  it("exposes SKU, lead time, and itemized components", () => {
    const product = adaptSmartgiftOffer(
      {
        offer_code: "SG-100",
        name: "ชุดกระบอกน้ำ + สมุด + ปากกา",
        gift_tier: "executive",
        supplier_code: null,
        interest_theme: "Corporate Gift Sets",
        interest_theme_slug: "gift-set",
        unboxing_experience: "เปิดกล่องแล้วเห็นโลโก้",
        image_url: "/images/product-tumbler.jpg",
        source_slug: "exec-flask-set",
        lead_days: 21,
        product_family: "drinkware",
        has_price: 1,
        catalog_match_status: "matched",
        min_order: 50,
        price_min: 350,
        price_max: 590,
      } as SmartgiftOfferRow,
      [
        { product_code: "FLASK-01", qty: 1, name_th: "กระบอกสุญญากาศ" },
        { product_code: "NOTE-01", qty: 1, name_th: "สมุดไดอารี่" },
        { product_code: "PEN-01", qty: 1, name_th: "ปากกา" },
      ],
    );
    assert.equal(product.productId, "SG-100");
    assert.equal(product.leadDays, 21);
    assert.equal(product.isBundle, true);
    assert.equal(product.components?.length, 3);
    assert.match(product.components![0]!.name, /กระบอก/);
    assert.equal(product.categoryName, "Corporate Gift Sets");
  });
});
