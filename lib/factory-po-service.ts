import { randomBytes } from "node:crypto";
import { FACTORY_MARKET_FX_USD_THB, SMARTGIFT_FX_CNY_THB } from "@/lib/alibaba/rates";
import {
  getFactoryPoByPoId,
  insertFactoryPo,
  patchFactoryPoAsn,
  updateFactoryPo,
} from "@/lib/factory-po-repository";
import {
  FACTORY_PO_STATUSES,
  isFactoryPlatform,
  isFactoryPoStatus,
  isFactoryCurrency,
  isFreightMode,
  type FactoryPlatform,
  type FactoryPoRecord,
  type FactoryPoStatus,
  type FactoryCurrency,
  type FreightMode,
} from "@/lib/factory-po-types";
import { resolveFactoryForPo } from "@/lib/factory-registry-service";
import { factoryContactLine } from "@/lib/factory-registry-types";
import { postPoLandedCost } from "@/lib/ledger-service";
import { patchPoReceived } from "@/lib/ops-cycle-repository";
import { isDestination } from "@/lib/ops-cycle-types";
import { getOrderRepository } from "@/lib/order-repository";
import { computePoCost } from "@/lib/po-cost";
import { bangkokDateYmd } from "@/lib/bangkok-date";

const PO_FLOW: FactoryPoStatus[] = FACTORY_PO_STATUSES.filter((s) => s !== "cancelled");

function createPoId(now = new Date()): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `FPO-${bangkokDateYmd(now)}-${suffix}`;
}

function blankToNull(value: string | null | undefined): string | null {
  const text = String(value || "").trim();
  return text ? text : null;
}

export type SaveFactoryPoInput = {
  poId?: string;
  orderId: string;
  status?: FactoryPoStatus;
  factoryId?: number | null;
  factoryName: string;
  factoryContact?: string | null;
  factoryPlatform?: string;
  sourceOfferId?: string | null;
  productName?: string;
  quantity?: number;
  color?: string | null;
  material?: string | null;
  decorationMethod?: string | null;
  logoPosition?: string | null;
  logoNotes?: string | null;
  packagingNotes?: string | null;
  qcNotes?: string | null;
  factoryCurrency?: string;
  fxCnyThb?: number;
  factoryUnitCny?: number;
  factoryAmountCny?: number;
  inlandThb?: number;
  freightThb?: number;
  importDutyThb?: number;
  customsFeeThb?: number;
  packingThb?: number;
  lastMileThb?: number;
  freightMode?: string | null;
  shipToName?: string | null;
  shipToPhone?: string | null;
  shipToAddress?: string | null;
  shipToProvince?: string | null;
  trackingCn?: string | null;
  trackingTh?: string | null;
  notes?: string | null;
  destinationMode?: string | null;
  receiveMode?: string | null;
  asnEta?: string | null;
  asnQty?: number | null;
  asnContainer?: string | null;
  actor?: string | null;
};

function assertStatusTransition(from: FactoryPoStatus, to: FactoryPoStatus): void {
  if (from === to) return;
  if (from === "cancelled") throw new Error("po_status_locked");
  if (to === "cancelled") return;
  const fromIdx = PO_FLOW.indexOf(from);
  const toIdx = PO_FLOW.indexOf(to);
  if (toIdx < fromIdx) throw new Error("invalid_po_transition");
}

export function saveFactoryPo(input: SaveFactoryPoInput): FactoryPoRecord {
  const order = getOrderRepository().getOrderByOrderId(input.orderId);
  if (!order) throw new Error("order_not_found");

  const existing = input.poId ? getFactoryPoByPoId(input.poId) : null;
  const factoryIdRaw = Number(input.factoryId || 0);
  const linked = resolveFactoryForPo(factoryIdRaw || null, Boolean(existing));
  const factoryName = (input.factoryName || linked?.name || "").trim();
  if (!factoryName) throw new Error("factory_name_required");

  const quantity = Math.max(1, Math.floor(input.quantity || order.quantity || 1));
  const platformRaw = input.factoryPlatform || linked?.platform || "other";
  const factoryPlatform: FactoryPlatform = isFactoryPlatform(platformRaw)
    ? platformRaw
    : "other";
  const freightMode: FreightMode | null = input.freightMode && isFreightMode(input.freightMode)
    ? input.freightMode
    : null;
  const factoryCurrency: FactoryCurrency = isFactoryCurrency(input.factoryCurrency || "")
    ? (input.factoryCurrency as FactoryCurrency)
    : existing?.factoryCurrency ?? linked?.defaultCurrency ?? "CNY";
  const defaultFx =
    factoryCurrency === "USD" ? FACTORY_MARKET_FX_USD_THB : SMARTGIFT_FX_CNY_THB;

  const cost = computePoCost({
    quantity,
    factoryUnitCny: input.factoryUnitCny ?? 0,
    factoryAmountCny: input.factoryAmountCny,
    fxCnyThb: input.fxCnyThb ?? defaultFx,
    inlandThb: input.inlandThb ?? 0,
    freightThb: input.freightThb ?? 0,
    importDutyThb: input.importDutyThb ?? 0,
    customsFeeThb: input.customsFeeThb ?? 0,
    packingThb: input.packingThb ?? 0,
    lastMileThb: input.lastMileThb ?? 0,
  });

  const now = new Date().toISOString();
  const status: FactoryPoStatus = input.status && isFactoryPoStatus(input.status)
    ? input.status
    : existing?.status ?? "draft";
  if (existing) assertStatusTransition(existing.status, status);

  const record = {
    poId: existing?.poId ?? createPoId(),
    orderId: order.orderId,
    status,
    factoryId: linked?.id ?? (existing && factoryIdRaw ? factoryIdRaw : null),
    factoryName,
    factoryContact:
      blankToNull(input.factoryContact) ??
      (linked ? blankToNull(factoryContactLine(linked)) : null),
    factoryPlatform,
    sourceOfferId: blankToNull(input.sourceOfferId),
    productName: (input.productName || order.productSummary).trim() || order.productSummary,
    quantity,
    color: blankToNull(input.color),
    material: blankToNull(input.material),
    decorationMethod: blankToNull(input.decorationMethod),
    logoPosition: blankToNull(input.logoPosition),
    logoNotes: blankToNull(input.logoNotes),
    packagingNotes: blankToNull(input.packagingNotes),
    qcNotes: blankToNull(input.qcNotes),
    factoryCurrency,
    fxCnyThb: input.fxCnyThb ?? defaultFx,
    factoryUnitCny: input.factoryUnitCny ?? 0,
    factoryAmountCny: cost.factoryAmountCny,
    factoryThb: cost.factoryThb,
    inlandThb: cost.inlandThb,
    freightThb: cost.freightThb,
    importDutyThb: cost.importDutyThb,
    customsFeeThb: cost.customsFeeThb,
    packingThb: cost.packingThb,
    lastMileThb: cost.lastMileThb,
    landedTotalThb: cost.landedTotalThb,
    freightMode,
    shipToName: blankToNull(input.shipToName) ?? order.shipToName ?? order.contactName,
    shipToPhone: blankToNull(input.shipToPhone) ?? order.shipToPhone ?? order.phone,
    shipToAddress: blankToNull(input.shipToAddress) ?? order.shipToAddress,
    shipToProvince: blankToNull(input.shipToProvince) ?? order.shipToProvince,
    trackingCn: blankToNull(input.trackingCn),
    trackingTh: blankToNull(input.trackingTh),
    notes: blankToNull(input.notes),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const saved = existing ? updateFactoryPo(record) : insertFactoryPo(record);
  const destinationRaw = input.destinationMode || existing?.destinationMode || "warehouse";
  const destinationMode = isDestination(destinationRaw) ? destinationRaw : "warehouse";
  patchPoReceived({
    poId: saved.poId,
    receivedQty: existing?.receivedQty ?? 0,
    destinationMode,
    at: now,
  });
  const resolvedReceiveMode =
    input.receiveMode === "stock" || input.receiveMode === "cross_dock"
      ? input.receiveMode
      : existing?.receiveMode === "stock"
        ? "stock"
        : "cross_dock";
  const asnQtyNum =
    input.asnQty == null || String(input.asnQty).trim() === ""
      ? (existing?.asnQty ?? null)
      : Math.max(0, Math.floor(Number(input.asnQty)));
  patchFactoryPoAsn({
    poId: saved.poId,
    receiveMode: resolvedReceiveMode,
    asnEta: blankToNull(input.asnEta) ?? existing?.asnEta ?? null,
    asnQty: Number.isFinite(asnQtyNum as number) ? asnQtyNum : existing?.asnQty ?? null,
    asnContainer:
      blankToNull(input.asnContainer) ?? existing?.asnContainer ?? null,
    at: now,
  });
  const withDest = getFactoryPoByPoId(saved.poId) ?? saved;
  postPoLandedCost({ po: withDest, actor: input.actor, at: now });
  getOrderRepository().insertEvent({
    orderId: order.orderId,
    eventType: "factory_po",
    message: existing
      ? `อัปเดตใบสั่งโรงงาน ${withDest.poId} · ${withDest.status}`
      : `สร้างใบสั่งโรงงาน ${withDest.poId}`,
    actor: input.actor ?? null,
    createdAt: now,
  });
  return withDest;
}

export {
  countInboundPos,
  draftFromOrder,
  getFactoryPo,
  listPos,
  listPosForFactory,
  listPosForOrder,
} from "@/lib/factory-po-queries";
