import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPriceSheetQuoteInput,
  priceSheetQuoteLines,
} from "../lib/price-sheet-quote";
import { DEFAULT_PRICE_SHEET_PARAMS } from "../lib/price-sheet";
import type { OpsActor } from "../lib/ops-roles";

const actor: OpsActor = {
  email: "sales@therabis.local",
  name: "Sales Ops",
  role: "admin",
};

describe("price-sheet-quote", () => {
  it("builds quote lines from Final rows", () => {
    const lines = priceSheetQuoteLines(
      [
        { id: "B00001", name: "แก้ว", qty: 50, sellThb: 220 },
        { id: "X", name: "bad", qty: 10, sellThb: 0 },
      ],
      { B00001: "mug-set" },
    );
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.slug, "mug-set");
    assert.equal(lines[0]!.lineTotal, 11000);
  });

  it("builds QuoteRequestInput for ops RFQ", () => {
    const lines = priceSheetQuoteLines([
      { id: "B00001", name: "แก้ว", qty: 50, sellThb: 220 },
      { id: "B00002", name: "กล่อง", qty: 20, sellThb: 480 },
    ]);
    const input = buildPriceSheetQuoteInput({
      actor,
      lines,
      params: DEFAULT_PRICE_SHEET_PARAMS,
      grandTotal: 20600,
      contact: { company: "บริษัททดสอบ", name: "คุณเอ", phone: "0812345678" },
    });
    assert.equal(input.company, "บริษัททดสอบ");
    assert.equal(input.quantity, 70);
    assert.equal(input.landingPath, "/ops/price-sheet");
    assert.equal(input.decorationMethod, "not-sure");
    assert.match(input.detail || "", /สร้างจาก \/ops\/price-sheet/);
    assert.match(input.productInterest || "", /แก้ว/);
  });
});
