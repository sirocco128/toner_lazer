import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOCKUP_VARIANTS,
  MOCKUP_WATERMARK_TEXT,
  applyLogoImageDataAdjustments,
  autoFitOverlayPlacement,
  buildMockupBrief,
  cropOpaqueBounds,
  getSurfacesForProduct,
  overlayProcessKey,
  resolveMockupSurfaces,
} from "../lib/mockup-studio";

describe("mockup-studio product surfaces", () => {
  it("enables the gift-set templates on the tumbler product slug fallback", () => {
    const surfaces = getSurfacesForProduct("tumbler-notebook-pen-set");
    assert.ok(surfaces);
    assert.deepEqual(
      surfaces.map((s) => s.id),
      ["tumbler", "notebook", "pen"],
    );
    assert.deepEqual(
      surfaces.map((s) => s.photo),
      [
        "/images/product-tumbler.jpg",
        "/images/product-tumbler-set.jpg",
        "/images/product-tumbler-set-2.jpg",
      ],
    );
  });

  it("maps CMS product images onto tumbler / notebook / pen", () => {
    const surfaces = resolveMockupSurfaces({
      name: "เซ็ตกระบอกน้ำ",
      slug: "custom-set",
      images: [
        "/images/a-tumbler.jpg",
        "/images/b-notebook.jpg",
        "/images/c-pen.jpg",
      ],
      enableCustomDesign: true,
      customDesignPreset: "tumbler_set",
    });
    assert.ok(surfaces);
    assert.equal(surfaces[0]?.photo, "/images/a-tumbler.jpg");
    assert.equal(surfaces[1]?.photo, "/images/b-notebook.jpg");
    assert.equal(surfaces[2]?.photo, "/images/c-pen.jpg");
  });

  it("does not attach templates to unrelated products by slug", () => {
    assert.equal(getSurfacesForProduct("eco-tote-bamboo-set"), null);
  });

  it("respects CMS enableCustomDesign + tumbler_set preset", () => {
    const surfaces = resolveMockupSurfaces({
      name: "เซ็ตกระบอกน้ำ",
      slug: "any-slug",
      images: ["/images/product-tumbler.jpg"],
      enableCustomDesign: true,
      customDesignPreset: "tumbler_set",
    });
    assert.ok(surfaces);
    assert.equal(surfaces.length, 3);
  });

  it("uses product photo when preset is product_photo", () => {
    const surfaces = resolveMockupSurfaces({
      name: "Powerbank Set",
      slug: "it-powerbank-set",
      images: ["/images/product-it.jpg"],
      enableCustomDesign: true,
      customDesignPreset: "product_photo",
    });
    assert.ok(surfaces);
    assert.equal(surfaces.length, 1);
    assert.equal(surfaces[0]?.id, "product");
    assert.equal(surfaces[0]?.photo, "/images/product-it.jpg");
  });

  it("hides mockup when enableCustomDesign is false", () => {
    assert.equal(
      resolveMockupSurfaces({
        name: "Eco",
        slug: "eco-tote-bamboo-set",
        images: ["/images/product-eco.jpg"],
        enableCustomDesign: false,
      }),
      null,
    );
  });
});

describe("mockup-studio variants", () => {
  it("offers product, lifestyle, office, and retail views", () => {
    assert.equal(MOCKUP_VARIANTS.length, 4);
    assert.deepEqual(
      MOCKUP_VARIANTS.map((item) => item.id),
      ["product", "lifestyle", "office", "retail"],
    );
  });

  it("keeps logo boxes inside the frame", () => {
    for (const variant of MOCKUP_VARIANTS) {
      const { x, y, w, h } = variant.logo;
      assert.ok(x >= 0 && y >= 0);
      assert.ok(x + w <= 1.0001);
      assert.ok(y + h <= 1.0001);
    }
  });
});

describe("mockup-studio quote brief", () => {
  it("summarizes the confirmed variant in Thai", () => {
    const brief = buildMockupBrief({
      productName: "เซ็ตกระบอกน้ำ",
      surfaceLabel: "กระบอกน้ำ",
      colorLabel: "ดำด้าน",
      variantLabel: "แบบคลาสสิก",
      hasLogo: true,
      text: "ACME",
    });
    assert.match(brief, /ยังไม่ใช่แบบผลิต/);
    assert.match(brief, /แบบคลาสสิก|บนสินค้า|คลาสสิก|1\./);
    assert.match(brief, /ACME/);
    assert.match(brief, new RegExp(MOCKUP_WATERMARK_TEXT));
    assert.ok(brief.length <= 1800);
  });

  it("exports the Thai watermark label", () => {
    assert.equal(MOCKUP_WATERMARK_TEXT, "Smart Gift");
  });
});

describe("mockup-studio logo adjustments", () => {
  it("auto-fits placement inside printable bounds", () => {
    const fit = autoFitOverlayPlacement("cylinder", 1.5);
    assert.ok(fit.w > 0.1 && fit.w < 0.8);
    assert.ok(fit.u >= 0 && fit.u + fit.w <= 1.2);
  });

  it("knocks out near-corner background pixels", () => {
    const width = 8;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
    const mid = (3 * width + 3) * 4;
    data[mid] = 20;
    data[mid + 1] = 20;
    data[mid + 2] = 20;
    data[mid + 3] = 255;

    const next = applyLogoImageDataAdjustments(
      { data, width, height },
      { removeBg: true },
    );
    assert.equal(next.data[3], 0);
    assert.equal(next.data[mid + 3], 255);
  });

  it("crops transparent margins after knock-out", () => {
    const width = 6;
    const height = 6;
    const data = new Uint8ClampedArray(width * height * 4);
    const paint = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      data[i] = 10;
      data[i + 1] = 20;
      data[i + 2] = 30;
      data[i + 3] = 255;
    };
    paint(2, 2);
    paint(3, 2);
    paint(2, 3);
    const cropped = cropOpaqueBounds({ data, width, height }, 0);
    assert.equal(cropped.width, 2);
    assert.equal(cropped.height, 2);
  });

  it("builds a stable process key for cache busting", () => {
    assert.equal(
      overlayProcessKey({
        id: "a",
        removeBg: true,
        brightness: 1.1,
        contrast: 0.9,
      }),
      "a|1|1.10|0.90",
    );
  });
});
