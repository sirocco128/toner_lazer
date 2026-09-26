import { randomBytes } from "node:crypto";
import { bangkokDateYmd } from "@/lib/bangkok-date";
import {
  applyBalanceDelta,
  ensureDefaultLocations,
  getBalance,
  getLocationByCode,
  getLocationById,
  getMovementByKey,
  getReservation,
  insertCycleCount,
  insertMovement,
  insertReservation,
  listBalances,
  listOpenReservationsForOrder,
  sumAvailable,
  updateReservationStatus,
} from "@/lib/wms-repository";
import {
  DEFAULT_LOCATION_CODE,
  QC_LOCATION_CODE,
  type WmsBalance,
  type WmsCycleCount,
  type WmsMovement,
  type WmsReservation,
} from "@/lib/wms-types";
import { scheduleSkuOnHandMirror } from "@/lib/wms-sync";

function createPrefixedId(prefix: string, now = new Date()): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${bangkokDateYmd(now)}-${suffix}`;
}

function normalizeProductKey(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function resolveProductKey(raw: string | null | undefined): string | null {
  const key = normalizeProductKey(raw);
  return key || null;
}

function resolveLocationId(locationCodeOrId?: string | number | null): number {
  const { defaultId } = ensureDefaultLocations();
  if (typeof locationCodeOrId === "number" && locationCodeOrId > 0) {
    const loc = getLocationById(locationCodeOrId);
    if (!loc) throw new Error("location_not_found");
    return loc.id;
  }
  const code = String(locationCodeOrId || DEFAULT_LOCATION_CODE).trim();
  const loc = getLocationByCode(code || DEFAULT_LOCATION_CODE);
  if (!loc) throw new Error("location_not_found");
  return loc.id;
}

export function receiveToStock(input: {
  productKey: string;
  qty: number;
  locationCodeOrId?: string | number | null;
  receiptId: string;
  poId?: string | null;
  orderId?: string | null;
  actor?: string | null;
  memo?: string | null;
  at?: string;
}): { balance: WmsBalance; movement: WmsMovement | null } {
  const productKey = resolveProductKey(input.productKey);
  if (!productKey) throw new Error("product_key_required");
  const qty = Math.floor(input.qty);
  if (qty <= 0) throw new Error("qty_required");

  const movementKey = `gr:${input.receiptId}`;
  const existing = getMovementByKey(movementKey);
  if (existing) {
    const locId = existing.locationId;
    return {
      balance: getBalance(productKey, locId)!,
      movement: existing,
    };
  }

  const at = input.at || new Date().toISOString();
  const locationId = resolveLocationId(input.locationCodeOrId);
  const balance = applyBalanceDelta({
    productKey,
    locationId,
    qtyOnHandDelta: qty,
    at,
  });
  const movement = insertMovement({
    movementKey,
    kind: "receive",
    productKey,
    locationId,
    qtyDelta: qty,
    receiptId: input.receiptId,
    poId: input.poId ?? null,
    orderId: input.orderId ?? null,
    memo: input.memo ?? `รับเข้าคลัง ${input.receiptId}`,
    actor: input.actor ?? null,
    createdAt: at,
  });
  scheduleSkuOnHandMirror(productKey);
  return { balance, movement };
}

export function moveDamagedToQc(input: {
  productKey: string;
  qty: number;
  receiptId: string;
  poId?: string | null;
  orderId?: string | null;
  actor?: string | null;
  at?: string;
}): WmsMovement | null {
  const productKey = resolveProductKey(input.productKey);
  if (!productKey) return null;
  const qty = Math.floor(input.qty);
  if (qty <= 0) return null;

  const movementKey = `qc:${input.receiptId}`;
  const existing = getMovementByKey(movementKey);
  if (existing) return existing;

  const at = input.at || new Date().toISOString();
  const qc = getLocationByCode(QC_LOCATION_CODE);
  if (!qc) throw new Error("location_not_found");

  applyBalanceDelta({
    productKey,
    locationId: qc.id,
    qtyOnHandDelta: qty,
    at,
  });
  const movement = insertMovement({
    movementKey,
    kind: "qc_hold",
    productKey,
    locationId: qc.id,
    qtyDelta: qty,
    receiptId: input.receiptId,
    poId: input.poId ?? null,
    orderId: input.orderId ?? null,
    memo: `ของเสียเข้า QC · ${input.receiptId}`,
    actor: input.actor ?? null,
    createdAt: at,
  });
  scheduleSkuOnHandMirror(productKey);
  return movement;
}

export function voidReceiveFromStock(input: {
  receiptId: string;
  productKey: string;
  qty: number;
  locationId?: number | null;
  damagedQty?: number;
  actor?: string | null;
  at?: string;
}): void {
  const productKey = resolveProductKey(input.productKey);
  if (!productKey) throw new Error("product_key_required");
  const qty = Math.floor(input.qty);
  if (qty <= 0) throw new Error("qty_required");

  const voidKey = `void-gr:${input.receiptId}`;
  if (getMovementByKey(voidKey)) return;

  const receiveMov = getMovementByKey(`gr:${input.receiptId}`);
  const locationId =
    input.locationId || receiveMov?.locationId || resolveLocationId(DEFAULT_LOCATION_CODE);
  const at = input.at || new Date().toISOString();

  applyBalanceDelta({
    productKey,
    locationId,
    qtyOnHandDelta: -qty,
    at,
  });
  insertMovement({
    movementKey: voidKey,
    kind: "void_receive",
    productKey,
    locationId,
    qtyDelta: -qty,
    receiptId: input.receiptId,
    memo: `ยกเลิกใบรับ ${input.receiptId}`,
    actor: input.actor ?? null,
    createdAt: at,
  });

  const damaged = Math.floor(input.damagedQty ?? 0);
  if (damaged > 0) {
    const qcKey = `void-qc:${input.receiptId}`;
    if (!getMovementByKey(qcKey)) {
      const qc = getLocationByCode(QC_LOCATION_CODE);
      if (qc) {
        applyBalanceDelta({
          productKey,
          locationId: qc.id,
          qtyOnHandDelta: -damaged,
          at,
        });
        insertMovement({
          movementKey: qcKey,
          kind: "void_receive",
          productKey,
          locationId: qc.id,
          qtyDelta: -damaged,
          receiptId: input.receiptId,
          memo: `ยกเลิกของเสีย QC · ${input.receiptId}`,
          actor: input.actor ?? null,
          createdAt: at,
        });
      }
    }
  }
  scheduleSkuOnHandMirror(productKey);
}

export function reserveForOrder(input: {
  orderId: string;
  productKey: string;
  qty: number;
  locationCodeOrId?: string | number | null;
  actor?: string | null;
  at?: string;
}): WmsReservation {
  const productKey = resolveProductKey(input.productKey);
  if (!productKey) throw new Error("product_key_required");
  const qty = Math.floor(input.qty);
  if (qty <= 0) throw new Error("qty_required");
  if (!input.orderId) throw new Error("order_id_required");

  const open = listOpenReservationsForOrder(input.orderId).filter(
    (r) => r.productKey === productKey,
  );
  if (open.length > 0) return open[0]!;

  if (sumAvailable(productKey) < qty) throw new Error("insufficient_stock");

  const at = input.at || new Date().toISOString();
  const locationId = resolveLocationId(input.locationCodeOrId);
  const availableHere =
    getBalance(productKey, locationId)?.qtyAvailable ?? 0;
  let useLocationId = locationId;
  if (availableHere < qty) {
    const hit = listBalances({ productKey }).find((b) => b.qtyAvailable >= qty);
    if (!hit) throw new Error("insufficient_stock");
    useLocationId = hit.locationId;
  }

  applyBalanceDelta({
    productKey,
    locationId: useLocationId,
    qtyOnHandDelta: 0,
    qtyReservedDelta: qty,
    at,
  });
  const reservationId = createPrefixedId("RSV", new Date(at));
  const reservation = insertReservation({
    reservationId,
    orderId: input.orderId,
    productKey,
    locationId: useLocationId,
    qty,
    status: "open",
    createdAt: at,
    updatedAt: at,
    consumedAt: null,
    releasedAt: null,
  });
  insertMovement({
    movementKey: `rsv:${reservationId}`,
    kind: "reserve",
    productKey,
    locationId: useLocationId,
    qtyDelta: 0,
    qtyReservedDelta: qty,
    orderId: input.orderId,
    reservationId,
    memo: `จองสต็อกออเดอร์ ${input.orderId}`,
    actor: input.actor ?? null,
    createdAt: at,
  });
  scheduleSkuOnHandMirror(productKey);
  return reservation;
}

export function releaseReservation(input: {
  reservationId: string;
  actor?: string | null;
  at?: string;
}): void {
  const reservation = getReservation(input.reservationId);
  if (!reservation) throw new Error("reservation_not_found");
  if (reservation.status !== "open") return;

  const at = input.at || new Date().toISOString();
  const releaseKey = `rel:${reservation.reservationId}`;
  if (getMovementByKey(releaseKey)) {
    updateReservationStatus({
      reservationId: reservation.reservationId,
      status: "released",
      at,
    });
    return;
  }

  applyBalanceDelta({
    productKey: reservation.productKey,
    locationId: reservation.locationId,
    qtyOnHandDelta: 0,
    qtyReservedDelta: -reservation.qty,
    at,
  });
  insertMovement({
    movementKey: releaseKey,
    kind: "release",
    productKey: reservation.productKey,
    locationId: reservation.locationId,
    qtyDelta: 0,
    qtyReservedDelta: -reservation.qty,
    orderId: reservation.orderId,
    reservationId: reservation.reservationId,
    memo: `ปล่อยจอง ${reservation.reservationId}`,
    actor: input.actor ?? null,
    createdAt: at,
  });
  updateReservationStatus({
    reservationId: reservation.reservationId,
    status: "released",
    at,
  });
  scheduleSkuOnHandMirror(reservation.productKey);
}

export function shipFromStock(input: {
  orderId: string;
  actor?: string | null;
  at?: string;
}): WmsMovement[] {
  const open = listOpenReservationsForOrder(input.orderId);
  if (open.length === 0) return [];
  const at = input.at || new Date().toISOString();
  const out: WmsMovement[] = [];

  for (const reservation of open) {
    const shipKey = `ship:${reservation.reservationId}`;
    if (getMovementByKey(shipKey)) {
      updateReservationStatus({
        reservationId: reservation.reservationId,
        status: "consumed",
        at,
      });
      continue;
    }
    applyBalanceDelta({
      productKey: reservation.productKey,
      locationId: reservation.locationId,
      qtyOnHandDelta: -reservation.qty,
      qtyReservedDelta: -reservation.qty,
      at,
    });
    out.push(
      insertMovement({
        movementKey: shipKey,
        kind: "ship",
        productKey: reservation.productKey,
        locationId: reservation.locationId,
        qtyDelta: -reservation.qty,
        qtyReservedDelta: -reservation.qty,
        orderId: reservation.orderId,
        reservationId: reservation.reservationId,
        memo: `ตัดสต็อกส่งออเดอร์ ${reservation.orderId}`,
        actor: input.actor ?? null,
        createdAt: at,
      }),
    );
    updateReservationStatus({
      reservationId: reservation.reservationId,
      status: "consumed",
      at,
    });
    scheduleSkuOnHandMirror(reservation.productKey);
  }
  return out;
}

export function adjustStock(input: {
  productKey: string;
  qtyDelta: number;
  locationCodeOrId?: string | number | null;
  memo?: string | null;
  actor?: string | null;
  at?: string;
}): WmsBalance {
  const productKey = resolveProductKey(input.productKey);
  if (!productKey) throw new Error("product_key_required");
  const qtyDelta = Math.trunc(input.qtyDelta);
  if (qtyDelta === 0) throw new Error("qty_required");

  const at = input.at || new Date().toISOString();
  const locationId = resolveLocationId(input.locationCodeOrId);
  const balance = applyBalanceDelta({
    productKey,
    locationId,
    qtyOnHandDelta: qtyDelta,
    at,
  });
  insertMovement({
    movementKey: `adj:${createPrefixedId("ADJ", new Date(at))}`,
    kind: "adjust",
    productKey,
    locationId,
    qtyDelta,
    memo: input.memo ?? "ปรับยอดคลัง",
    actor: input.actor ?? null,
    createdAt: at,
  });
  scheduleSkuOnHandMirror(productKey);
  return balance;
}

export function transferStock(input: {
  productKey: string;
  qty: number;
  fromLocationCodeOrId: string | number;
  toLocationCodeOrId: string | number;
  memo?: string | null;
  actor?: string | null;
  at?: string;
}): void {
  const productKey = resolveProductKey(input.productKey);
  if (!productKey) throw new Error("product_key_required");
  const qty = Math.floor(input.qty);
  if (qty <= 0) throw new Error("qty_required");

  const fromId = resolveLocationId(input.fromLocationCodeOrId);
  const toId = resolveLocationId(input.toLocationCodeOrId);
  if (fromId === toId) throw new Error("same_location");

  const at = input.at || new Date().toISOString();
  const xferId = createPrefixedId("XFER", new Date(at));

  applyBalanceDelta({
    productKey,
    locationId: fromId,
    qtyOnHandDelta: -qty,
    at,
  });
  insertMovement({
    movementKey: `xfer-out:${xferId}`,
    kind: "transfer_out",
    productKey,
    locationId: fromId,
    qtyDelta: -qty,
    memo: input.memo ?? `โอนออกไป location ${toId}`,
    actor: input.actor ?? null,
    createdAt: at,
  });
  applyBalanceDelta({
    productKey,
    locationId: toId,
    qtyOnHandDelta: qty,
    at,
  });
  insertMovement({
    movementKey: `xfer-in:${xferId}`,
    kind: "transfer_in",
    productKey,
    locationId: toId,
    qtyDelta: qty,
    memo: input.memo ?? `โอนเข้าจาก location ${fromId}`,
    actor: input.actor ?? null,
    createdAt: at,
  });
  scheduleSkuOnHandMirror(productKey);
}

export function postCycleCount(input: {
  productKey: string;
  qtyCounted: number;
  locationCodeOrId?: string | number | null;
  memo?: string | null;
  actor?: string | null;
  at?: string;
}): WmsCycleCount {
  const productKey = resolveProductKey(input.productKey);
  if (!productKey) throw new Error("product_key_required");
  const qtyCounted = Math.max(0, Math.floor(input.qtyCounted));
  const at = input.at || new Date().toISOString();
  const locationId = resolveLocationId(input.locationCodeOrId);
  const system = getBalance(productKey, locationId)?.qtyOnHand ?? 0;
  const variance = qtyCounted - system;

  if (variance !== 0) {
    applyBalanceDelta({
      productKey,
      locationId,
      qtyOnHandDelta: variance,
      at,
    });
    insertMovement({
      movementKey: `cc:${createPrefixedId("CC", new Date(at))}`,
      kind: "cycle_count",
      productKey,
      locationId,
      qtyDelta: variance,
      memo: input.memo ?? `ตรวจนับ variance ${variance}`,
      actor: input.actor ?? null,
      createdAt: at,
    });
  }

  const posted = insertCycleCount({
    countId: createPrefixedId("CC", new Date(at)),
    productKey,
    locationId,
    qtySystem: system,
    qtyCounted,
    qtyVariance: variance,
    status: "posted",
    memo: input.memo ?? null,
    actor: input.actor ?? null,
    createdAt: at,
  });
  scheduleSkuOnHandMirror(productKey);
  return posted;
}
