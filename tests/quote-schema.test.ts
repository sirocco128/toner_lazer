import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quoteSchema, parseQuoteFormData, minNeededDateYmd } from "../lib/quote-schema";

const basePayload = {
  name: "สมชาย ใจดี",
  company: "บริษัท ตัวอย่าง จำกัด",
  email: "somchai@acme.co.th",
  phone: "02-123-4567",
  quantity: 100,
  budgetPerSet: 500,
  neededDate: minNeededDateYmd(),
  province: "กรุงเทพมหานคร",
  productInterest: "Welcome Kit",
  productSlug: "tumbler-notebook-pen-set",
  decorationMethod: "uv-print" as const,
  detail: "ต้องการสกรีนโลโก้สองตำแหน่ง",
  consent: true,
  website: "",
  startedAt: Date.now() - 5_000,
  landingPath: "/premium-giftset",
  referrer: "https://www.google.com/",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "giftset",
  utmTerm: "",
  utmContent: "",
};

describe("quote-schema (§31.1)", () => {
  it("accepts a complete valid request", () => {
    const parsed = quoteSchema.safeParse(basePayload);
    assert.equal(parsed.success, true);
  });

  it("accepts a joined multi-item product interest string", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      productInterest:
        "พัดลมห้อยคอ DF1420 × 10 · เครื่องทำความชื้น(แมว) DS0260 × 11",
      productSlug: undefined,
    });
    assert.equal(parsed.success, true);
  });

  it("rejects an invalid email", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      email: "not-an-email",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.match(parsed.error.issues[0]?.message || "", /อีเมลไม่ถูกต้อง/);
    }
  });

  it("rejects an invalid phone number", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      phone: "12345",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.match(parsed.error.issues[0]?.message || "", /เบอร์โทรไม่ถูกต้อง/);
    }
  });

  it("rejects missing consent", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      consent: false,
    });
    assert.equal(parsed.success, false);
  });

  it("rejects an impossible calendar date", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      neededDate: "2026-02-31",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects a malformed product slug", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      productSlug: "Bad_Slug!!",
    });
    assert.equal(parsed.success, false);
  });

  it("parseQuoteFormData maps FormData fields", () => {
    const fd = new FormData();
    fd.set("name", basePayload.name);
    fd.set("company", basePayload.company);
    fd.set("email", basePayload.email);
    fd.set("phone", basePayload.phone);
    fd.set("quantity", String(basePayload.quantity));
    fd.set("consent", "on");
    fd.set("decorationMethod", basePayload.decorationMethod);
    fd.set("startedAt", String(basePayload.startedAt));
    fd.set("website", "");
    fd.set("neededDate", basePayload.neededDate);
    const result = parseQuoteFormData(fd);
    assert.equal(result.success, true);
  });

  it("accepts a minimal request without tax ID or address", () => {
    const parsed = quoteSchema.safeParse({
      name: basePayload.name,
      company: basePayload.company,
      email: basePayload.email,
      phone: basePayload.phone,
      quantity: basePayload.quantity,
      consent: true,
      website: "",
    });
    assert.equal(parsed.success, true);
  });

  it("accepts a 13-digit tax ID and composes tambon/district/province", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      taxId: "0105556003873",
      district: "ทุ่งครุ",
      subdistrict: "ทุ่งครุ",
    });
    assert.equal(parsed.success, true);

    const fd = new FormData();
    fd.set("name", basePayload.name);
    fd.set("company", basePayload.company);
    fd.set("email", basePayload.email);
    fd.set("phone", basePayload.phone);
    fd.set("quantity", String(basePayload.quantity));
    fd.set("consent", "on");
    fd.set("decorationMethod", basePayload.decorationMethod);
    fd.set("province", "กรุงเทพมหานคร");
    fd.set("district", "ทุ่งครุ");
    fd.set("subdistrict", "ทุ่งครุ");
    fd.set("streetAddress", "50/238 ซอยประชาอุทิศ 72");
    fd.set("zip", "10140");
    fd.set("taxId", "0105556003873");
    const result = parseQuoteFormData(fd);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.taxId, "0105556003873");
      assert.equal(
        result.data.province,
        "50/238 ซอยประชาอุทิศ 72 แขวงทุ่งครุ เขตทุ่งครุ กรุงเทพมหานคร 10140",
      );
    }
  });

  it("accepts a selected VAT billing branch", () => {
    const parsed = quoteSchema.safeParse({
      ...basePayload,
      taxId: "0105556003873",
      billingBranch: "สาขาที่ 1 (00001)",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.billingBranch, "สาขาที่ 1 (00001)");
    }

    const fd = new FormData();
    fd.set("name", basePayload.name);
    fd.set("company", basePayload.company);
    fd.set("email", basePayload.email);
    fd.set("phone", basePayload.phone);
    fd.set("quantity", String(basePayload.quantity));
    fd.set("consent", "on");
    fd.set("decorationMethod", basePayload.decorationMethod);
    fd.set("taxId", "0105556003873");
    fd.set("billingBranch", "สาขาที่ 1 (00001)");
    const result = parseQuoteFormData(fd);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.billingBranch, "สาขาที่ 1 (00001)");
    }
  });
});
