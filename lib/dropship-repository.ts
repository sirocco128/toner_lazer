/**
 * SQLite persistence for dropship orders (see db/migrations/031).
 */

import { getDb } from "@/lib/database";
import { postDropshipCost } from "@/lib/ledger-service";
import {
  canTransitionDropship,
  formatDropshipId,
  isDropshipStatus,
  type DropshipDraft,
  type DropshipLine,
  type DropshipStatus,
} from "@/lib/dropship";

export type DropshipRecord = DropshipDraft & {
  id: number;
  dropshipId: string;
  supplier: string;
  status: DropshipStatus;
  carrier: string | null;
  trackingNo: string | null;
  createdBy: string | null;
  sentAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrderRow = {
  id: number;
  dropship_id: string;
  order_id: string | null;
  supplier: string;
  status: string;
  ship_to_name: string;
  ship_to_phone: string;
  ship_to_address: string;
  ship_to_province: string | null;
  total_qty: number;
  supplier_total_thb: number;
  box_total_thb: number;
  carrier: string | null;
  tracking_no: string | null;
  notes: string | null;
  created_by: string | null;
  sent_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

type LineRow = {
  dropship_id: string;
  line_no: number;
  sku: string;
  supplier_ref: string;
  description: string;
  qty: number;
  unit_supplier_thb: number;
  unit_box_thb: number;
};

function mapLine(row: LineRow): DropshipLine {
  return {
    lineNo: Number(row.line_no),
    sku: row.sku,
    supplierRef: row.supplier_ref,
    description: row.description,
    qty: Number(row.qty),
    unitSupplierThb: Number(row.unit_supplier_thb),
    unitBoxThb: Number(row.unit_box_thb),
  };
}

function mapOrder(row: OrderRow, lines: DropshipLine[]): DropshipRecord {
  return {
    id: Number(row.id),
    dropshipId: row.dropship_id,
    orderId: row.order_id,
    supplier: row.supplier,
    status: isDropshipStatus(row.status) ? row.status : "draft",
    shipTo: {
      name: row.ship_to_name,
      phone: row.ship_to_phone,
      address: row.ship_to_address,
      province: row.ship_to_province,
    },
    lines,
    totalQty: Number(row.total_qty),
    supplierTotalThb: Number(row.supplier_total_thb),
    boxTotalThb: Number(row.box_total_thb),
    notes: row.notes,
    carrier: row.carrier,
    trackingNo: row.tracking_no,
    createdBy: row.created_by,
    sentAt: row.sent_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function linesFor(ids: string[]): Map<string, DropshipLine[]> {
  const map = new Map<string, DropshipLine[]>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT dropship_id, line_no, sku, supplier_ref, description, qty,
              unit_supplier_thb, unit_box_thb
       FROM dropship_order_lines
       WHERE dropship_id IN (${placeholders})
       ORDER BY dropship_id, line_no`,
    )
    .all(...ids) as unknown as LineRow[];
  for (const row of rows) {
    const list = map.get(row.dropship_id) ?? [];
    list.push(mapLine(row));
    map.set(row.dropship_id, list);
  }
  return map;
}

export function createDropshipOrder(
  draft: DropshipDraft,
  actor: string | null,
  now: Date = new Date(),
): DropshipRecord {
  const db = getDb();
  const iso = now.toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const prefix = formatDropshipId(now, 0).slice(0, -4);
    const last = db
      .prepare(
        "SELECT dropship_id FROM dropship_orders WHERE dropship_id LIKE ? ORDER BY dropship_id DESC LIMIT 1",
      )
      .get(`${prefix}%`) as { dropship_id: string } | undefined;
    const seq = last ? Number(last.dropship_id.slice(-4)) + 1 : 1;
    const dropshipId = formatDropshipId(now, seq);

    db.prepare(
      `INSERT INTO dropship_orders (
         dropship_id, order_id, supplier, status, ship_to_name, ship_to_phone,
         ship_to_address, ship_to_province, total_qty, supplier_total_thb,
         box_total_thb, notes, created_by, created_at, updated_at
       ) VALUES (?, ?, 'COLORFLY', 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      dropshipId,
      draft.orderId,
      draft.shipTo.name,
      draft.shipTo.phone,
      draft.shipTo.address,
      draft.shipTo.province,
      draft.totalQty,
      draft.supplierTotalThb,
      draft.boxTotalThb,
      draft.notes,
      actor,
      iso,
      iso,
    );
    const insertLine = db.prepare(
      `INSERT INTO dropship_order_lines (
         dropship_id, line_no, sku, supplier_ref, description, qty,
         unit_supplier_thb, unit_box_thb
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const line of draft.lines) {
      insertLine.run(
        dropshipId,
        line.lineNo,
        line.sku,
        line.supplierRef,
        line.description,
        line.qty,
        line.unitSupplierThb,
        line.unitBoxThb,
      );
    }
    db.exec("COMMIT");
    const created = getDropshipOrder(dropshipId);
    if (!created) throw new Error("dropship_not_found");
    return created;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // already rolled back
    }
    throw error;
  }
}

export function getDropshipOrder(dropshipId: string): DropshipRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM dropship_orders WHERE dropship_id = ?")
    .get(dropshipId) as OrderRow | undefined;
  if (!row) return null;
  return mapOrder(row, linesFor([row.dropship_id]).get(row.dropship_id) ?? []);
}

export function listDropshipOrders(options?: {
  status?: DropshipStatus;
  orderId?: string;
  limit?: number;
}): DropshipRecord[] {
  const where: string[] = [];
  const params: string[] = [];
  if (options?.status) {
    where.push("status = ?");
    params.push(options.status);
  }
  if (options?.orderId) {
    where.push("order_id = ?");
    params.push(options.orderId);
  }
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const rows = getDb()
    .prepare(
      `SELECT * FROM dropship_orders
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit}`,
    )
    .all(...params) as unknown as OrderRow[];
  const lines = linesFor(rows.map((r) => r.dropship_id));
  return rows.map((r) => mapOrder(r, lines.get(r.dropship_id) ?? []));
}

/**
 * Move a dropship order forward. `shipped` requires a tracking number.
 * Errors: dropship_not_found · invalid_transition · tracking_required
 */
export function setDropshipStatus(input: {
  dropshipId: string;
  status: DropshipStatus;
  trackingNo?: string | null;
  carrier?: string | null;
  now?: Date;
}): DropshipRecord {
  const current = getDropshipOrder(input.dropshipId);
  if (!current) throw new Error("dropship_not_found");
  if (!canTransitionDropship(current.status, input.status)) {
    throw new Error("invalid_transition");
  }
  const tracking = input.trackingNo?.trim() || null;
  if (input.status === "shipped" && !tracking) throw new Error("tracking_required");

  const iso = (input.now ?? new Date()).toISOString();
  const stampColumn =
    input.status === "sent"
      ? "sent_at"
      : input.status === "shipped"
        ? "shipped_at"
        : input.status === "delivered"
          ? "delivered_at"
          : null;

  getDb()
    .prepare(
      `UPDATE dropship_orders SET
         status = ?,
         tracking_no = COALESCE(?, tracking_no),
         carrier = COALESCE(?, carrier),
         ${stampColumn ? `${stampColumn} = ?,` : ""}
         updated_at = ?
       WHERE dropship_id = ?`,
    )
    .run(
      ...([
        input.status,
        tracking,
        input.carrier?.trim() || null,
        ...(stampColumn ? [iso] : []),
        iso,
        input.dropshipId,
      ] as (string | null)[]),
    );
  const updated = getDropshipOrder(input.dropshipId);
  if (!updated) throw new Error("dropship_not_found");
  if (input.status === "sent" || input.status === "cancelled") {
    postDropshipCost({
      dropshipId: updated.dropshipId,
      orderId: updated.orderId,
      status: updated.status,
      supplierTotalThb: updated.supplierTotalThb,
      boxTotalThb: updated.boxTotalThb,
      at: iso,
    });
  }
  return updated;
}

/** Supplier goods + box cost of every non-cancelled, non-draft dropship per order. */
export function dropshipCostByOrder(orderId: string): { goodsThb: number; boxThb: number } {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(supplier_total_thb), 0) AS goods, COALESCE(SUM(box_total_thb), 0) AS box
         FROM dropship_orders
        WHERE order_id = ? AND status NOT IN ('draft', 'cancelled')`,
    )
    .get(orderId) as { goods: number; box: number } | undefined;
  return { goodsThb: Number(row?.goods ?? 0), boxThb: Number(row?.box ?? 0) };
}
