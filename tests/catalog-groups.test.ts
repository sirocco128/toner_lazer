import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogGroupQuoteHref,
  productMatchesCatalogGroup,
  resolveCatalogGroup,
} from "../lib/catalog-groups";
import { DECORATION_METHODS, DECORATION_METHOD_OPTIONS } from "../lib/quote-types";

const tumbler = { slug: "tumbler-notebook-pen-set", categorySlug: "tumbler-set" };
const eco = { slug: "eco-tote-bamboo-set", categorySlug: "eco-giftset" };
const tech = { slug: "it-powerbank-set", categorySlug: "it-set" };

describe("catalog groups", () => {
  it("opens each poster category on its own product filter", () => {
    assert.equal(resolveCatalogGroup("drinkware")?.title, "แก้วน้ำและกระบอกน้ำ");
    assert.equal(resolveCatalogGroup("tumbler-set")?.slug, "drinkware");
    assert.equal(resolveCatalogGroup("eco-giftset")?.slug, "eco");
    assert.equal(resolveCatalogGroup("it-set")?.slug, "technology");
    assert.equal(resolveCatalogGroup("bag")?.slug, "bag");
    assert.equal(resolveCatalogGroup("clearance"), null);
  });

  it("keeps sample sets inside the groups they actually belong to", () => {
    const drinkware = resolveCatalogGroup("drinkware");
    const bag = resolveCatalogGroup("bag");
    const ecoGroup = resolveCatalogGroup("eco");
    const technology = resolveCatalogGroup("technology");
    const giftSet = resolveCatalogGroup("gift-set");
    const apparel = resolveCatalogGroup("apparel");
    assert.ok(drinkware && productMatchesCatalogGroup(tumbler, drinkware));
    assert.equal(productMatchesCatalogGroup(eco, drinkware!), false);
    assert.ok(bag && productMatchesCatalogGroup(eco, bag));
    assert.ok(ecoGroup && productMatchesCatalogGroup(eco, ecoGroup));
    assert.ok(technology && productMatchesCatalogGroup(tech, technology));
    assert.ok(giftSet && productMatchesCatalogGroup(tumbler, giftSet));
    assert.ok(giftSet && productMatchesCatalogGroup(eco, giftSet));
    assert.ok(giftSet && productMatchesCatalogGroup(tech, giftSet));
    assert.ok(apparel && !productMatchesCatalogGroup(tumbler, apparel));
    const quoteHref = decodeURIComponent(catalogGroupQuoteHref(apparel!));
    assert.match(quoteHref, /^\/contact\?product=/);
    assert.match(quoteHref, /เสื้อผ้าและยูนิฟอร์ม/);
  });
});

describe("quote decoration methods", () => {
  it("offers emboss and full-color beside the existing logo methods", () => {
    assert.ok(DECORATION_METHODS.includes("emboss"));
    assert.ok(DECORATION_METHODS.includes("full-color"));
    assert.deepEqual(
      DECORATION_METHOD_OPTIONS.map((item) => item.value).sort(),
      [...DECORATION_METHODS].sort(),
    );
    assert.equal(
      DECORATION_METHOD_OPTIONS.find((item) => item.value === "emboss")?.label,
      "ปั๊มนูน",
    );
    assert.equal(
      DECORATION_METHOD_OPTIONS.find((item) => item.value === "full-color")?.label,
      "พิมพ์สี",
    );
  });
});
