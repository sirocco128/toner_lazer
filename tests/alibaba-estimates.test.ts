import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sign1688Request, parse1688ProductPayload } from "../lib/alibaba/client";
import { extractOfferImages } from "../lib/alibaba/images";
import {
  computePublicPriceRange,
  computeQuoteLadder,
  computeUnitLanded,
  defaultLandedCostConfig,
  factoryCnyForQty,
  markupForLandedCost,
  quoteQtyBreaks,
  quoteSellWithOptions,
  smallOrderFactor,
} from "../lib/alibaba/landed-cost";
import { parseOffer, parseOffersDocument } from "../lib/alibaba/offers";
import { overlayOfferOnProduct, overlayOffersOnProducts } from "../lib/alibaba/overlay";
import { internationalFreightThb, membershipTier, selectFreightMode } from "../lib/alibaba/shipping";
import type { AlibabaOffer } from "../lib/alibaba/types";
import type { Product } from "../lib/data";

const SAMPLE_OFFER: AlibabaOffer = {
  slug: "tumbler-notebook-pen-set",
  offerId: "111",
  origin: "guangzhou_shenzhen",
  category: "general",
  minOrder: 30,
  factoryMinCny: 20,
  factoryMaxCny: 20,
  weightKg: 0.5,
  lengthCm: 20,
  widthCm: 10,
  heightCm: 10,
  bulkQty: 300,
};

const juneConfig = defaultLandedCostConfig({
  cnyToThb: 5,
  month: 6,
  inlandRateCnyPerCbm: 150,
  inlandMinCny: 50,
});

function sampleProduct(overrides: Partial<Product> = {}): Product {
  return {
    name: "เซ็ตทดสอบ",
    slug: "tumbler-notebook-pen-set",
    description: "รายละเอียด",
    material: "สแตนเลส",
    minOrder: 30,
    priceRange: "350–590 บาท/ชุด",
    priceMin: 350,
    priceMax: 590,
    currency: "THB",
    images: ["/images/product-tumbler.svg"],
    categorySlug: "tumbler-set",
    seo: {
      seoTitle: "เซ็ตทดสอบ",
      metaDescription: "x".repeat(120),
      canonicalPath: "/products/tumbler-notebook-pen-set",
    },
    ...overrides,
  };
}

describe("1688 shipping", () => {
  it("uses CBM when density is under 400 kg/CBM", () => {
    const result = internationalFreightThb(
      0.06,
      15,
      "guangzhou_shenzhen",
      "truck",
      "general",
      { densityThresholdKgPerCbm: 400, minChargeableCbm: 0.01 },
    );
    assert.equal(result.tier, "MEMBER");
    assert.equal(result.thb, 444);
  });

  it("uses kg when density is over 400 kg/CBM", () => {
    const result = internationalFreightThb(
      0.01,
      10,
      "guangzhou_shenzhen",
      "truck",
      "general",
      { densityThresholdKgPerCbm: 400, minChargeableCbm: 0.01 },
    );
    assert.equal(result.thb, 190);
  });

  it("applies sea threshold and peak-season truck override", () => {
    assert.equal(selectFreightMode(5, { month: 6, seaThresholdCbm: 5 }), "sea");
    assert.equal(selectFreightMode(5, { month: 11, seaThresholdCbm: 5 }), "truck");
    assert.equal(membershipTier(1, 0), "SILVER");
    assert.equal(membershipTier(0.5, 0), "MEMBER");
  });
});

describe("1688 landed cost", () => {
  it("applies SOF and markup bands", () => {
    assert.equal(smallOrderFactor(30), 1.4);
    assert.equal(smallOrderFactor(300), 1.2);
    assert.equal(markupForLandedCost(120), 3);
    assert.equal(markupForLandedCost(400), 2.62);
  });

  it("computes public THB min/max with China freight folded in", () => {
    const range = computePublicPriceRange(SAMPLE_OFFER, juneConfig);
    assert.ok(range);
    assert.equal(range!.currency, "THB");
    assert.equal(range!.minOrder, 30);
    assert.ok(range!.priceMax >= range!.priceMin);
    assert.equal(range!.priceMin, 419);
    assert.equal(range!.priceMax, 517);
    assert.equal(range!.priceRange, "419–517 บาท/ชุด");
    assert.ok(range!.priceExFreightMin <= range!.priceMin);
    assert.ok(range!.priceExFreightMax <= range!.priceMax);
    assert.equal(range!.packagingMin, 45);
    assert.equal(range!.packagingMax, 85);
    const ladder = computeQuoteLadder(SAMPLE_OFFER, [30, 300], juneConfig);
    assert.ok(ladder);
    assert.equal(ladder![0]!.landed.sellThb, range!.priceMax);
    assert.equal(ladder![1]!.landed.sellThb, range!.priceMin);
    assert.equal(
      "factoryCny" in range! || "dutyThb" in range!,
      false,
    );
  });

  it("computes a quantity ladder with the same engine as the public band", () => {
    const unit = computeUnitLanded(SAMPLE_OFFER, 30, 20, juneConfig);
    const ladder = computeQuoteLadder(SAMPLE_OFFER, [30, 300], juneConfig);
    assert.ok(unit);
    assert.ok(ladder);
    assert.equal(ladder!.length, 2);
    assert.equal(ladder![0]!.landed.sellThb, unit!.sellThb);
    assert.equal(ladder![0]!.factoryCny, 20);
    assert.equal(ladder![1]!.qty, 300);
    assert.ok(ladder![1]!.landed.sellThb <= ladder![0]!.landed.sellThb);
  });

  it("picks factory min at bulk qty and max below bulk", () => {
    const offer = {
      ...SAMPLE_OFFER,
      factoryMinCny: 18,
      factoryMaxCny: 24,
      bulkQty: 300,
    };
    assert.equal(factoryCnyForQty(offer, 30), 24);
    assert.equal(factoryCnyForQty(offer, 300), 18);
    assert.deepEqual(quoteQtyBreaks(30), [30, 50, 100, 300, 500, 1000]);
  });

  it("adds packaging the same way as the public product toggle", () => {
    const unit = computeUnitLanded(SAMPLE_OFFER, 30, 20, juneConfig);
    assert.ok(unit);
    const withPack = quoteSellWithOptions(unit, {
      includeFreight: true,
      includePackaging: true,
    });
    assert.equal(withPack.sellThb, unit.sellThb + 45);
    const exFreight = quoteSellWithOptions(unit, {
      includeFreight: false,
      includePackaging: false,
    });
    assert.equal(exFreight.sellThb, unit.sellExFreightThb);
  });

  it("freight raises unit cost versus factory-only", () => {
    const unit = computeUnitLanded(SAMPLE_OFFER, 30, 20, juneConfig);
    assert.ok(unit);
    assert.ok(unit!.freightThb > 0);
    assert.ok(unit!.sellExFreightThb < unit!.sellThb);
    assert.ok(unit!.inlandThb > 0);
    assert.ok(unit!.landedCostThb > unit!.factoryThb);
    assert.equal(unit!.mode, "truck");
  });

  it("skips overlay when weight and dims are missing", () => {
    const range = computePublicPriceRange(
      {
        slug: "x",
        offerId: "1",
        minOrder: 30,
        factoryMinCny: 10,
        factoryMaxCny: 12,
      },
      juneConfig,
    );
    assert.equal(range, null);
  });
});

describe("1688 images", () => {
  it("keeps https alicdn URLs and drops the rest", () => {
    const urls = extractOfferImages([
      "https://cbu01.alicdn.com/kf/ok.jpg",
      "http://cbu01.alicdn.com/kf/upgrade.jpg",
      "javascript:alert(1)",
      "https://evil.example/x.jpg",
      { url: "https://img.alicdn.com/imgextra/a.png" },
    ]);
    assert.ok(urls.includes("https://cbu01.alicdn.com/kf/ok.jpg"));
    assert.ok(urls.some((url) => url.includes("upgrade.jpg")));
    assert.ok(urls.includes("https://img.alicdn.com/imgextra/a.png"));
    assert.equal(urls.some((url) => url.includes("evil")), false);
    assert.equal(urls.some((url) => url.startsWith("javascript:")), false);
  });

  it("caps at 8 unique URLs", () => {
    const input = Array.from({ length: 12 }, (_, i) => `https://cbu01.alicdn.com/kf/${i}.jpg`);
    assert.equal(extractOfferImages(input).length, 8);
  });
});

describe("1688 overlay", () => {
  it("leaves product unchanged when estimates are off", () => {
    const prev = process.env.ALIBABA_ESTIMATES_ENABLED;
    process.env.ALIBABA_ESTIMATES_ENABLED = "false";
    const product = sampleProduct();
    const next = overlayOffersOnProducts([product], [SAMPLE_OFFER]);
    assert.equal(next[0]!.priceMin, 350);
    assert.deepEqual(next[0]!.images, product.images);
    process.env.ALIBABA_ESTIMATES_ENABLED = prev;
  });

  it("replaces prices but keeps CMS images by default", () => {
    const product = sampleProduct();
    const offer = {
      ...SAMPLE_OFFER,
      imageUrls: ["https://cbu01.alicdn.com/kf/live.jpg"],
    };
    const next = overlayOfferOnProduct(product, offer, { applyImages: false });
    assert.equal(next.priceMin, 419);
    assert.equal(next.priceMax, 517);
    assert.deepEqual(next.images, product.images);
  });

  it("appends allowlisted alicdn after CMS when image flags are on", () => {
    const product = sampleProduct();
    const offer = {
      ...SAMPLE_OFFER,
      imageUrls: ["https://cbu01.alicdn.com/kf/live.jpg"],
    };
    const next = overlayOfferOnProduct(product, offer, {
      applyImages: true,
      remoteImageUrls: "https://cbu01.alicdn.com",
    });
    assert.equal(next.images[0], "/images/product-tumbler.svg");
    assert.ok(next.images.includes("https://cbu01.alicdn.com/kf/live.jpg"));
  });
});

describe("1688 offer parse + API payload", () => {
  it("parses fixture offers", () => {
    const offers = parseOffersDocument({
      offers: [
        {
          slug: "tumbler-notebook-pen-set",
          offerId: "99",
          factoryMinCny: 10,
          factoryMaxCny: 12,
          minOrder: 30,
          weightKg: 0.4,
        },
      ],
    });
    assert.equal(offers.length, 1);
    assert.equal(offers[0]!.factoryMinCny, 10);
    assert.equal(parseOffer({ slug: "x" }), null);
  });

  it("signs 1688 requests stably", () => {
    const a = sign1688Request("param2/1/demo", { b: "2", a: "1" }, "sec");
    const b = sign1688Request("param2/1/demo", { a: "1", b: "2" }, "sec");
    assert.equal(a, b);
    assert.match(a, /^[A-F0-9]{40}$/);
  });

  it("maps 1688 product payload to factory CNY and images", () => {
    const parsed = parse1688ProductPayload({
      result: {
        productInfo: {
          productID: 555,
          saleInfo: {
            minOrderQuantity: 40,
            priceRanges: [
              { startQuantity: 40, price: 45 },
              { startQuantity: 200, price: 28 },
            ],
          },
          shippingInfo: { unitWeight: 0.4, length: 20, width: 10, height: 8 },
          image: { images: ["https://cbu01.alicdn.com/kf/p.jpg"] },
        },
      },
    });
    assert.equal(parsed.offerId, "555");
    assert.equal(parsed.factoryMinCny, 28);
    assert.equal(parsed.factoryMaxCny, 45);
    assert.equal(parsed.minOrder, 40);
    assert.equal(parsed.weightKg, 0.4);
    assert.deepEqual(parsed.imageUrls, ["https://cbu01.alicdn.com/kf/p.jpg"]);
  });
});
