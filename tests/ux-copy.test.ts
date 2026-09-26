import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUYER_ASSISTANT_CTA,
  BUYER_ASSISTANT_INTRO,
  BUYER_ASSISTANT_TITLE,
  CHINA_AFTER_ORDER_INTRO,
  CHINA_AFTER_ORDER_STEPS,
  HOW_IT_WORKS,
  LOGO_DECORATION_INTRO,
  LOGO_SCREENING_BADGE,
  CATALOG_PILL,
  CATALOG_SUBTITLE,
  FLIP_CATALOG_CLOSING_BODY,
  FLIP_CATALOG_LEAD,
  FLIP_CATALOG_NAV,
  FLIP_CATALOG_PRINT_HINT,
  PRODUCTS_NAV_HINT,
  CATALOG_NAV_HINT,
  QUOTE_BASKET_FAB,
  quoteBasketAddLabel,
  quoteBasketLockNote,
  MOCKUP_RETAIL_HEADING,
  MOCKUP_RETAIL_HINT,
  ORDER_TRACKING_INTRO,
  ISSUE_REPORT_INTRO,
  PRICE_DISCLAIMER_FULL,
  PRICE_DISCLAIMER_HEADING,
  PRICE_DISCLAIMER_POINTS,
  PRICE_DISCLAIMER_SHORT,
  QUOTE_DETAIL_HINT,
  QUOTE_DETAIL_TEMPLATES,
  QUOTE_NOT_AN_ORDER,
  RFQ_NO_PAYMENT,
  CATALOG_EMPTY_BODY,
  CATALOG_LOADING,
  CATALOG_UNAVAILABLE_BODY,
  appendQuoteDetailTemplate,
} from "../lib/ux-copy.js";

const BUYER_JARGON = /\b(P2|RFQ|MOQ|SKU|Proof|Brief|Stub|SEO Landing)\b/i;

describe("ux-copy (buyer-facing strings)", () => {
  it("RFQ disclaimer avoids internal jargon and mentions no payment", () => {
    assert.doesNotMatch(RFQ_NO_PAYMENT, BUYER_JARGON);
    assert.match(RFQ_NO_PAYMENT, /ไม่มีการชำระเงิน/);
    assert.match(RFQ_NO_PAYMENT, /ยังไม่ใช่การยืนยัน/);
    assert.doesNotMatch(QUOTE_NOT_AN_ORDER, BUYER_JARGON);
    assert.match(QUOTE_NOT_AN_ORDER, /ไม่ใช่การสั่งซื้อ/);
    assert.match(QUOTE_NOT_AN_ORDER, /ไม่มีการชำระเงิน/);
  });

  it("issue report copy avoids jargon and says no payment", () => {
    assert.doesNotMatch(ISSUE_REPORT_INTRO, BUYER_JARGON);
    assert.match(ISSUE_REPORT_INTRO, /ไม่มีการชำระเงิน/);
    assert.match(ISSUE_REPORT_INTRO, /สกรีนโลโก้/);
  });

  it("order tracking copy mentions deposit and tax invoice without jargon", () => {
    assert.doesNotMatch(ORDER_TRACKING_INTRO, BUYER_JARGON);
    assert.match(ORDER_TRACKING_INTRO, /มัดจำ/);
    assert.match(ORDER_TRACKING_INTRO, /ใบกำกับภาษี/);
  });

  it("price disclaimers are non-empty and jargon-free", () => {
    for (const copy of [PRICE_DISCLAIMER_SHORT, PRICE_DISCLAIMER_FULL]) {
      assert.ok(copy.length > 20);
      assert.doesNotMatch(copy, BUYER_JARGON);
      assert.match(copy, /ประมาณ|โดยประมาณ/);
      assert.match(copy, /จีน/);
    }
    assert.match(PRICE_DISCLAIMER_HEADING, /ประมาณ/);
    assert.ok(PRICE_DISCLAIMER_POINTS.length >= 3);
    for (const point of PRICE_DISCLAIMER_POINTS) {
      assert.doesNotMatch(point, BUYER_JARGON);
    }
  });

  it("catalog empty and slow-load copy is jargon-free", () => {
    assert.match(CATALOG_LOADING, /โหลด/);
    assert.match(CATALOG_EMPTY_BODY, /ทีมขาย/);
    assert.match(CATALOG_UNAVAILABLE_BODY, /ฐานสินค้า/);
    assert.doesNotMatch(CATALOG_LOADING, BUYER_JARGON);
    assert.doesNotMatch(CATALOG_EMPTY_BODY, BUYER_JARGON);
    assert.doesNotMatch(CATALOG_UNAVAILABLE_BODY, BUYER_JARGON);
  });

  it("how-it-works steps are complete", () => {
    assert.equal(HOW_IT_WORKS.length, 3);
    for (const step of HOW_IT_WORKS) {
      assert.ok(step.title.length > 0);
      assert.ok(step.body.length > 0);
      assert.doesNotMatch(step.title, BUYER_JARGON);
      assert.doesNotMatch(step.body, BUYER_JARGON);
    }
  });

  it("buyer assistant copy is jargon-free", () => {
    assert.match(BUYER_ASSISTANT_TITLE, /Smart Gift|สั่งผลิต|ถาม/);
    assert.match(BUYER_ASSISTANT_CTA, /แชท AI/);
    assert.doesNotMatch(BUYER_ASSISTANT_INTRO, BUYER_JARGON);
    assert.doesNotMatch(BUYER_ASSISTANT_INTRO, /\b1688\b/);
    assert.match(BUYER_ASSISTANT_INTRO, /ไม่ใช่ใบเสนอราคา/);
  });

  it("logo screening copy is jargon-free", () => {
    assert.equal(LOGO_SCREENING_BADGE, "สกรีนโลโก้ได้");
    assert.match(LOGO_DECORATION_INTRO, /โลโก้/);
    assert.doesNotMatch(LOGO_DECORATION_INTRO, BUYER_JARGON);
    assert.doesNotMatch(LOGO_DECORATION_INTRO, /\b1688\b/);
    assert.doesNotMatch(CATALOG_PILL, BUYER_JARGON);
    assert.doesNotMatch(CATALOG_SUBTITLE, BUYER_JARGON);
    assert.match(CATALOG_SUBTITLE, /สกรีนโลโก้/);
    assert.match(QUOTE_BASKET_FAB, /ตะกร้า/);
    assert.doesNotMatch(quoteBasketLockNote(10), BUYER_JARGON);
    assert.match(quoteBasketAddLabel(10), /10 ชุด/);
    assert.equal(FLIP_CATALOG_NAV, "สมุดแคตตาล็อก");
    assert.match(PRODUCTS_NAV_HINT, /ขอราคา/);
    assert.match(CATALOG_NAV_HINT, /พลิกดู/);
    assert.doesNotMatch(FLIP_CATALOG_LEAD, BUYER_JARGON);
    assert.match(FLIP_CATALOG_LEAD, /กลุ่มเดียวกัน/);
    assert.match(FLIP_CATALOG_CLOSING_BODY, /ไม่มีการชำระเงิน/);
    assert.doesNotMatch(FLIP_CATALOG_PRINT_HINT, BUYER_JARGON);
    assert.doesNotMatch(FLIP_CATALOG_PRINT_HINT, /อัปโหลด/);
  });

  it("retail command copy is jargon-free", () => {
    assert.equal(MOCKUP_RETAIL_HEADING, "ช่องรีเทล");
    assert.match(MOCKUP_RETAIL_HINT, /สูงขึ้นไปอีกนิด/);
    assert.match(MOCKUP_RETAIL_HINT, /เปลี่ยนสี/);
    assert.doesNotMatch(MOCKUP_RETAIL_HINT, BUYER_JARGON);
  });

  it("china after-order steps explain made-to-order without factory jargon", () => {
    assert.equal(CHINA_AFTER_ORDER_STEPS.length, 4);
    assert.match(CHINA_AFTER_ORDER_INTRO, /โรงงาน/);
    assert.doesNotMatch(CHINA_AFTER_ORDER_INTRO, BUYER_JARGON);
    assert.doesNotMatch(CHINA_AFTER_ORDER_INTRO, /\b1688\b/);
    for (const step of CHINA_AFTER_ORDER_STEPS) {
      assert.ok(step.title.length > 0);
      assert.ok(step.body.length > 0);
      assert.doesNotMatch(step.title, BUYER_JARGON);
      assert.doesNotMatch(step.body, BUYER_JARGON);
      assert.doesNotMatch(step.body, /\b1688\b/);
    }
  });

  it("quote detail templates help buyers without jargon", () => {
    assert.match(QUOTE_DETAIL_HINT, /เลือกข้อความ/);
    assert.ok(QUOTE_DETAIL_TEMPLATES.length >= 6);
    for (const template of QUOTE_DETAIL_TEMPLATES) {
      assert.ok(template.label.length > 0);
      assert.ok(template.body.length > 20);
      assert.doesNotMatch(template.label, BUYER_JARGON);
      assert.doesNotMatch(template.body, BUYER_JARGON);
      assert.doesNotMatch(template.body, /\b1688\b/);
    }
    const first = QUOTE_DETAIL_TEMPLATES[0];
    assert.ok(first);
    assert.equal(appendQuoteDetailTemplate("", first.body), first.body);
    assert.equal(
      appendQuoteDetailTemplate(first.body, first.body),
      first.body,
    );
    const combined = appendQuoteDetailTemplate("มีโลโก้แล้ว", first.body);
    assert.match(combined, /มีโลโก้แล้ว/);
    assert.match(combined, new RegExp(first.body.slice(0, 12)));
  });
});
