/**
 * Thai formula-check notes so ops can re-audit landed → SOF → markup → sell.
 * Factory CNY / markup stay off payloads that sales without factory.read receive.
 */

import { MARKUP_BANDS, SMALL_ORDER_FACTORS } from "@/lib/alibaba/rates";
import type { FreightMode } from "@/lib/alibaba/types";
import type { ForcedMinQtyProfile } from "@/lib/alibaba/forced-min-qty";

export type FormulaCheckInput = {
  qty: number;
  factoryCny: number;
  fx: number;
  factoryThb: number;
  inlandThb: number;
  freightThb: number;
  landedCostThb: number;
  sof: number;
  markup: number;
  sellThb: number;
  includeFreight: boolean;
  includePackaging: boolean;
  packagingThb?: number;
  mode?: FreightMode;
  tier?: string;
  gpThb?: number;
  meetsFloor?: boolean;
  floorThb?: number;
  profile?: ForcedMinQtyProfile;
};

export type LandedLadderFormulaInput = {
  qty: number;
  landedCostThb: number;
  sof: number;
  markup: number;
  sellThb: number;
  packageProfitThb: number;
  floor: number;
  meetsFloor: boolean;
  profile?: ForcedMinQtyProfile;
};

export function sofBandLabel(qty: number): string {
  const n = Math.max(1, qty);
  const row = SMALL_ORDER_FACTORS.find((item) => n <= item.maxQty);
  if (!row || !Number.isFinite(row.maxQty)) return "จำนวน 500+";
  if (row.maxQty === 499) return "จำนวน 301–499";
  if (row.maxQty === Number.POSITIVE_INFINITY) return "จำนวน 500+";
  return `จำนวน ≤${row.maxQty}`;
}

export function markupBandLabel(
  landedCostThb: number,
  profile: ForcedMinQtyProfile = "standard",
): string {
  if (profile === "corporate") return "องค์กรคงที่";
  const row = MARKUP_BANDS.find((item) => landedCostThb <= item.maxCostThb);
  if (!row || !Number.isFinite(row.maxCostThb)) return "ลงเรือ >650";
  if (row.maxCostThb === Number.POSITIVE_INFINITY) return "ลงเรือ >650";
  return `ลงเรือ ≤${row.maxCostThb}`;
}

export function formulaBandLegend(profile: ForcedMinQtyProfile = "standard"): string {
  const sof =
    "SOF: ≤20 = 1.50 · ≤50 = 1.40 · ≤100 = 1.30 · ≤300 = 1.20 · 301–499 = 1.10 · 500+ = 1.00";
  if (profile === "corporate") {
    return [
      "รีเช็คองค์กร: ขาย = ปัด(ลงเรือ × SOF × markup 1.47) · พื้นกำไรชุด 20,000",
      sof,
    ].join("\n");
  }
  return [
    "รีเช็คสูตร: ลงเรือ = โรงงานบาท + ขนส่งในจีน + รถ/เรือจีน→ไทย",
    "ขาย = ปัด(ลงเรือ × SOF × markup)",
    sof,
    "markup: ≤250 = 3.00 · ≤350 = 2.73 · ≤500 = 2.62 · ≤650 = 2.45 · >650 = 2.14",
    "พื้นกำไรชุด: 5,000 (<500) / 3,000 (500+)",
  ].join("\n");
}

export function formatFormulaCheckNote(input: FormulaCheckInput): string {
  const profile = input.profile ?? "standard";
  const goodsThb = input.factoryThb + input.inlandThb;
  const usedCostThb = input.includeFreight ? input.landedCostThb : goodsThb;
  const raw = usedCostThb * input.sof * input.markup;
  const rounded = Math.round(raw);
  const pack = input.includePackaging ? input.packagingThb || 0 : 0;
  const freightLabel = freightModeLabel(input.mode, input.tier);
  const markupName = profile === "corporate" ? "markup องค์กร" : "markup";

  const lines = [
    `รีเช็ค ${input.qty} ชุด`,
    `${dec(input.factoryCny)}¥ × ${fx(input.fx)} = ${dec(input.factoryThb)} บาทโรงงาน`,
    `+ ขนส่งในจีน ${dec(input.inlandThb)} + ${freightLabel} ${dec(input.freightThb)} = ลงเรือ ${dec(input.landedCostThb)}`,
  ];

  if (!input.includeFreight) {
    lines.push(`ตัดค่าขนส่งจีน ใช้ ${dec(goodsThb)} (โรงงาน+ในจีน)`);
  }

  lines.push(
    `SOF ${dec(input.sof)} (${sofBandLabel(input.qty)}) × ${markupName} ${dec(input.markup)} (${markupBandLabel(usedCostThb, profile)})`,
    `${dec(usedCostThb)} × ${dec(input.sof)} × ${dec(input.markup)} = ${dec(raw)} → ปัด ${int(rounded)} บาท/ชุด`,
  );

  if (pack > 0) {
    lines.push(`+ แพ็กไทย ${int(pack)} = ขาย ${int(input.sellThb)} บาท/ชุด`);
  } else {
    lines.push(`ขาย ${int(input.sellThb)} บาท/ชุด`);
  }

  if (input.gpThb != null && input.floorThb != null) {
    const pass = input.meetsFloor ? "ผ่านพื้น" : "ไม่ถึงพื้น";
    lines.push(
      `กำไรทั้งออเดอร์ ${int(input.gpThb)} · พื้น ${int(input.floorThb)} ${pass}`,
    );
  }

  return lines.join("\n");
}

export function formatFormulaCheckOneLine(input: FormulaCheckInput): string {
  return formatFormulaCheckNote(input).replace(/\n/g, " · ");
}

export function formatLandedLadderFormulaNote(
  input: LandedLadderFormulaInput,
): string {
  const profile = input.profile ?? "standard";
  const raw = input.landedCostThb * input.sof * input.markup;
  const markupName = profile === "corporate" ? "markup องค์กร" : "markup";
  const pass = input.meetsFloor ? "ผ่านพื้น" : "ไม่ถึงพื้น";
  return [
    `รีเช็ค ${input.qty} ชุด`,
    `ลงเรือ ${dec(input.landedCostThb)} × SOF ${dec(input.sof)} (${sofBandLabel(input.qty)}) × ${markupName} ${dec(input.markup)} (${markupBandLabel(input.landedCostThb, profile)})`,
    `= ${dec(raw)} → ปัด ${int(input.sellThb)} บาท/ชุด`,
    `กำไรทั้งออเดอร์ ${int(input.packageProfitThb)} · พื้น ${int(input.floor)} ${pass}`,
  ].join("\n");
}

function freightModeLabel(mode?: FreightMode, tier?: string): string {
  const vehicle = mode === "sea" ? "เรือ" : "รถ";
  return tier ? `${vehicle} ${tier}` : vehicle;
}

function dec(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fx(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const digits = Number.isInteger(value) ? 2 : 4;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

function int(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}
