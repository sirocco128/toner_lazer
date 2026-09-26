/**
 * Export SKU master rows as factory-importable Excel/CSV for recheck → re-upload.
 */

import { PRICE_STRUCTURE_QTYS, skuPriceStructure } from "@/lib/sku-price-structure";
import type { ForcedMinQtyProfile } from "@/lib/alibaba/forced-min-qty";
import type { SkuRecord } from "@/lib/sku-master-types";
import { buildXlsxBuffer } from "@/lib/xlsx-write";

export type SkuPriceExportOptions = {
  profile?: ForcedMinQtyProfile;
  canSeeCost?: boolean;
};

export type SkuPriceExportSummary = {
  total: number;
  importReady: number;
  notReady: number;
  missingFactoryCode: number;
  bundles: number;
  missingCost: number;
};

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function ladderSell(
  sku: SkuRecord,
  profile: ForcedMinQtyProfile,
): Map<number, number> {
  const structure = skuPriceStructure(sku, profile);
  const byQty = new Map<number, number>();
  if (structure.kind === "fixed" && structure.sellPriceThb != null) {
    for (const qty of PRICE_STRUCTURE_QTYS) {
      byQty.set(qty, structure.sellPriceThb);
    }
    return byQty;
  }
  for (const step of structure.steps) {
    byQty.set(step.qty, step.sellThb);
  }
  return byQty;
}

function exportHeaders(canSeeCost: boolean): string[] {
  return [
    "sku",
    "name",
    "rmb",
    "per ctn",
    "length",
    "width",
    "height",
    "weight",
    "product_id",
    "stock_class",
    "factory_code",
    ...(canSeeCost ? (["unit_landed_thb"] as const) : []),
    "sell_price_thb",
    "forced_min_qty",
    ...PRICE_STRUCTURE_QTYS.map((qty) => `qty_${qty}`),
    "import_ready",
    "note",
  ];
}

function rowValues(
  sku: SkuRecord,
  profile: ForcedMinQtyProfile,
  canSeeCost: boolean,
): Array<string | number> {
  const factoryCode = (sku.oriProductCode || "").trim();
  const importReady = Boolean(factoryCode) && !sku.isBundle;
  const sells = ladderSell(sku, profile);
  const noteParts: string[] = [];
  if (!factoryCode) noteParts.push("ไม่มีรหัสโรงงาน — อัปโหลดจะจับคู่ไม่ได้");
  if (sku.isBundle) noteParts.push("บันเดิล — ใส่ราคาที่หน้าบันเดิล");
  if (
    canSeeCost &&
    sku.factoryUnitCny == null &&
    sku.unitLandedCostThb == null
  ) {
    noteParts.push("ยังไม่มีต้นทุน — ใส่ rmb ก่อนคิดราคา");
  }

  const cols: Array<string | number> = [
    factoryCode,
    sku.nameTh,
    canSeeCost && sku.factoryUnitCny != null ? sku.factoryUnitCny : "",
    sku.pcsPerCtn != null ? sku.pcsPerCtn : "",
    sku.lengthCm != null ? sku.lengthCm : "",
    sku.widthCm != null ? sku.widthCm : "",
    sku.heightCm != null ? sku.heightCm : "",
    sku.cartonKg != null ? sku.cartonKg : "",
    sku.productId,
    sku.stockClass,
    factoryCode,
  ];
  if (canSeeCost) {
    cols.push(sku.unitLandedCostThb != null ? sku.unitLandedCostThb : "");
  }
  cols.push(
    sku.sellPriceThb != null ? sku.sellPriceThb : "",
    sku.forcedMinQty != null ? sku.forcedMinQty : "",
    ...PRICE_STRUCTURE_QTYS.map((qty) => sells.get(qty) ?? ""),
    importReady ? "yes" : "no",
    noteParts.join(" · "),
  );
  return cols;
}

export function summarizeSkuPriceExport(
  skus: SkuRecord[],
  options: SkuPriceExportOptions = {},
): SkuPriceExportSummary {
  const canSeeCost = options.canSeeCost !== false;
  let importReady = 0;
  let missingFactoryCode = 0;
  let bundles = 0;
  let missingCost = 0;
  for (const sku of skus) {
    const factoryCode = (sku.oriProductCode || "").trim();
    if (sku.isBundle) bundles += 1;
    if (!factoryCode) missingFactoryCode += 1;
    if (
      canSeeCost &&
      sku.factoryUnitCny == null &&
      sku.unitLandedCostThb == null
    ) {
      missingCost += 1;
    }
    if (factoryCode && !sku.isBundle) importReady += 1;
  }
  return {
    total: skus.length,
    importReady,
    notReady: skus.length - importReady,
    missingFactoryCode,
    bundles,
    missingCost,
  };
}

export function buildSkuPriceExportRows(
  skus: SkuRecord[],
  options: SkuPriceExportOptions = {},
): Array<Array<string | number>> {
  const profile = options.profile === "corporate" ? "corporate" : "standard";
  const canSeeCost = options.canSeeCost !== false;
  return [
    exportHeaders(canSeeCost),
    ...skus.map((sku) => rowValues(sku, profile, canSeeCost)),
  ];
}

export function buildSkuPriceExportCsv(
  skus: SkuRecord[],
  options: SkuPriceExportOptions = {},
): string {
  const rows = buildSkuPriceExportRows(skus, options);
  const lines = rows.map((row) => row.map((cell) => csvCell(cell)).join(","));
  return `\uFEFF${lines.join("\n")}`;
}

export function buildSkuPriceExportXlsx(
  skus: SkuRecord[],
  options: SkuPriceExportOptions = {},
): Buffer {
  const profile = options.profile === "corporate" ? "corporate" : "standard";
  const canSeeCost = options.canSeeCost !== false;
  const summary = summarizeSkuPriceExport(skus, options);
  const guide: Array<Array<string | number>> = [
    ["หัวข้อ", "ค่า"],
    ["โปรไฟล์", profile],
    ["จำนวนแถวทั้งหมด", summary.total],
    ["อัปโหลดได้ (มีรหัสโรงงาน)", summary.importReady],
    ["อัปโหลดไม่ได้", summary.notReady],
    ["ไม่มีรหัสโรงงาน", summary.missingFactoryCode],
    ["บันเดิล", summary.bundles],
    ["ยังไม่มีต้นทุน", summary.missingCost],
    ["", ""],
    ["วิธีใช้", ""],
    ["1", "แก้คอลัมน์ sku (=รหัสโรงงาน) และ rmb บนชีต import"],
    ["2", "เปิด /ops/pricing/import แล้วอัปโหลดไฟล์นี้"],
    ["3", "พรีวิว → เลือกแถว → อัปเดตราคาขึ้นเว็บ"],
    ["ห้าม", "อย่าใส่รหัสขาย A/B/C/D ในคอลัมน์ sku"],
    ["หมายเหตุ", "คอลัมน์ qty_* เป็นราคาปัจจุบันสำหรับรีเช็ค — อิมพอร์ตไม่อ่าน"],
    [
      "มิติ",
      "per ctn / length / width / height / weight มาจาก ORI — อัปเดตเมื่ออัปโหลด Excel แล้วส่งราคา",
    ],
  ];

  return buildXlsxBuffer([
    { name: "สรุป", rows: guide },
    { name: "import", rows: buildSkuPriceExportRows(skus, { profile, canSeeCost }) },
  ]);
}

export function skuPriceExportFileName(
  kind: "xlsx" | "csv" = "xlsx",
  now = new Date(),
): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `sku-price-export-${y}${m}${d}.${kind}`;
}
