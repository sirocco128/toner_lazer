import { listPos } from "@/lib/factory-po-queries";
import type { FactoryPoRecord } from "@/lib/factory-po-types";
import { getOrderRepository } from "@/lib/order-repository";
import type { OrderRecord } from "@/lib/order-types";
import {
  listBalances,
  listOpenReservations,
} from "@/lib/wms-repository";
import { XDOCK_LOCATION_CODE } from "@/lib/wms-types";

export function listInTransitPos(): FactoryPoRecord[] {
  return listPos({ status: "all" }).filter(
    (po) =>
      (po.status === "shipped" || po.status === "inbound") &&
      po.receivedQty < po.quantity,
  );
}

export type ReadyPackRow = {
  order: OrderRecord;
  productKey: string;
  qtyReserved: number;
  reservationId: string;
  locationCode: string;
};

/** Paid orders with open reservations sitting on cross-dock (or any open res if xdock empty). */
export function listReadyPackRows(limit = 20): ReadyPackRow[] {
  const orderRepo = getOrderRepository();
  const open = listOpenReservations(100);
  const out: ReadyPackRow[] = [];
  for (const r of open) {
    const order = orderRepo.getOrderByOrderId(r.orderId);
    if (!order || order.paymentStatus !== "paid") continue;
    if (
      order.fulfillmentStatus !== "warehouse" &&
      order.fulfillmentStatus !== "inbound"
    ) {
      continue;
    }
    const bal = listBalances({ productKey: r.productKey, limit: 20 }).find(
      (b) => b.locationId === r.locationId,
    );
    out.push({
      order,
      productKey: r.productKey,
      qtyReserved: r.qty,
      reservationId: r.reservationId,
      locationCode: bal?.locationCode || XDOCK_LOCATION_CODE,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function listXdockBalances(limit = 50) {
  return listBalances({ limit: 500 })
    .filter((b) => b.locationCode === XDOCK_LOCATION_CODE && b.qtyOnHand > 0)
    .slice(0, limit);
}
