import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SMART_GIFT_AUDIENCES,
  SMART_GIFT_CATEGORIES,
  SMART_GIFT_DECORATIONS,
  SMART_GIFT_MATERIALS,
  SMART_GIFT_PARTNER_POINTS,
} from "../lib/smart-gift-method";

const BUYER_JARGON = /\b(P2|RFQ|MOQ|SKU|Proof|Brief|OEM|ODM|1688)\b/i;

describe("Smart Gift selling method", () => {
  it("covers the twelve catalog groups from the poster", () => {
    assert.equal(SMART_GIFT_CATEGORIES.length, 12);
    const titles = SMART_GIFT_CATEGORIES.map((item) => item.title);
    assert.ok(titles.includes("แก้วน้ำและกระบอกน้ำ"));
    assert.ok(titles.includes("ชุดของขวัญพรีเมียม"));
    assert.ok(titles.includes("สั่งผลิตตามแบบ"));
    const slugs = SMART_GIFT_CATEGORIES.map((item) => item.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const item of SMART_GIFT_CATEGORIES) {
      assert.equal(item.href, `/products?category=${item.slug}`);
      assert.match(item.image, /^\/images\/.+\.(jpg|svg|webp)$/);
    }
  });

  it("lists logo methods, materials, audiences, and partner work in buyer language", () => {
    assert.equal(SMART_GIFT_DECORATIONS.length, 5);
    assert.equal(SMART_GIFT_MATERIALS.length, 10);
    assert.equal(SMART_GIFT_AUDIENCES.length, 6);
    assert.equal(SMART_GIFT_PARTNER_POINTS.length, 8);
    const copy = [
      ...SMART_GIFT_CATEGORIES.flatMap((item) => [item.title, ...item.points]),
      ...SMART_GIFT_DECORATIONS.flatMap((item) => [item.title, item.body]),
      ...SMART_GIFT_MATERIALS,
      ...SMART_GIFT_AUDIENCES,
      ...SMART_GIFT_PARTNER_POINTS.flatMap((item) => [item.title, item.body]),
    ].join("\n");
    assert.doesNotMatch(copy, BUYER_JARGON);
    assert.match(copy, /สกรีนโลโก้/);
    assert.match(copy, /ขอใบเสนอราคา|ใบเสนอราคา/);
  });
});
