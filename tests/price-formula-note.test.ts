import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatFormulaCheckNote,
  formatFormulaCheckOneLine,
  formatLandedLadderFormulaNote,
  formulaBandLegend,
  markupBandLabel,
  sofBandLabel,
} from "../lib/price-formula-note";

describe("price formula check notes", () => {
  it("labels SOF and markup bands so staff can recheck the lookup", () => {
    assert.equal(sofBandLabel(10), "จำนวน ≤20");
    assert.equal(sofBandLabel(300), "จำนวน ≤300");
    assert.equal(sofBandLabel(400), "จำนวน 301–499");
    assert.equal(sofBandLabel(500), "จำนวน 500+");
    assert.equal(markupBandLabel(150), "ลงเรือ ≤250");
    assert.equal(markupBandLabel(400), "ลงเรือ ≤500");
    assert.equal(markupBandLabel(900), "ลงเรือ >650");
    assert.equal(markupBandLabel(150, "corporate"), "องค์กรคงที่");
  });

  it("writes the landed × SOF × markup arithmetic for a qty", () => {
    const note = formatFormulaCheckNote({
      qty: 10,
      factoryCny: 20,
      fx: 5,
      factoryThb: 100,
      inlandThb: 10,
      freightThb: 40,
      landedCostThb: 150,
      sof: 1.5,
      markup: 3,
      sellThb: 675,
      includeFreight: true,
      includePackaging: false,
      mode: "truck",
      tier: "MEMBER",
      gpThb: 5250,
      meetsFloor: true,
      floorThb: 5000,
      profile: "standard",
    });
    assert.match(note, /รีเช็ค 10 ชุด/);
    assert.match(note, /20\.00¥ × 5\.00 = 100\.00 บาทโรงงาน/);
    assert.match(note, /ลงเรือ 150\.00/);
    assert.match(note, /SOF 1\.50 \(จำนวน ≤20\)/);
    assert.match(note, /markup 3\.00 \(ลงเรือ ≤250\)/);
    assert.match(note, /150\.00 × 1\.50 × 3\.00 = 675\.00 → ปัด 675 บาท\/ชุด/);
    assert.match(note, /กำไรทั้งออเดอร์ 5,250 · พื้น 5,000 ผ่านพื้น/);
  });

  it("shows the ex-freight path and packaging add-on when those flags are on", () => {
    const note = formatFormulaCheckNote({
      qty: 10,
      factoryCny: 20,
      fx: 5,
      factoryThb: 100,
      inlandThb: 10,
      freightThb: 40,
      landedCostThb: 150,
      sof: 1.5,
      markup: 3,
      sellThb: 540,
      includeFreight: false,
      includePackaging: true,
      packagingThb: 45,
      profile: "standard",
    });
    assert.match(note, /ตัดค่าขนส่งจีน ใช้ 110\.00/);
    assert.match(note, /\+ แพ็กไทย 45 = ขาย 540 บาท\/ชุด/);
  });

  it("flattens the note for CSV export", () => {
    const line = formatFormulaCheckOneLine({
      qty: 10,
      factoryCny: 20,
      fx: 5,
      factoryThb: 100,
      inlandThb: 10,
      freightThb: 40,
      landedCostThb: 150,
      sof: 1.5,
      markup: 3,
      sellThb: 675,
      includeFreight: true,
      includePackaging: false,
    });
    assert.equal(line.includes("\n"), false);
    assert.match(line, /รีเช็ค 10 ชุด · /);
  });

  it("explains stored landed ladders without factory CNY split", () => {
    const note = formatLandedLadderFormulaNote({
      qty: 10,
      landedCostThb: 50,
      sof: 1.5,
      markup: 3,
      sellThb: 225,
      packageProfitThb: 1750,
      floor: 5000,
      meetsFloor: false,
    });
    assert.match(note, /ลงเรือ 50\.00 × SOF 1\.50/);
    assert.match(note, /ไม่ถึงพื้น/);
  });

  it("prints the band legend for staff to look up SOF / markup", () => {
    assert.match(formulaBandLegend("standard"), /markup: ≤250 = 3\.00/);
    assert.match(formulaBandLegend("corporate"), /markup 1\.47/);
  });
});
