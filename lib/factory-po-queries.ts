import { SMARTGIFT_FX_CNY_THB } from "@/lib/alibaba/rates";
import {
  countOpenInboundPos,
  getFactoryPoByPoId,
  listFactoryPos,
  listFactoryPosByFactoryId,
  listFactoryPosByOrder,
} from "@/lib/factory-po-repository";
import type { FactoryPoDraft, FactoryPoRecord, FactoryPoStatus } from "@/lib/factory-po-types";
import { getOrderRepository } from "@/lib/order-repository";

export type { FactoryPoDraft } from "@/lib/factory-po-types";

export function getFactoryPo(poId: string): FactoryPoRecord | null {
  return getFactoryPoByPoId(poId);
}

export function listPosForOrder(orderId: string): FactoryPoRecord[] {
  return listFactoryPosByOrder(orderId);
}

export function listPosForFactory(factoryId: number): FactoryPoRecord[] {
  return listFactoryPosByFactoryId(factoryId);
}

export function listPos(params?: {
  q?: string;
  status?: FactoryPoStatus | "all";
}): FactoryPoRecord[] {
  return listFactoryPos(params);
}

export function countInboundPos(): number {
  return countOpenInboundPos();
}

export function draftFromOrder(orderId: string): FactoryPoDraft | null {
  const order = getOrderRepository().getOrderByOrderId(orderId);
  if (!order) return null;
  return {
    orderId: order.orderId,
    factoryName: "",
    factoryId: null,
    productName: order.productSummary,
    quantity: order.quantity,
    factoryCurrency: "CNY",
    fxCnyThb: SMARTGIFT_FX_CNY_THB,
    shipToName: order.shipToName ?? order.contactName,
    shipToPhone: order.shipToPhone ?? order.phone,
    shipToAddress: order.shipToAddress,
    shipToProvince: order.shipToProvince,
    destinationMode: "warehouse",
    receiveMode: "cross_dock",
  };
}
