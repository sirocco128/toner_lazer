import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPromptPayPayload,
  detectPromptPayTarget,
} from "../lib/promptpay";
import { COMPANY } from "../lib/company";

function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

describe("PromptPay EMV payload", () => {
  it("detects tax ID vs mobile", () => {
    assert.deepEqual(detectPromptPayTarget(COMPANY.taxId), {
      type: "tax_id",
      value: COMPANY.taxId,
    });
    assert.deepEqual(detectPromptPayTarget("0812345678"), {
      type: "mobile",
      value: "0812345678",
    });
  });

  it("builds a dynamic THB payload with valid CRC", () => {
    const payload = buildPromptPayPayload({
      promptPayId: COMPANY.taxId,
      amount: 5350,
    });
    assert.ok(payload.startsWith("000201"));
    assert.ok(payload.includes("5802TH"));
    assert.ok(payload.includes("5303764"));
    assert.ok(payload.includes("54045350.00") || payload.includes("54075350.00"));
    const body = payload.slice(0, -4);
    const crc = payload.slice(-4);
    assert.equal(crc, crc16ccitt(body));
  });
});
