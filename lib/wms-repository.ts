import { getDb } from "@/lib/database";
import {
  DEFAULT_LOCATION_CODE,
  QC_LOCATION_CODE,
  XDOCK_LOCATION_CODE,
  type WmsBalance,
  type WmsCycleCount,
  type WmsLocation,
  type WmsMovement,
  type WmsMovementKind,
  type WmsReservation,
  type WmsReservationStatus,
  type WmsWarehouse,
} from "@/lib/wms-types";

type LocRow = {
  id: number;
  location_code: string;
  warehouse_code: string;
  name: string;
  kind: string;
  status: string;
  created_at: string;
};

type BalRow = {
  id: number;
  product_key: string;
  location_id: number;
  qty_on_hand: number;
  qty_reserved: number;
  updated_at: string;
  location_code?: string;
  location_name?: string;
  warehouse_code?: string;
};

type MovRow = {
  id: number;
  movement_key: string;
  kind: string;
  product_key: string;
  location_id: number;
  qty_delta: number;
  qty_reserved_delta: number;
  receipt_id: string | null;
  order_id: string | null;
  po_id: string | null;
  reservation_id: string | null;
  memo: string | null;
  actor: string | null;
  created_at: string;
};

type ResRow = {
  id: number;
  reservation_id: string;
  order_id: string;
  product_key: string;
  location_id: number;
  qty: number;
  status: string;
  created_at: string;
  updated_at: string;
  consumed_at: string | null;
  released_at: string | null;
};

function mapLoc(row: LocRow): WmsLocation {
  return {
    id: row.id,
    locationCode: row.location_code,
    warehouseCode: row.warehouse_code,
    name: row.name,
    kind: row.kind,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapBal(row: BalRow): WmsBalance {
  return {
    id: row.id,
    productKey: row.product_key,
    locationId: row.location_id,
    qtyOnHand: row.qty_on_hand,
    qtyReserved: row.qty_reserved,
    qtyAvailable: Math.max(0, row.qty_on_hand - row.qty_reserved),
    updatedAt: row.updated_at,
    locationCode: row.location_code,
    locationName: row.location_name,
    warehouseCode: row.warehouse_code,
  };
}

function mapMov(row: MovRow): WmsMovement {
  return {
    id: row.id,
    movementKey: row.movement_key,
    kind: row.kind,
    productKey: row.product_key,
    locationId: row.location_id,
    qtyDelta: row.qty_delta,
    qtyReservedDelta: row.qty_reserved_delta,
    receiptId: row.receipt_id,
    orderId: row.order_id,
    poId: row.po_id,
    reservationId: row.reservation_id,
    memo: row.memo,
    actor: row.actor,
    createdAt: row.created_at,
  };
}

function mapRes(row: ResRow): WmsReservation {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    orderId: row.order_id,
    productKey: row.product_key,
    locationId: row.location_id,
    qty: row.qty,
    status: row.status as WmsReservationStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    consumedAt: row.consumed_at,
    releasedAt: row.released_at,
  };
}

export function listWarehouses(): WmsWarehouse[] {
  const rows = getDb()
    .prepare(
      `SELECT id, warehouse_code, name, status, created_at
       FROM wms_warehouses ORDER BY warehouse_code`,
    )
    .all() as Array<{
    id: number;
    warehouse_code: string;
    name: string;
    status: string;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    warehouseCode: r.warehouse_code,
    name: r.name,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export function listLocations(params?: { kind?: string }): WmsLocation[] {
  if (params?.kind) {
    return (
      getDb()
        .prepare(
          `SELECT * FROM wms_locations WHERE status = 'active' AND kind = ?
           ORDER BY location_code`,
        )
        .all(params.kind) as LocRow[]
    ).map(mapLoc);
  }
  return (
    getDb()
      .prepare(
        `SELECT * FROM wms_locations WHERE status = 'active'
         ORDER BY location_code`,
      )
      .all() as LocRow[]
  ).map(mapLoc);
}

export function getLocationByCode(code: string): WmsLocation | null {
  const row = getDb()
    .prepare(`SELECT * FROM wms_locations WHERE location_code = ?`)
    .get(code) as LocRow | undefined;
  return row ? mapLoc(row) : null;
}

export function getLocationById(id: number): WmsLocation | null {
  const row = getDb()
    .prepare(`SELECT * FROM wms_locations WHERE id = ?`)
    .get(id) as LocRow | undefined;
  return row ? mapLoc(row) : null;
}

export function ensureDefaultLocations(): {
  defaultId: number;
  qcId: number;
  xdockId: number;
} {
  const def = getLocationByCode(DEFAULT_LOCATION_CODE);
  const qc = getLocationByCode(QC_LOCATION_CODE);
  let xdock = getLocationByCode(XDOCK_LOCATION_CODE);
  if (!xdock) {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT OR IGNORE INTO wms_locations (
          location_code, warehouse_code, name, kind, status, created_at
        ) VALUES (?, 'WH-MAIN', 'จุดแพ็ก Cross-Dock', 'staging', 'active', ?)`,
      )
      .run(XDOCK_LOCATION_CODE, now);
    xdock = getLocationByCode(XDOCK_LOCATION_CODE);
  }
  if (!def || !qc || !xdock) throw new Error("wms_locations_missing");
  return { defaultId: def.id, qcId: qc.id, xdockId: xdock.id };
}

export function getBalance(
  productKey: string,
  locationId: number,
): WmsBalance | null {
  const row = getDb()
    .prepare(
      `SELECT b.*, l.location_code, l.name AS location_name, l.warehouse_code
       FROM wms_balances b
       JOIN wms_locations l ON l.id = b.location_id
       WHERE b.product_key = ? AND b.location_id = ?`,
    )
    .get(productKey, locationId) as BalRow | undefined;
  return row ? mapBal(row) : null;
}

export function listBalances(params?: {
  productKey?: string;
  limit?: number;
}): WmsBalance[] {
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 5000);
  if (params?.productKey) {
    return (
      getDb()
        .prepare(
          `SELECT b.*, l.location_code, l.name AS location_name, l.warehouse_code
           FROM wms_balances b
           JOIN wms_locations l ON l.id = b.location_id
           WHERE b.product_key = ?
           ORDER BY l.location_code
           LIMIT ?`,
        )
        .all(params.productKey, limit) as BalRow[]
    ).map(mapBal);
  }
  return (
    getDb()
      .prepare(
        `SELECT b.*, l.location_code, l.name AS location_name, l.warehouse_code
         FROM wms_balances b
         JOIN wms_locations l ON l.id = b.location_id
         WHERE b.qty_on_hand > 0 OR b.qty_reserved > 0
         ORDER BY b.product_key, l.location_code
         LIMIT ?`,
      )
      .all(limit) as BalRow[]
  ).map(mapBal);
}

export function sumOnHand(productKey: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(qty_on_hand), 0) AS qty
       FROM wms_balances WHERE product_key = ?`,
    )
    .get(productKey) as { qty: number };
  return Number(row.qty) || 0;
}

export function sumAvailable(productKey: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(qty_on_hand - qty_reserved), 0) AS qty
       FROM wms_balances WHERE product_key = ?`,
    )
    .get(productKey) as { qty: number };
  return Number(row.qty) || 0;
}

export function getMovementByKey(movementKey: string): WmsMovement | null {
  const row = getDb()
    .prepare(`SELECT * FROM wms_movements WHERE movement_key = ?`)
    .get(movementKey) as MovRow | undefined;
  return row ? mapMov(row) : null;
}

export function listMovements(params?: {
  productKey?: string;
  orderId?: string;
  limit?: number;
}): WmsMovement[] {
  const limit = Math.min(Math.max(params?.limit ?? 100, 1), 500);
  if (params?.orderId) {
    return (
      getDb()
        .prepare(
          `SELECT * FROM wms_movements WHERE order_id = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(params.orderId, limit) as MovRow[]
    ).map(mapMov);
  }
  if (params?.productKey) {
    return (
      getDb()
        .prepare(
          `SELECT * FROM wms_movements WHERE product_key = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(params.productKey, limit) as MovRow[]
    ).map(mapMov);
  }
  return (
    getDb()
      .prepare(
        `SELECT * FROM wms_movements ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as MovRow[]
  ).map(mapMov);
}

/** Apply on-hand / reserved delta with non-negative fail-closed checks. */
export function applyBalanceDelta(params: {
  productKey: string;
  locationId: number;
  qtyOnHandDelta: number;
  qtyReservedDelta?: number;
  at: string;
}): WmsBalance {
  const reservedDelta = params.qtyReservedDelta ?? 0;
  const existing = getBalance(params.productKey, params.locationId);
  const nextOnHand = (existing?.qtyOnHand ?? 0) + params.qtyOnHandDelta;
  const nextReserved = (existing?.qtyReserved ?? 0) + reservedDelta;
  if (nextOnHand < 0) throw new Error("insufficient_stock");
  if (nextReserved < 0) throw new Error("insufficient_reservation");
  if (nextReserved > nextOnHand) throw new Error("reservation_exceeds_on_hand");

  if (existing) {
    getDb()
      .prepare(
        `UPDATE wms_balances
         SET qty_on_hand = ?, qty_reserved = ?, updated_at = ?
         WHERE product_key = ? AND location_id = ?`,
      )
      .run(
        nextOnHand,
        nextReserved,
        params.at,
        params.productKey,
        params.locationId,
      );
  } else {
    getDb()
      .prepare(
        `INSERT INTO wms_balances (
          product_key, location_id, qty_on_hand, qty_reserved, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        params.productKey,
        params.locationId,
        nextOnHand,
        nextReserved,
        params.at,
      );
  }
  return getBalance(params.productKey, params.locationId)!;
}

export function insertMovement(row: {
  movementKey: string;
  kind: WmsMovementKind | string;
  productKey: string;
  locationId: number;
  qtyDelta: number;
  qtyReservedDelta?: number;
  receiptId?: string | null;
  orderId?: string | null;
  poId?: string | null;
  reservationId?: string | null;
  memo?: string | null;
  actor?: string | null;
  createdAt: string;
}): WmsMovement {
  getDb()
    .prepare(
      `INSERT INTO wms_movements (
        movement_key, kind, product_key, location_id, qty_delta, qty_reserved_delta,
        receipt_id, order_id, po_id, reservation_id, memo, actor, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.movementKey,
      row.kind,
      row.productKey,
      row.locationId,
      row.qtyDelta,
      row.qtyReservedDelta ?? 0,
      row.receiptId ?? null,
      row.orderId ?? null,
      row.poId ?? null,
      row.reservationId ?? null,
      row.memo ?? null,
      row.actor ?? null,
      row.createdAt,
    );
  return getMovementByKey(row.movementKey)!;
}

export function insertReservation(row: Omit<WmsReservation, "id">): WmsReservation {
  getDb()
    .prepare(
      `INSERT INTO wms_reservations (
        reservation_id, order_id, product_key, location_id, qty, status,
        created_at, updated_at, consumed_at, released_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.reservationId,
      row.orderId,
      row.productKey,
      row.locationId,
      row.qty,
      row.status,
      row.createdAt,
      row.updatedAt,
      row.consumedAt,
      row.releasedAt,
    );
  return getReservation(row.reservationId)!;
}

export function getReservation(reservationId: string): WmsReservation | null {
  const row = getDb()
    .prepare(`SELECT * FROM wms_reservations WHERE reservation_id = ?`)
    .get(reservationId) as ResRow | undefined;
  return row ? mapRes(row) : null;
}

export function listOpenReservationsForOrder(orderId: string): WmsReservation[] {
  return (
    getDb()
      .prepare(
        `SELECT * FROM wms_reservations
         WHERE order_id = ? AND status = 'open'
         ORDER BY created_at`,
      )
      .all(orderId) as ResRow[]
  ).map(mapRes);
}

export function listReservationsForOrder(orderId: string): WmsReservation[] {
  return (
    getDb()
      .prepare(
        `SELECT * FROM wms_reservations WHERE order_id = ?
         ORDER BY created_at DESC`,
      )
      .all(orderId) as ResRow[]
  ).map(mapRes);
}

export function updateReservationStatus(params: {
  reservationId: string;
  status: WmsReservationStatus;
  at: string;
}): void {
  const consumedAt = params.status === "consumed" ? params.at : null;
  const releasedAt = params.status === "released" ? params.at : null;
  getDb()
    .prepare(
      `UPDATE wms_reservations
       SET status = ?, updated_at = ?,
           consumed_at = COALESCE(?, consumed_at),
           released_at = COALESCE(?, released_at)
       WHERE reservation_id = ?`,
    )
    .run(
      params.status,
      params.at,
      consumedAt,
      releasedAt,
      params.reservationId,
    );
}

export function insertCycleCount(row: Omit<WmsCycleCount, "id">): WmsCycleCount {
  getDb()
    .prepare(
      `INSERT INTO wms_cycle_counts (
        count_id, product_key, location_id, qty_system, qty_counted, qty_variance,
        status, memo, actor, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.countId,
      row.productKey,
      row.locationId,
      row.qtySystem,
      row.qtyCounted,
      row.qtyVariance,
      row.status,
      row.memo,
      row.actor,
      row.createdAt,
    );
  return getCycleCount(row.countId)!;
}

export function getCycleCount(countId: string): WmsCycleCount | null {
  const row = getDb()
    .prepare(`SELECT * FROM wms_cycle_counts WHERE count_id = ?`)
    .get(countId) as
    | {
        id: number;
        count_id: string;
        product_key: string;
        location_id: number;
        qty_system: number;
        qty_counted: number;
        qty_variance: number;
        status: string;
        memo: string | null;
        actor: string | null;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    countId: row.count_id,
    productKey: row.product_key,
    locationId: row.location_id,
    qtySystem: row.qty_system,
    qtyCounted: row.qty_counted,
    qtyVariance: row.qty_variance,
    status: row.status,
    memo: row.memo,
    actor: row.actor,
    createdAt: row.created_at,
  };
}

export function listCycleCounts(limit = 50): WmsCycleCount[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM wms_cycle_counts ORDER BY created_at DESC LIMIT ?`,
    )
    .all(Math.min(Math.max(limit, 1), 200)) as Array<{
    id: number;
    count_id: string;
    product_key: string;
    location_id: number;
    qty_system: number;
    qty_counted: number;
    qty_variance: number;
    status: string;
    memo: string | null;
    actor: string | null;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    countId: row.count_id,
    productKey: row.product_key,
    locationId: row.location_id,
    qtySystem: row.qty_system,
    qtyCounted: row.qty_counted,
    qtyVariance: row.qty_variance,
    status: row.status,
    memo: row.memo,
    actor: row.actor,
    createdAt: row.created_at,
  }));
}

export function listOpenReservations(limit = 100): WmsReservation[] {
  const cap = Math.min(Math.max(limit, 1), 500);
  return (
    getDb()
      .prepare(
        `SELECT * FROM wms_reservations
         WHERE status = 'open'
         ORDER BY created_at ASC
         LIMIT ?`,
      )
      .all(cap) as ResRow[]
  ).map(mapRes);
}

export function listOpenReservationsForProduct(
  productKey: string,
): WmsReservation[] {
  return (
    getDb()
      .prepare(
        `SELECT * FROM wms_reservations
         WHERE status = 'open' AND product_key = ?
         ORDER BY created_at ASC`,
      )
      .all(productKey) as ResRow[]
  ).map(mapRes);
}

export function listQcBalances(limit = 100): WmsBalance[] {
  const cap = Math.min(Math.max(limit, 1), 500);
  return (
    getDb()
      .prepare(
        `SELECT b.*, l.location_code, l.name AS location_name, l.warehouse_code
         FROM wms_balances b
         JOIN wms_locations l ON l.id = b.location_id
         WHERE l.kind = 'qc' AND b.qty_on_hand > 0
         ORDER BY b.qty_on_hand DESC
         LIMIT ?`,
      )
      .all(cap) as BalRow[]
  ).map(mapBal);
}

export function stockDashboard(): {
  skuCount: number;
  onHandUnits: number;
  reservedUnits: number;
  availableUnits: number;
  openReservations: number;
  qcUnits: number;
  lowStockSkus: number;
} {
  const bal = getDb()
    .prepare(
      `SELECT
         COUNT(DISTINCT product_key) AS sku_count,
         COALESCE(SUM(qty_on_hand), 0) AS on_hand,
         COALESCE(SUM(qty_reserved), 0) AS reserved
       FROM wms_balances`,
    )
    .get() as { sku_count: number; on_hand: number; reserved: number };
  const openRes = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM wms_reservations WHERE status = 'open'`,
    )
    .get() as { n: number };
  const qc = getDb()
    .prepare(
      `SELECT COALESCE(SUM(b.qty_on_hand), 0) AS qty
       FROM wms_balances b
       JOIN wms_locations l ON l.id = b.location_id
       WHERE l.kind = 'qc'`,
    )
    .get() as { qty: number };
  const low = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT product_key
         FROM wms_balances
         GROUP BY product_key
         HAVING SUM(qty_on_hand - qty_reserved) > 0
            AND SUM(qty_on_hand - qty_reserved) <= 5
       )`,
    )
    .get() as { n: number };
  return {
    skuCount: Number(bal.sku_count) || 0,
    onHandUnits: Number(bal.on_hand) || 0,
    reservedUnits: Number(bal.reserved) || 0,
    availableUnits: Math.max(0, (Number(bal.on_hand) || 0) - (Number(bal.reserved) || 0)),
    openReservations: Number(openRes.n) || 0,
    qcUnits: Number(qc.qty) || 0,
    lowStockSkus: Number(low.n) || 0,
  };
}
