/**
 * บัตรคุมสินค้า (Stock Card) — รูปแบบบัญชีคุมสินค้าคงเหลือ
 * คอลัมน์: วันเดือนปี | เลขที่เอกสาร | รายการ | รับเข้า | จ่ายออก | คงเหลือ
 * นับเฉพาะการเคลื่อนไหวที่กระทบจำนวนบนมือ (ไม่นับ reserve/release)
 */

import { getDb } from "@/lib/database";
import { wmsMovementLabel } from "@/lib/wms-labels";
import { getLocationByCode } from "@/lib/wms-repository";
import { resolveProductKey } from "@/lib/wms-service";

export type StockCardLine = {
  movementKey: string;
  at: string;
  docNo: string;
  description: string;
  qtyIn: number;
  qtyOut: number;
  balance: number;
  kind: string;
};

export type StockCardResult = {
  productKey: string;
  locationId: number | null;
  locationCode: string | null;
  fromIso: string | null;
  toIso: string | null;
  openingQty: number;
  closingQty: number;
  lines: StockCardLine[];
};

type MovRow = {
  movement_key: string;
  kind: string;
  product_key: string;
  location_id: number;
  qty_delta: number;
  receipt_id: string | null;
  order_id: string | null;
  po_id: string | null;
  reservation_id: string | null;
  memo: string | null;
  created_at: string;
};

const NON_PHYSICAL = new Set(["reserve", "release", "consume_reserve"]);

function endOfDayIso(ymd: string): string {
  // Treat YYYY-MM-DD as Bangkok calendar day end in ISO (UTC+7 → 16:59:59.999Z same calendar day UTC-ish)
  // Simpler: append T23:59:59.999+07:00 parsed to ISO
  const d = new Date(`${ymd}T23:59:59.999+07:00`);
  return d.toISOString();
}

function startOfDayIso(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000+07:00`);
  return d.toISOString();
}

function docNoFor(row: MovRow): string {
  return (
    row.receipt_id ||
    row.order_id ||
    row.po_id ||
    row.reservation_id ||
    row.movement_key
  );
}

function descriptionFor(row: MovRow): string {
  const base = wmsMovementLabel(row.kind);
  const bits = [base];
  if (row.memo) bits.push(row.memo);
  else if (row.order_id) bits.push(`ออเดอร์ ${row.order_id}`);
  else if (row.po_id) bits.push(`PO ${row.po_id}`);
  return bits.join(" · ");
}

export function buildStockCard(input: {
  productKey: string;
  locationCode?: string | null;
  /** YYYY-MM-DD inclusive (Asia/Bangkok) */
  fromYmd?: string | null;
  /** YYYY-MM-DD inclusive (Asia/Bangkok) */
  toYmd?: string | null;
}): StockCardResult {
  const productKey = resolveProductKey(input.productKey);
  if (!productKey) {
    return {
      productKey: "",
      locationId: null,
      locationCode: null,
      fromIso: null,
      toIso: null,
      openingQty: 0,
      closingQty: 0,
      lines: [],
    };
  }

  let locationId: number | null = null;
  let locationCode: string | null = null;
  if (input.locationCode) {
    const loc = getLocationByCode(input.locationCode.trim());
    if (loc) {
      locationId = loc.id;
      locationCode = loc.locationCode;
    }
  }

  const fromIso = input.fromYmd ? startOfDayIso(input.fromYmd) : null;
  const toIso = input.toYmd ? endOfDayIso(input.toYmd) : null;

  const clauses = [`product_key = ?`];
  const params: (string | number)[] = [productKey];
  if (locationId != null) {
    clauses.push(`location_id = ?`);
    params.push(locationId);
  }

  const where = clauses.join(" AND ");
  const rows = getDb()
    .prepare(
      `SELECT movement_key, kind, product_key, location_id, qty_delta,
              receipt_id, order_id, po_id, reservation_id, memo, created_at
       FROM wms_movements
       WHERE ${where}
       ORDER BY created_at ASC, id ASC`,
    )
    .all(...params) as MovRow[];

  const physical = rows.filter((r) => !NON_PHYSICAL.has(r.kind) && r.qty_delta !== 0);

  let openingQty = 0;
  const periodRows: MovRow[] = [];
  for (const row of physical) {
    if (fromIso && row.created_at < fromIso) {
      openingQty += row.qty_delta;
      continue;
    }
    if (toIso && row.created_at > toIso) continue;
    periodRows.push(row);
  }

  let balance = openingQty;
  const lines: StockCardLine[] = [];
  for (const row of periodRows) {
    const qtyIn = row.qty_delta > 0 ? row.qty_delta : 0;
    const qtyOut = row.qty_delta < 0 ? Math.abs(row.qty_delta) : 0;
    balance += row.qty_delta;
    lines.push({
      movementKey: row.movement_key,
      at: row.created_at,
      docNo: docNoFor(row),
      description: descriptionFor(row),
      qtyIn,
      qtyOut,
      balance,
      kind: row.kind,
    });
  }

  return {
    productKey,
    locationId,
    locationCode,
    fromIso,
    toIso,
    openingQty,
    closingQty: balance,
    lines,
  };
}

/** Default period: first day of current Bangkok month → today. */
export function defaultStockCardPeriod(now = new Date()): {
  fromYmd: string;
  toYmd: string;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const toYmd = fmt.format(now);
  const [y, m] = toYmd.split("-");
  return { fromYmd: `${y}-${m}-01`, toYmd };
}
