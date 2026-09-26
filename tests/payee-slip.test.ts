import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COMPANY } from "../lib/company";
import {
  formatBankAccountNo,
  formatPromptPayId,
  promptPayTypeLabel,
} from "../lib/payee";
import {
  amountsMatch,
  evaluateSlip,
  parseSlipExtracted,
  payeeMatches,
} from "../lib/slip-verify";

describe("payee display", () => {
  it("formats tax ID and mobile PromptPay numbers", () => {
    assert.equal(formatPromptPayId(COMPANY.taxId, "tax_id"), "0-1055-56003-87-3");
    assert.equal(formatPromptPayId("0812345678", "mobile"), "081-234-5678");
    assert.equal(promptPayTypeLabel("tax_id"), "เลขประจำตัวผู้เสียภาษี");
    assert.equal(formatBankAccountNo("1234567890"), "123-4-56789-0");
  });
});

describe("slip verification", () => {
  it("parses model JSON", () => {
    const extracted = parseSlipExtracted(
      'here {"amount":1000,"payeeName":"บริษัท เทราบิส จำกัด","accountOrPromptPay":"0105556003873","readable":true}',
    );
    assert.equal(extracted.amount, 1000);
    assert.equal(extracted.readable, true);
    assert.match(extracted.payeeName || "", /เทราบิส/);
  });

  it("matches amount and PromptPay tax ID", () => {
    const extracted = parseSlipExtracted(
      JSON.stringify({
        amount: 1000,
        payeeName: "บจก. เทราบิส",
        accountOrPromptPay: "0105556003873",
        readable: true,
      }),
    );
    assert.equal(amountsMatch(1000, extracted.amount), true);
    assert.equal(
      payeeMatches(
        { amount: 1000, promptPayId: COMPANY.taxId, accountName: COMPANY.legalName },
        extracted,
      ),
      true,
    );
    const result = evaluateSlip(
      { amount: 1000, promptPayId: COMPANY.taxId, accountName: COMPANY.legalName },
      extracted,
    );
    assert.equal(result.status, "match");
  });

  it("flags wrong amount", () => {
    const result = evaluateSlip(
      { amount: 1000, promptPayId: COMPANY.taxId, accountName: COMPANY.legalName },
      {
        amount: 900,
        payeeName: "บริษัท เทราบิส จำกัด",
        accountOrPromptPay: COMPANY.taxId,
        transferredAt: null,
        reference: null,
        bank: null,
        readable: true,
      },
    );
    assert.equal(result.status, "mismatch");
    assert.match(result.notes, /ไม่ตรง/);
  });

  it("marks unreadable slips", () => {
    const result = evaluateSlip(
      { amount: 1000, promptPayId: COMPANY.taxId, accountName: COMPANY.legalName },
      {
        amount: null,
        payeeName: null,
        accountOrPromptPay: null,
        transferredAt: null,
        reference: null,
        bank: null,
        readable: false,
      },
    );
    assert.equal(result.status, "unreadable");
  });
});
