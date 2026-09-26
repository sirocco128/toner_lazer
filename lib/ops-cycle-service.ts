import { randomBytes } from "node:crypto";
import { getFactoryPo } from "@/lib/factory-po-queries";
import { postCashReceived, postInventoryReceipt, postSupplierPayment } from "@/lib/ledger-service";
import {
  confirmCashReceiptRow,
  getCashReceipt,
  getCashReceiptByAccessToken,
  getClaim,
  getClaimByIssueId,
  getClaimByReceiptId,
  getGoodsReceipt,
  getIssue,
  insertAsset,
  insertCashReceipt,
  insertClaim,
  insertGoodsReceipt,
  insertIssue,
  insertSupplierPayment,
  listAssets,
  listCashReceipts,
  listClaims,
  listGoodsReceipts,
  listIssues,
  listSupplierPayments,
  setCashReceiptAccessToken,
  setCashReceiptRejectReason,
  setCashReceiptTags,
  setGoodsReceiptStatus,
  sumReceivedAmount,
  sumReceivedQty,
  sumSupplierPaid,
  updateClaimStatus,
  updateIssueStatus,
  patchPoReceived,
} from "@/lib/ops-cycle-repository";
import { parseOpsTags } from "@/lib/ops-tags";
import {
  isCashLineKind,
  isClaimAgainst,
  isClaimStatus,
  isDestination,
  isIssueCategory,
  isIssueStatus,
  type AssetRecord,
  type CashLineKind,
  type CashReceiptRecord,
  type ClaimAgainst,
  type ClaimRecord,
  type ClaimStatus,
  type DestinationMode,
  type GoodsReceiptRecord,
  type IssueCategory,
  type IssueStatus,
  type IssueTicketRecord,
  type PayableKind,
  type SupplierPaymentRecord,
} from "@/lib/ops-cycle-types";
import { isPayableKind } from "@/lib/ops-cycle-types";
import { getOrderRepository } from "@/lib/order-repository";
import { confirmPayment, normalizeRejectReason, rejectPayment, updateOrderFulfillment } from "@/lib/order-service";
import { costFromPo } from "@/lib/po-cost";
import { buildPromptPayPayload, getPromptPayConfig } from "@/lib/promptpay";
import { bangkokDateYmd } from "@/lib/bangkok-date";
import { roundSatang } from "@/lib/th-billing";
import {
  getLocationByCode,
  ensureDefaultLocations,
} from "@/lib/wms-repository";
import {
  moveDamagedToQc,
  receiveToStock,
  reserveForOrder,
  resolveProductKey,
  shipFromStock,
  voidReceiveFromStock,
} from "@/lib/wms-service";
import { deleteJournalBySourceKey } from "@/lib/ledger-repository";
import { DEFAULT_LOCATION_CODE, XDOCK_LOCATION_CODE } from "@/lib/wms-types";

function createPrefixedId(prefix: string, now = new Date()): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${bangkokDateYmd(now)}-${suffix}`;
}

function blankToNull(value: string | null | undefined): string | null {
  const text = String(value || "").trim();
  return text ? text : null;
}

export type FactoryPayableSnapshot = {
  poId: string;
  orderedQty: number;
  receivedQty: number;
  remainingQty: number;
  receivedAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  freightAccrued: number;
  freightPaid: number;
  unpaidFreight: number;
  unitThb: number;
  destination: DestinationMode;
};

export function factoryPayableSnapshot(poId: string): FactoryPayableSnapshot | null {
  const po = getFactoryPo(poId);
  if (!po) return null;
  const cost = costFromPo(po);
  const unitThb = po.quantity > 0 ? roundSatang(cost.productCostThb / po.quantity) : 0;
  const receivedQty = sumReceivedQty(poId);
  const receivedAmount = roundSatang(sumReceivedAmount(poId));
  const paidAmount = roundSatang(sumSupplierPaid(poId, "factory"));
  const freightAccrued = roundSatang(
    cost.freightThb + cost.importDutyThb + cost.customsFeeThb + cost.packingThb + cost.lastMileThb,
  );
  const freightPaid = roundSatang(sumSupplierPaid(poId, "freight"));
  return {
    poId,
    orderedQty: po.quantity,
    receivedQty,
    remainingQty: Math.max(0, po.quantity - receivedQty),
    receivedAmount,
    paidAmount,
    unpaidAmount: roundSatang(Math.max(0, receivedAmount - paidAmount)),
    freightAccrued,
    freightPaid,
    unpaidFreight: roundSatang(Math.max(0, freightAccrued - freightPaid)),
    unitThb,
    destination: po.destinationMode,
  };
}

function tryAdvanceOrder(params: {
  orderId: string;
  status: "warehouse" | "inbound" | "out_for_delivery";
  actor?: string | null;
  skipWarehouse?: boolean;
}): void {
  try {
    updateOrderFulfillment({
      orderId: params.orderId,
      status: params.status,
      actor: params.actor,
      skipWarehouse: params.skipWarehouse,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (
      code === "deposit_required" ||
      code === "balance_required" ||
      code === "invalid_transition" ||
      code === "status_locked" ||
      code === "invalid_status"
    ) {
      return;
    }
    throw error;
  }
}

export function receiveGoods(input: {
  poId: string;
  qtyReceived: number;
  qtyDamaged?: number;
  destination?: string | null;
  qcNotes?: string | null;
  trackingTh?: string | null;
  productKey?: string | null;
  locationCode?: string | null;
  receiveMode?: "stock" | "cross_dock" | null;
  actor?: string | null;
}): GoodsReceiptRecord {
  const po = getFactoryPo(input.poId);
  if (!po) throw new Error("po_not_found");
  if (po.status === "cancelled" || po.status === "draft") {
    throw new Error("po_not_receivable");
  }
  const qtyReceived = Math.max(0, Math.floor(input.qtyReceived));
  const qtyDamaged = Math.max(0, Math.floor(input.qtyDamaged ?? 0));
  if (qtyReceived <= 0) throw new Error("qty_required");

  const already = sumReceivedQty(po.poId);
  if (already + qtyReceived > po.quantity) {
    throw new Error("over_received");
  }

  const destRaw = input.destination || po.destinationMode;
  const destination: DestinationMode = isDestination(destRaw) ? destRaw : "warehouse";
  const productKey =
    resolveProductKey(input.productKey) ||
    resolveProductKey(po.sourceOfferId);
  if (destination === "warehouse" && !productKey) {
    throw new Error("product_key_required");
  }

  let locationId: number | null = null;
  if (destination === "warehouse") {
    ensureDefaultLocations();
    const receiveMode =
      input.receiveMode === "stock" || input.receiveMode === "cross_dock"
        ? input.receiveMode
        : po.receiveMode === "stock"
          ? "stock"
          : "cross_dock";
    const defaultLoc =
      receiveMode === "cross_dock" ? XDOCK_LOCATION_CODE : DEFAULT_LOCATION_CODE;
    const loc = getLocationByCode(
      (input.locationCode || defaultLoc).trim() || defaultLoc,
    );
    if (!loc) throw new Error("location_not_found");
    locationId = loc.id;
  }

  const snapshot = factoryPayableSnapshot(po.poId);
  const unitThb = snapshot?.unitThb ?? 0;
  const amountThb = roundSatang(unitThb * qtyReceived);
  const now = new Date().toISOString();
  const qtyShort = Math.max(0, po.quantity - already - qtyReceived - qtyDamaged);

  const receipt = insertGoodsReceipt({
    receiptId: createPrefixedId("GR", new Date(now)),
    poId: po.poId,
    orderId: po.orderId,
    destination,
    qtyOrdered: po.quantity,
    qtyReceived,
    qtyDamaged,
    qtyShort,
    unitThb,
    amountThb,
    qcNotes: blankToNull(input.qcNotes),
    trackingTh: blankToNull(input.trackingTh) ?? po.trackingTh,
    status: "posted",
    productKey,
    locationId,
    receivedAt: now,
    createdBy: input.actor ?? null,
    createdAt: now,
  });

  const totalReceived = already + qtyReceived;
  const poStatus = totalReceived >= po.quantity ? "received" : po.status === "shipped" ? "inbound" : po.status;
  patchPoReceived({
    poId: po.poId,
    receivedQty: totalReceived,
    destinationMode: destination,
    status: poStatus,
    at: now,
  });

  if (destination === "warehouse" && productKey) {
    const stock = receiveToStock({
      productKey,
      qty: qtyReceived,
      locationCodeOrId: locationId,
      receiptId: receipt.receiptId,
      poId: po.poId,
      orderId: po.orderId,
      actor: input.actor,
      at: now,
    });
    if (qtyDamaged > 0) {
      moveDamagedToQc({
        productKey,
        qty: qtyDamaged,
        receiptId: receipt.receiptId,
        poId: po.poId,
        orderId: po.orderId,
        actor: input.actor,
        at: now,
      });
    }
    try {
      reserveForOrder({
        orderId: po.orderId,
        productKey,
        qty: qtyReceived,
        locationCodeOrId: locationId,
        actor: input.actor,
        at: now,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code !== "insufficient_stock") throw error;
    }
    insertAsset({
      assetCode: createPrefixedId("AST", new Date(now)),
      kind: "inventory_lot",
      name: po.productName,
      qty: qtyReceived,
      unit: "ชิ้น",
      valueThb: amountThb,
      location: stock.balance.locationCode || "warehouse",
      poId: po.poId,
      orderId: po.orderId,
      receiptId: receipt.receiptId,
      status: "active",
      notes: `รับเข้าคลัง · ${productKey}`,
      createdAt: now,
      updatedAt: now,
    });
    tryAdvanceOrder({
      orderId: po.orderId,
      status: "warehouse",
      actor: input.actor,
    });
  } else if (destination === "warehouse") {
    insertAsset({
      assetCode: createPrefixedId("AST", new Date(now)),
      kind: "inventory_lot",
      name: po.productName,
      qty: qtyReceived,
      unit: "ชิ้น",
      valueThb: amountThb,
      location: "warehouse",
      poId: po.poId,
      orderId: po.orderId,
      receiptId: receipt.receiptId,
      status: "active",
      notes: "รับเข้าคลังตามใบสั่งโรงงาน",
      createdAt: now,
      updatedAt: now,
    });
    tryAdvanceOrder({
      orderId: po.orderId,
      status: "warehouse",
      actor: input.actor,
    });
  } else {
    const order = getOrderRepository().getOrderByOrderId(po.orderId);
    if (order?.paymentStatus === "paid") {
      tryAdvanceOrder({
        orderId: po.orderId,
        status: "out_for_delivery",
        actor: input.actor,
        skipWarehouse: true,
      });
    } else {
      tryAdvanceOrder({
        orderId: po.orderId,
        status: "inbound",
        actor: input.actor,
      });
    }
  }

  postInventoryReceipt({
    po,
    receiptId: receipt.receiptId,
    qtyReceived,
    destination,
    actor: input.actor,
    at: now,
  });

  getOrderRepository().insertEvent({
    orderId: po.orderId,
    eventType: "goods_receipt",
    message:
      destination === "ship_to"
        ? `รับสินค้าส่งตรงลูกค้า ${qtyReceived} ชิ้น · ${receipt.receiptId}`
        : `รับเข้าคลัง ${qtyReceived} ชิ้น · ${receipt.receiptId}${productKey ? ` · ${productKey}` : ""}`,
    actor: input.actor ?? null,
    createdAt: now,
  });

  if (qtyDamaged > 0 && !getClaimByReceiptId(receipt.receiptId)) {
    const qc = blankToNull(input.qcNotes);
    createClaim({
      against: "factory",
      reason: `ของเสียเมื่อรับตามใบรับ ${receipt.receiptId} · ${qtyDamaged} ชิ้น${qc ? ` — ${qc}` : ""}`,
      qty: qtyDamaged,
      amountThb: roundSatang(unitThb * qtyDamaged),
      poId: po.poId,
      orderId: po.orderId,
      receiptId: receipt.receiptId,
      actor: input.actor,
    });
  }

  return getGoodsReceipt(receipt.receiptId)!;
}

export function voidGoodsReceipt(input: {
  receiptId: string;
  actor?: string | null;
}): GoodsReceiptRecord {
  const receipt = getGoodsReceipt(input.receiptId);
  if (!receipt) throw new Error("receipt_not_found");
  if (receipt.status === "void") return receipt;

  const paid = sumSupplierPaid(receipt.poId, "factory");
  const remainingReceived = sumReceivedQty(receipt.poId) - receipt.qtyReceived;
  const remainingAmount = roundSatang(
    Math.max(0, remainingReceived) * receipt.unitThb,
  );
  if (paid - remainingAmount > 0.009) {
    throw new Error("void_blocked_by_payment");
  }

  const now = new Date().toISOString();
  if (receipt.destination === "warehouse" && receipt.productKey) {
    voidReceiveFromStock({
      receiptId: receipt.receiptId,
      productKey: receipt.productKey,
      qty: receipt.qtyReceived,
      locationId: receipt.locationId,
      damagedQty: receipt.qtyDamaged,
      actor: input.actor,
      at: now,
    });
  }

  setGoodsReceiptStatus({ receiptId: receipt.receiptId, status: "void" });
  deleteJournalBySourceKey(`inv:${receipt.receiptId}`);

  const po = getFactoryPo(receipt.poId);
  if (po) {
    const totalReceived = sumReceivedQty(po.poId);
    patchPoReceived({
      poId: po.poId,
      receivedQty: totalReceived,
      destinationMode: po.destinationMode,
      status: totalReceived <= 0 ? (po.status === "received" ? "inbound" : po.status) : po.status,
      at: now,
    });
  }

  if (receipt.orderId) {
    getOrderRepository().insertEvent({
      orderId: receipt.orderId,
      eventType: "goods_receipt",
      message: `ยกเลิกใบรับ ${receipt.receiptId}`,
      actor: input.actor ?? null,
      createdAt: now,
    });
  }

  return getGoodsReceipt(receipt.receiptId)!;
}

export function payFactoryForReceived(input: {
  poId: string;
  amount: number;
  receiptId?: string | null;
  method?: string;
  notes?: string | null;
  actor?: string | null;
  payableKind?: PayableKind | string | null;
}): SupplierPaymentRecord {
  const po = getFactoryPo(input.poId);
  if (!po) throw new Error("po_not_found");
  const snapshot = factoryPayableSnapshot(po.poId);
  if (!snapshot) throw new Error("po_not_found");
  const amount = roundSatang(input.amount);
  if (amount <= 0) throw new Error("amount_required");
  const payableKind: PayableKind = isPayableKind(input.payableKind)
    ? input.payableKind
    : "factory";
  if (payableKind === "factory" && amount - snapshot.unpaidAmount > 0.009) {
    throw new Error("pay_exceeds_received");
  }
  if (payableKind === "freight" && amount - snapshot.unpaidFreight > 0.009) {
    throw new Error("pay_exceeds_freight");
  }
  if (input.receiptId) {
    const gr = getGoodsReceipt(input.receiptId);
    if (!gr || gr.poId !== po.poId) throw new Error("receipt_not_found");
  }
  const now = new Date().toISOString();
  const pay = insertSupplierPayment({
    payId: createPrefixedId("SPAY", new Date(now)),
    poId: po.poId,
    receiptId: blankToNull(input.receiptId),
    amount,
    method: (input.method || "bank").trim() || "bank",
    status: "posted",
    paidAt: now,
    notes: blankToNull(input.notes),
    createdBy: input.actor ?? null,
    createdAt: now,
    payableKind,
  });
  postSupplierPayment({
    payId: pay.payId,
    poId: po.poId,
    orderId: po.orderId,
    amount,
    at: now,
    actor: input.actor,
    payableKind,
  });
  getOrderRepository().insertEvent({
    orderId: po.orderId,
    eventType: "supplier_pay",
    message: `จ่าย${payableKind === "freight" ? "ขนส่ง/นำเข้า" : "โรงงาน"} ${amount.toFixed(2)} บาท · ${pay.payId}`,
    actor: input.actor ?? null,
    createdAt: now,
  });
  return pay;
}

export type CashReceiptLineInput = {
  kind: string;
  description: string;
  amount: number;
  paymentId?: string | null;
  orderId?: string | null;
};

export function createCashReceipt(input: {
  orderId?: string | null;
  payerName: string;
  notes?: string | null;
  tags?: string[];
  lines: CashReceiptLineInput[];
  actor?: string | null;
}): CashReceiptRecord {
  const payerName = input.payerName.trim();
  if (!payerName) throw new Error("payer_required");
  const lines = input.lines
    .map((line, index) => ({
      lineNo: index + 1,
      kind: isCashLineKind(line.kind) ? line.kind : ("extra" as CashLineKind),
      description: line.description.trim() || "รายการรับ",
      amount: roundSatang(line.amount),
      paymentId: blankToNull(line.paymentId),
      orderId: blankToNull(line.orderId) ?? blankToNull(input.orderId),
    }))
    .filter((line) => line.amount > 0);
  if (lines.length === 0) throw new Error("lines_required");
  const totalAmount = roundSatang(lines.reduce((sum, line) => sum + line.amount, 0));
  const now = new Date().toISOString();
  const voucherId = createPrefixedId("RV", new Date(now));
  const orderId = blankToNull(input.orderId) ?? lines[0]?.orderId ?? null;
  let qrPayload: string | null = null;
  const promptPay = getPromptPayConfig();
  if (promptPay.id && totalAmount > 0) {
    qrPayload = buildPromptPayPayload({
      promptPayId: promptPay.id,
      amount: totalAmount,
    });
  }
  return insertCashReceipt(
    {
      voucherId,
      orderId,
      payerName,
      status: "open",
      totalAmount,
      qrPayload,
      method: "promptpay_qr",
      confirmedAt: null,
      confirmedBy: null,
      notes: blankToNull(input.notes),
      accessToken: randomBytes(18).toString("hex"),
      rejectReason: null,
      tags: parseOpsTags(input.tags),
      createdAt: now,
      updatedAt: now,
    },
    lines,
  );
}

export function confirmCashReceipt(input: {
  voucherId: string;
  actor?: string | null;
}): CashReceiptRecord {
  const voucher = getCashReceipt(input.voucherId);
  if (!voucher) throw new Error("voucher_not_found");
  if (voucher.status === "confirmed") return voucher;
  if (voucher.status !== "open") throw new Error("voucher_not_open");
  const now = new Date().toISOString();
  for (const line of voucher.lines) {
    if (line.paymentId) {
      confirmPayment({ paymentId: line.paymentId, actor: input.actor });
      continue;
    }
    const orderId = line.orderId || voucher.orderId;
    if (!orderId || line.amount <= 0) continue;
    postCashReceived({
      paymentId: `${voucher.voucherId}:L${line.lineNo}`,
      orderId,
      amount: line.amount,
      kind: line.description,
      at: now,
      actor: input.actor,
    });
  }
  confirmCashReceiptRow({
    voucherId: voucher.voucherId,
    confirmedAt: now,
    confirmedBy: input.actor ?? null,
  });
  return getCashReceipt(voucher.voucherId)!;
}

export function rejectCashReceipt(input: {
  voucherId: string;
  actor?: string | null;
  reason: string;
}): CashReceiptRecord {
  const voucher = getCashReceipt(input.voucherId);
  if (!voucher) throw new Error("voucher_not_found");
  if (voucher.status !== "open") throw new Error("voucher_not_open");
  const reason = normalizeRejectReason(input.reason);
  for (const line of voucher.lines) {
    if (!line.paymentId) continue;
    rejectPayment({
      paymentId: line.paymentId,
      actor: input.actor,
      reason,
    });
  }
  setCashReceiptRejectReason(voucher.voucherId, reason);
  return getCashReceipt(voucher.voucherId)!;
}

export function clearCashReceiptRejectReason(voucherId: string): void {
  setCashReceiptRejectReason(voucherId, null);
}

export function createFixedAsset(input: {
  name: string;
  qty?: number;
  unit?: string;
  valueThb?: number;
  location?: string;
  notes?: string | null;
  actor?: string | null;
}): AssetRecord {
  const name = input.name.trim();
  if (!name) throw new Error("asset_name_required");
  const now = new Date().toISOString();
  return insertAsset({
    assetCode: createPrefixedId("AST", new Date(now)),
    kind: "fixed",
    name,
    qty: input.qty && input.qty > 0 ? input.qty : 1,
    unit: (input.unit || "ชิ้น").trim() || "ชิ้น",
    valueThb: roundSatang(input.valueThb ?? 0),
    location: (input.location || "office").trim() || "office",
    poId: null,
    orderId: null,
    receiptId: null,
    status: "active",
    notes: blankToNull(input.notes),
    createdAt: now,
    updatedAt: now,
  });
}

export function createClaim(input: {
  against: string;
  reason: string;
  qty?: number;
  amountThb?: number;
  poId?: string | null;
  orderId?: string | null;
  receiptId?: string | null;
  issueId?: string | null;
  actor?: string | null;
}): ClaimRecord {
  if (!isClaimAgainst(input.against)) throw new Error("invalid_claim_against");
  const reason = input.reason.trim();
  if (!reason) throw new Error("reason_required");
  const now = new Date().toISOString();
  return insertClaim({
    claimId: createPrefixedId("CLM", new Date(now)),
    against: input.against as ClaimAgainst,
    poId: blankToNull(input.poId),
    orderId: blankToNull(input.orderId),
    receiptId: blankToNull(input.receiptId),
    issueId: blankToNull(input.issueId),
    qty: Math.max(0, Math.floor(input.qty ?? 0)),
    amountThb: roundSatang(input.amountThb ?? 0),
    reason,
    status: "open",
    createdBy: input.actor ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

export function setClaimStatus(input: {
  claimId: string;
  status: string;
}): ClaimRecord {
  if (!isClaimStatus(input.status)) throw new Error("invalid_claim_status");
  const existing = getClaim(input.claimId);
  if (!existing) throw new Error("claim_not_found");
  updateClaimStatus(input.claimId, input.status as ClaimStatus, new Date().toISOString());
  return getClaim(input.claimId)!;
}

function againstFromIssueCategory(category: IssueCategory): ClaimAgainst {
  if (category === "delivery" || category === "delay") return "carrier";
  return "factory";
}

export function claimFromIssue(input: {
  issueId: string;
  actor?: string | null;
}): ClaimRecord {
  const issue = getIssue(input.issueId);
  if (!issue) throw new Error("issue_not_found");
  const existing = getClaimByIssueId(issue.issueId);
  if (existing) return existing;
  const claim = createClaim({
    against: againstFromIssueCategory(issue.category),
    reason: `${issue.title} — ${issue.detail}`.slice(0, 2000),
    qty: 0,
    amountThb: 0,
    poId: issue.poId,
    orderId: issue.orderId,
    issueId: issue.issueId,
    actor: input.actor,
  });
  if (issue.status === "open") {
    updateIssueStatus(issue.issueId, "in_progress", new Date().toISOString());
  }
  return claim;
}

export function createIssueTicket(input: {
  source: "public" | "ops";
  company?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  orderId?: string | null;
  category?: string;
  title: string;
  detail: string;
}): IssueTicketRecord {
  const title = input.title.trim();
  const detail = input.detail.trim();
  if (!title) throw new Error("title_required");
  if (!detail) throw new Error("detail_required");
  const categoryRaw = input.category || "other";
  const category: IssueCategory = isIssueCategory(categoryRaw)
    ? categoryRaw
    : "other";
  const now = new Date().toISOString();
  return insertIssue({
    issueId: createPrefixedId("ISS", new Date(now)),
    source: input.source,
    company: blankToNull(input.company),
    contactName: blankToNull(input.contactName),
    email: blankToNull(input.email),
    phone: blankToNull(input.phone),
    orderId: blankToNull(input.orderId),
    poId: null,
    category,
    title,
    detail,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
}

export function setIssueStatus(input: {
  issueId: string;
  status: string;
}): IssueTicketRecord {
  if (!isIssueStatus(input.status)) throw new Error("invalid_issue_status");
  const existing = getIssue(input.issueId);
  if (!existing) throw new Error("issue_not_found");
  updateIssueStatus(input.issueId, input.status as IssueStatus, new Date().toISOString());
  return getIssue(input.issueId)!;
}

export function ensureCashReceiptAccessToken(voucherId: string): string {
  const voucher = getCashReceipt(voucherId);
  if (!voucher) throw new Error("voucher_not_found");
  if (voucher.accessToken) return voucher.accessToken;
  const token = randomBytes(18).toString("hex");
  setCashReceiptAccessToken(voucherId, token);
  return token;
}

export {
  getCashReceipt,
  getCashReceiptByAccessToken,
  getClaim,
  getClaimByIssueId,
  getClaimByReceiptId,
  getGoodsReceipt,
  getIssue,
  listAssets,
  listCashReceipts,
  listClaims,
  listGoodsReceipts,
  listIssues,
  listSupplierPayments,
  setCashReceiptTags,
};
