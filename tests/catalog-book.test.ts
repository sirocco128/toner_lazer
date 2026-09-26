import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categories, products } from "../lib/data";
import {
  OTHER_CATALOG_GROUP_SLUG,
  buildCatalogBook,
  groupCatalogProducts,
} from "../lib/catalog-book";
import { flipHtml5EmbedUrl } from "../lib/fliphtml5";

describe("catalog book grouping", () => {
  it("keeps category order and only groups that have products", () => {
    const groups = groupCatalogProducts(products, categories);
    assert.ok(groups.length >= 1);
    const slugs = groups.map((group) => group.slug);
    const categoryOrder = categories.map((item) => item.slug);
    const filtered = categoryOrder.filter((slug) => slugs.includes(slug));
    assert.deepEqual(
      slugs.filter((slug) => slug !== OTHER_CATALOG_GROUP_SLUG),
      filtered,
    );
    assert.equal(
      groups.reduce((sum, group) => sum + group.products.length, 0),
      products.length,
    );
  });

  it("filters to one product group", () => {
    const groups = groupCatalogProducts(products, categories, "eco-giftset");
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.slug, "eco-giftset");
    assert.ok(groups[0]!.products.every((item) => item.categorySlug === "eco-giftset"));
  });

  it("puts unknown-category products in the other group", () => {
    const extra = {
      ...products[0]!,
      slug: "loose-item",
      categorySlug: "not-a-real-category",
    };
    const groups = groupCatalogProducts([...products, extra], categories);
    const other = groups.find((group) => group.slug === OTHER_CATALOG_GROUP_SLUG);
    assert.ok(other);
    assert.equal(other!.products.some((item) => item.slug === "loose-item"), true);
  });

  it("builds cover, section, product, and closing pages", () => {
    const book = buildCatalogBook({
      products,
      categories,
      title: "สมุดแคตตาล็อก",
      subtitle: "สกรีนโลโก้ได้",
      closingTitle: "ขอใบเสนอราคา",
      closingBody: "ไม่มีการชำระเงินบนเว็บ",
    });
    assert.equal(book.pages[0]?.kind, "cover");
    assert.equal(book.pages.at(-1)?.kind, "closing");
    assert.ok(book.pages.some((page) => page.kind === "section"));
    assert.ok(book.pages.some((page) => page.kind === "product"));
    const productPages = book.pages.filter((page) => page.kind === "product");
    assert.equal(productPages.length, products.length);
  });

  it("skips extra section pages when viewing a single group", () => {
    const book = buildCatalogBook({
      products,
      categories,
      filterSlug: "it-set",
      title: "สมุดแคตตาล็อก",
      subtitle: "สกรีนโลโก้ได้",
      closingTitle: "ขอใบเสนอราคา",
      closingBody: "ไม่มีการชำระเงินบนเว็บ",
    });
    assert.equal(book.filterSlug, "it-set");
    assert.equal(
      book.pages.filter((page) => page.kind === "section").length,
      0,
    );
  });
});

describe("FlipHTML5 embed URL", () => {
  it("allows FlipHTML5 hosts only", () => {
    assert.equal(
      flipHtml5EmbedUrl("https://online.fliphtml5.com/abcd/book"),
      "https://online.fliphtml5.com/abcd/book",
    );
    assert.equal(
      flipHtml5EmbedUrl("https://fliphtml5.com/homepage/xyz/"),
      "https://fliphtml5.com/homepage/xyz/",
    );
    assert.equal(flipHtml5EmbedUrl("https://evil.example/flip"), null);
    assert.equal(flipHtml5EmbedUrl("javascript:alert(1)"), null);
    assert.equal(flipHtml5EmbedUrl(""), null);
  });
});
