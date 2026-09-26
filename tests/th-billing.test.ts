import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bahtText } from "../lib/th-baht-text";
import {
  calculateDepositPlan,
  isValidThaiTaxId,
  roundSatang,
  splitVat,
} from "../lib/th-billing";
import { COMPANY } from "../lib/company";

describe("Thai VAT + deposit (revenue cycle)", () => {
  it("adds 7% VAT exclusive like a ภ.พ.30 invoice", () => {
    const vat = splitVat({ amount: 10_000, vatMode: "exclusive" });
    assert.equal(vat.subtotalExVat, 10_000);
    assert.equal(vat.vatAmount, 700);
    assert.equal(vat.grandTotal, 10_700);
  });

  it("backs out VAT from an inclusive grand total", () => {
    const vat = splitVat({ amount: 10_700, vatMode: "inclusive" });
    assert.equal(vat.grandTotal, 10_700);
    assert.equal(vat.subtotalExVat, 10_000);
    assert.equal(vat.vatAmount, 700);
  });

  it("auto-collects full amount at or under 10,000 baht incl. VAT", () => {
    const small = calculateDepositPlan({ grandTotal: 10_000, mode: "auto" });
    assert.equal(small.collectFull, true);
    assert.equal(small.depositAmount, 10_000);
    assert.equal(small.remainingAmount, 0);

    const large = calculateDepositPlan({ grandTotal: 10_700, mode: "auto" });
    assert.equal(large.collectFull, false);
    assert.equal(large.appliedPercent, 50);
    assert.equal(large.depositAmount, 5_350);
    assert.equal(large.remainingAmount, 5_350);
  });

  it("keeps deposit + remaining equal to grand total in satang", () => {
    const plan = calculateDepositPlan({
      grandTotal: 10_001.11,
      mode: "percent",
      percent: 30,
    });
    assert.equal(
      roundSatang(plan.depositAmount + plan.remainingAmount),
      10_001.11,
    );
  });

  it("validates the Terabis tax ID checksum", () => {
    assert.equal(isValidThaiTaxId(COMPANY.taxId), true);
    assert.equal(isValidThaiTaxId("0105556003874"), false);
  });
});

describe("bahtText (ใบกำกับภาษี)", () => {
  it("renders statutory amount-in-words", () => {
    assert.equal(bahtText(0), "ศูนย์บาทถ้วน");
    assert.equal(bahtText(1), "หนึ่งบาทถ้วน");
    assert.equal(bahtText(11), "สิบเอ็ดบาทถ้วน");
    assert.equal(bahtText(21), "ยี่สิบเอ็ดบาทถ้วน");
    assert.equal(bahtText(101), "หนึ่งร้อยเอ็ดบาทถ้วน");
    assert.equal(bahtText(1000.5), "หนึ่งพันบาทห้าสิบสตางค์");
  });
});
