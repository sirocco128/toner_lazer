/**
 * Dropship orders to the toner supplier — pure helpers (no DB).
 *
 * Flow: we sell to the customer, then send Color Fly the models, quantities
 * and the customer's ship-to. Color Fly packs in OUR brand box and ships
 * direct. The parcel must not show the supplier's or Advice's name.
 */

import {
  DEFAULT_TONER_PRICING,
  TONER_CATALOG,
  findToner,
  normalizeModel,
  priceToner,
  tonerProductName,
  type TonerItem,
  type TonerPricingConfig,
} from "@/lib/toner-catalog";

export const DROPSHIP_STATUSES = [
  "draft",
  "sent",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type DropshipStatus = (typeof DROPSHIP_STATUSES)[number];

export const DROPSHIP_STATUS_LABELS: Record<DropshipStatus, string> = {
  draft: "ร่าง",
  sent: "ส่งให้ซัพพลายเออร์แล้ว",
  shipped: "ซัพพลายเออร์ส่งของแล้ว",
  delivered: "ลูกค้าได้รับแล้ว",
  cancelled: "ยกเลิก",
};

/** Allowed next statuses — keeps the flow one-directional. */
export const DROPSHIP_TRANSITIONS: Record<DropshipStatus, DropshipStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function isDropshipStatus(value: string): value is DropshipStatus {
  return (DROPSHIP_STATUSES as readonly string[]).includes(value);
}

export function canTransitionDropship(from: DropshipStatus, to: DropshipStatus): boolean {
  return DROPSHIP_TRANSITIONS[from].includes(to);
}

export type DropshipLineInput = { item: TonerItem; qty: number };

export type DropshipLine = {
  lineNo: number;
  sku: string;
  supplierRef: string;
  description: string;
  qty: number;
  unitSupplierThb: number;
  unitBoxThb: number;
};

export type DropshipShipTo = {
  name: string;
  phone: string;
  address: string;
  province: string | null;
};

export type DropshipDraft = {
  orderId: string | null;
  shipTo: DropshipShipTo;
  lines: DropshipLine[];
  totalQty: number;
  supplierTotalThb: number;
  boxTotalThb: number;
  notes: string | null;
};

export const MAX_DROPSHIP_LINES = 30;
export const MAX_LINE_QTY = 5000;

/** Resolve one token (our SKU, cartridge model, OEM code or printer) to a single cartridge. */
export function resolveTonerToken(
  token: string,
  catalog: readonly TonerItem[] = TONER_CATALOG,
): TonerItem | null {
  const t = token.trim();
  if (!t) return null;
  const bySku = catalog.find((c) => c.sku.toUpperCase() === t.toUpperCase());
  if (bySku) return bySku;
  const bySupplierRef = catalog.find((c) => c.supplierRef.toUpperCase() === t.toUpperCase());
  if (bySupplierRef) return bySupplierRef;
  const matches = findToner(t, catalog);
  if (matches.length === 1) return matches[0] ?? null;
  // Prefer an exact code match when a printer query hits several cartridges.
  const q = normalizeModel(t);
  const exact = matches.filter(
    (m) => normalizeModel(m.oemCode) === q || normalizeModel(m.model) === q,
  );
  return exact.length === 1 ? (exact[0] ?? null) : null;
}

/**
 * Parse free-text lines such as "85A x 5", "TL-BR-TN2380 10", "CE285A,2".
 * Same cartridge on several lines is merged. Throws Error with a code:
 * lines_required · line_format:<n> · unknown_toner:<token> · qty_invalid:<n> · too_many_lines
 */
export function parseDropshipLines(
  raw: string,
  catalog: readonly TonerItem[] = TONER_CATALOG,
): DropshipLineInput[] {
  const rows = raw
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (rows.length === 0) throw new Error("lines_required");
  if (rows.length > MAX_DROPSHIP_LINES) throw new Error("too_many_lines");

  const merged = new Map<string, DropshipLineInput>();
  rows.forEach((row, index) => {
    const match = row.match(/^(.*?)[\s,;x×*]+(\d+)\s*(?:ตลับ|pcs?)?$/i);
    if (!match || !match[1] || !match[2]) throw new Error(`line_format:${index + 1}`);
    const qty = Number(match[2]);
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_LINE_QTY) {
      throw new Error(`qty_invalid:${index + 1}`);
    }
    const token = match[1].trim();
    const item = resolveTonerToken(token, catalog);
    if (!item) throw new Error(`unknown_toner:${token}`);
    const prev = merged.get(item.sku);
    merged.set(item.sku, { item, qty: (prev?.qty ?? 0) + qty });
  });
  return [...merged.values()];
}

export function buildDropshipDraft(input: {
  orderId?: string | null;
  shipTo: DropshipShipTo;
  lines: DropshipLineInput[];
  notes?: string | null;
  pricing?: TonerPricingConfig;
}): DropshipDraft {
  const pricing = input.pricing ?? DEFAULT_TONER_PRICING;
  const name = input.shipTo.name.trim();
  const phone = input.shipTo.phone.trim();
  const address = input.shipTo.address.trim();
  if (!name) throw new Error("ship_to_name_required");
  if (!/^[0-9+\-\s()]{9,20}$/.test(phone)) throw new Error("ship_to_phone_invalid");
  if (address.length < 10) throw new Error("ship_to_address_required");
  if (input.lines.length === 0) throw new Error("lines_required");

  const lines: DropshipLine[] = input.lines.map((l, i) => {
    const p = priceToner(l.item, pricing);
    return {
      lineNo: i + 1,
      sku: l.item.sku,
      supplierRef: l.item.supplierRef,
      description: tonerProductName(l.item),
      qty: l.qty,
      unitSupplierThb: p.supplierPrice,
      unitBoxThb: pricing.boxCostThb,
    };
  });

  return {
    orderId: input.orderId?.trim() || null,
    shipTo: {
      name,
      phone,
      address,
      province: input.shipTo.province?.trim() || null,
    },
    lines,
    totalQty: lines.reduce((s, l) => s + l.qty, 0),
    supplierTotalThb: lines.reduce((s, l) => s + l.qty * l.unitSupplierThb, 0),
    boxTotalThb: lines.reduce((s, l) => s + l.qty * l.unitBoxThb, 0),
    notes: input.notes?.trim() || null,
  };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(n);
}

/** Message to paste into LINE / email to the supplier. */
export function buildSupplierMessage(
  draft: DropshipDraft & { dropshipId: string },
  senderBrand: string,
): string {
  const lines = draft.lines.map(
    (l) => `${l.lineNo}. [${l.supplierRef}] ${l.description} × ${l.qty} ตลับ`,
  );
  const address = [draft.shipTo.address, draft.shipTo.province].filter(Boolean).join(" ");
  return [
    `ใบสั่งส่งตรง ${draft.dropshipId}${draft.orderId ? ` (ออเดอร์ ${draft.orderId})` : ""}`,
    "",
    "รายการ:",
    ...lines,
    `รวม ${draft.totalQty} ตลับ · ยอดสินค้า ${fmt(draft.supplierTotalThb)} บาท`,
    "",
    `ผู้รับ: ${draft.shipTo.name} โทร ${draft.shipTo.phone}`,
    `ที่อยู่: ${address}`,
    "",
    `ผู้ส่งบนพัสดุ: ${senderBrand}`,
    "- แพ็กในกล่องแบรนด์ของเรา",
    "- ห้ามมีชื่อหรือโลโก้ของซัพพลายเออร์หรือร้านค้าอื่นบนกล่องและพัสดุ",
    "- ใส่ใบส่งของที่แนบไปในกล่อง",
    "กรุณาส่งเลขพัสดุกลับเมื่อส่งของแล้ว",
    ...(draft.notes ? ["", `หมายเหตุ: ${draft.notes}`] : []),
  ].join("\n");
}

function csvCell(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const DROPSHIP_CSV_HEADER = [
  "dropship_id",
  "order_id",
  "supplier_ref",
  "sku",
  "description",
  "qty",
  "unit_supplier_thb",
  "ship_to_name",
  "ship_to_phone",
  "ship_to_address",
  "ship_to_province",
] as const;

export function buildDropshipCsv(
  orders: Array<DropshipDraft & { dropshipId: string }>,
): string {
  const rows = [DROPSHIP_CSV_HEADER.join(",")];
  for (const o of orders) {
    for (const l of o.lines) {
      rows.push(
        [
          o.dropshipId,
          o.orderId,
          l.supplierRef,
          l.sku,
          l.description,
          l.qty,
          l.unitSupplierThb,
          o.shipTo.name,
          o.shipTo.phone,
          o.shipTo.address,
          o.shipTo.province,
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return rows.join("\n") + "\n";
}

/** DS-YYYYMMDD-NNNN in Bangkok date. */
export function formatDropshipId(now: Date, sequence: number): string {
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const ymd = bkk.toISOString().slice(0, 10).replace(/-/g, "");
  return `DS-${ymd}-${String(sequence).padStart(4, "0")}`;
}
