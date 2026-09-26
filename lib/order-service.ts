import { randomBytes, timingSafeEqual } from "node:crypto";
import { COMPANY, formatRegisteredAddress } from "@/lib/company";
import { getOrderRepository } from "@/lib/order-repository";
import type {
  BillingDocumentRecord,
  BillingDocumentType,
  FulfillmentStatus,
  OrderEventRecord,
  OrderRecord,
  PaymentKind,
  PaymentRecord,
} from "@/lib/order-types";
import {
  FULFILLMENT_LABELS,
  FULFILLMENT_STATUSES,
  PAYMENT_KIND_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/order-types";
import {
  buildPromptPayPayload,
  getPromptPayConfig,
} from "@/lib/promptpay";
import { getCustomerById, recomputeCustomerRollups, updateCustomer } from "@/lib/customer-repository";
import { getQuoteByRequestId } from "@/lib/quote-repository";
import { bangkokDateYmd } from "@/lib/bangkok-date";
import { bahtText } from "@/lib/th-baht-text";
import { composeOrderShipTo, quoteShipToParts } from "@/lib/thai-address-format";
import { shipFromStock } from "@/lib/wms-service";
import {
  calculateDepositPlan,
  normalizeThaiTaxId,
  roundSatang,
  splitVat,
  type DepositMode,
  type VatMode,
} from "@/lib/th-billing";
import { postCashReceived, postRevenueRecognition } from "@/lib/ledger-service";

const FULFILLMENT_FLOW: FulfillmentStatus[] = FULFILLMENT_STATUSES.filter(
  (s) => s !== "cancelled",
);

export type CreateOrderFromQuoteInput = {
  quoteRequestId: string;
  amount: number;
  vatMode?: VatMode;
  depositMode?: DepositMode;
  depositPercent?: number;
  productSummary?: string;
  quantity?: number;
  billingName?: string;
  billingTaxId?: string;
  billingAddress?: string;
  billingBranch?: string;
  shipToName?: string;
  shipToPhone?: string;
  shipToAddress?: string;
  shipToProvince?: string;
  saveBillingDefaults?: boolean;
  notes?: string;
  actor?: string | null;
};

export type OrderBundle = {
  order: OrderRecord;
  payments: PaymentRecord[];
  documents: BillingDocumentRecord[];
  events: OrderEventRecord[];
};

function createPrefixedId(prefix: string, now = new Date()): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${bangkokDateYmd(now)}-${suffix}`;
}

function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function digitsPhone(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function currentDueKind(order: OrderRecord): PaymentKind | null {
  if (order.paymentStatus === "paid" || order.fulfillmentStatus === "cancelled") {
    return null;
  }
  if (order.paymentStatus === "balance_due") return "remaining";
  if (order.paymentStatus === "deposit_due") {
    return order.remainingAmount <= 0 ? "full" : "deposit";
  }
  return null;
}

function currentDueAmount(order: OrderRecord): number {
  const kind = currentDueKind(order);
  if (kind === "remaining") return order.remainingAmount;
  if (kind === "full") return order.totalAmount;
  if (kind === "deposit") return order.depositAmount;
  return 0;
}

function sellerLine(): string {
  return [
    COMPANY.legalName,
    `เลขประจำตัวผู้เสียภาษี ${COMPANY.taxId}`,
    formatRegisteredAddress(),
  ].join(" ");
}

function issueDocument(params: {
  type: BillingDocumentType;
  order: OrderRecord;
  paymentId: string | null;
  subtotalExVat: number;
  vatAmount: number;
  grandTotal: number;
  lineDescription: string;
  now: string;
}): BillingDocumentRecord {
  const repo = getOrderRepository();
  const documentId = repo.nextDocumentNumber(params.type, new Date(params.now));
  return repo.insertDocument({
    documentId,
    documentType: params.type,
    orderId: params.order.orderId,
    paymentId: params.paymentId,
    subtotalExVat: params.subtotalExVat,
    vatAmount: params.vatAmount,
    grandTotal: params.grandTotal,
    amountText: bahtText(params.grandTotal),
    lineDescription: params.lineDescription,
    issuedAt: params.now,
    buyerName: params.order.billingName,
    buyerTaxId: params.order.billingTaxId,
    buyerAddress: params.order.billingAddress,
    buyerBranch: params.order.billingBranch,
  });
}

function ensureQrPayload(amount: number): string | null {
  const { id } = getPromptPayConfig();
  const promptPayId = id || COMPANY.taxId;
  if (!promptPayId) return null;
  try {
    return buildPromptPayPayload({ promptPayId, amount });
  } catch {
    return null;
  }
}

function createOpenPayment(order: OrderRecord, kind: PaymentKind, amount: number): PaymentRecord {
  const repo = getOrderRepository();
  const existing = repo.findOpenPayment(order.orderId, kind);
  if (existing) return existing;
  const now = new Date().toISOString();
  return repo.insertPayment({
    paymentId: createPrefixedId("PAY"),
    orderId: order.orderId,
    kind,
    amount: roundSatang(amount),
    method: "promptpay_qr",
    status: "pending",
    qrPayload: ensureQrPayload(amount),
    createdAt: now,
  });
}

function maybeIssueTaxInvoice(order: OrderRecord, now: string, actor: string | null): void {
  const repo = getOrderRepository();
  const fresh = repo.getOrderByOrderId(order.orderId);
  if (!fresh) return;
  if (fresh.paymentStatus !== "paid") return;
  const deliveredEnough =
    fresh.fulfillmentStatus === "warehouse" ||
    fresh.fulfillmentStatus === "out_for_delivery" ||
    fresh.fulfillmentStatus === "delivered";
  if (!deliveredEnough) return;
  if (!repo.hasDocument(fresh.orderId, "tax_invoice")) {
    issueDocument({
      type: "tax_invoice",
      order: fresh,
      paymentId: null,
      subtotalExVat: fresh.subtotalExVat,
      vatAmount: fresh.vatAmount,
      grandTotal: fresh.totalAmount,
      lineDescription: `${fresh.productSummary} จำนวน ${fresh.quantity} ชุด`,
      now,
    });
    if (!repo.hasDocument(fresh.orderId, "receipt")) {
      issueDocument({
        type: "receipt",
        order: fresh,
        paymentId: null,
        subtotalExVat: fresh.subtotalExVat,
        vatAmount: fresh.vatAmount,
        grandTotal: fresh.totalAmount,
        lineDescription: `รับชำระค่าสินค้าครบจำนวน — ${fresh.productSummary}`,
        now,
      });
    }
    repo.insertEvent({
      orderId: fresh.orderId,
      eventType: "document_issued",
      message: `ออกใบกำกับภาษีและใบเสร็จรับเงิน (รับรู้รายได้เมื่อสินค้าพร้อมส่งมอบ) · ${sellerLine()}`,
      actor,
      createdAt: now,
    });
  }
  postRevenueRecognition({
    orderId: fresh.orderId,
    subtotalExVat: fresh.subtotalExVat,
    vatAmount: fresh.vatAmount,
    grandTotal: fresh.totalAmount,
    at: now,
    actor,
  });
}

export function getOrderBundle(orderId: string): OrderBundle | null {
  const repo = getOrderRepository();
  const order = repo.getOrderByOrderId(orderId);
  if (!order) return null;
  return {
    order,
    payments: repo.listPaymentsByOrder(orderId),
    documents: repo.listDocumentsByOrder(orderId),
    events: repo.listEvents(orderId),
  };
}

export function createOrderFromQuote(input: CreateOrderFromQuoteInput): OrderRecord {
  const quote = getQuoteByRequestId(input.quoteRequestId);
  if (!quote) throw new Error("quote_not_found");
  if (quote.leadStatus !== "quoted" && quote.leadStatus !== "won") {
    throw new Error("quote_not_ready");
  }

  const repo = getOrderRepository();
  const existing = repo.getOrderByQuoteRequestId(quote.requestId);
  if (existing) return existing;

  const vat = splitVat({
    amount: input.amount,
    vatMode: input.vatMode ?? "exclusive",
  });
  const deposit = calculateDepositPlan({
    grandTotal: vat.grandTotal,
    mode: input.depositMode ?? "auto",
    percent: input.depositPercent,
  });

  const customer = quote.customerId ? getCustomerById(quote.customerId) : null;
  const billingName = (
    input.billingName ||
    customer?.billingName ||
    quote.company
  ).trim();
  const billingTaxId = normalizeThaiTaxId(
    input.billingTaxId || customer?.taxId,
  );
  const billingAddress =
    input.billingAddress?.trim() || customer?.billingAddress || null;
  const billingBranch = (
    input.billingBranch ||
    customer?.billingBranch ||
    "สำนักงานใหญ่"
  ).trim();
  const quoteShip = quoteShipToParts(quote);
  const fallbackShip = composeOrderShipTo(quoteShip);
  const shipToProvince =
    input.shipToProvince?.trim() ||
    fallbackShip.shipToProvince ||
    customer?.defaultShipProvince ||
    null;
  const shipToAddress =
    input.shipToAddress?.trim() ||
    (quoteShip.streetAddress ||
    quoteShip.district ||
    quoteShip.subdistrict ||
    quoteShip.zip
      ? fallbackShip.shipToAddress
      : null);

  const now = new Date().toISOString();
  const order = repo.insertOrder({
    orderId: createPrefixedId("ORD"),
    quoteRequestId: quote.requestId,
    customerId: quote.customerId,
    company: quote.company,
    contactName: quote.name,
    email: quote.email,
    phone: quote.phone,
    billingName,
    billingTaxId,
    billingAddress,
    billingBranch,
    shipToName: input.shipToName?.trim() || quote.name,
    shipToPhone: input.shipToPhone?.trim() || quote.phone,
    shipToAddress,
    shipToProvince,
    productSummary:
      (input.productSummary ||
        quote.productInterest ||
        quote.productSlug ||
        "สินค้าสั่งผลิตสกรีนโลโก้")?.trim() || "สินค้าสั่งผลิตสกรีนโลโก้",
    quantity: input.quantity ?? quote.quantity,
    currency: "THB",
    vatRate: vat.vatRate,
    vatMode: vat.vatMode,
    subtotalExVat: vat.subtotalExVat,
    vatAmount: vat.vatAmount,
    totalAmount: vat.grandTotal,
    depositMode: deposit.mode,
    depositPercent: deposit.appliedPercent,
    depositAmount: deposit.depositAmount,
    remainingAmount: deposit.remainingAmount,
    paidAmount: 0,
    paymentStatus: "deposit_due",
    fulfillmentStatus: "reserved",
    accessToken: randomBytes(18).toString("hex"),
    notes: input.notes?.trim() || deposit.reason,
    createdAt: now,
  });

  issueDocument({
    type: "deposit_invoice",
    order,
    paymentId: null,
    subtotalExVat: deposit.collectFull ? vat.subtotalExVat : roundSatang(deposit.depositAmount / (1 + vat.vatRate / 100)),
    vatAmount: deposit.collectFull
      ? vat.vatAmount
      : roundSatang(
          deposit.depositAmount -
            roundSatang(deposit.depositAmount / (1 + vat.vatRate / 100)),
        ),
    grandTotal: deposit.depositAmount,
    lineDescription: deposit.collectFull
      ? `แจ้งหนี้ค่าสินค้าเต็มจำนวน — ${order.productSummary}`
      : `แจ้งหนี้เงินมัดจำ ${deposit.appliedPercent}% — ${order.productSummary}`,
    now,
  });

  const kind: PaymentKind = deposit.collectFull ? "full" : "deposit";
  createOpenPayment(order, kind, deposit.depositAmount);

  repo.insertEvent({
    orderId: order.orderId,
    eventType: "created",
    message: deposit.collectFull
      ? `เปิดออเดอร์และแจ้งหนี้เต็มจำนวน ${order.totalAmount.toFixed(2)} บาท (รวม VAT ${vat.vatRate}%)`
      : `เปิดออเดอร์ จองสินค้า มัดจำ ${deposit.appliedPercent}% = ${deposit.depositAmount.toFixed(2)} บาท จากยอดรวม ${vat.grandTotal.toFixed(2)} บาท`,
    actor: input.actor ?? null,
    createdAt: now,
  });

  if (quote.customerId) {
    if (input.saveBillingDefaults) {
      updateCustomer({
        id: quote.customerId,
        taxId: billingTaxId,
        billingName,
        billingAddress,
        billingBranch,
        defaultShipProvince: shipToProvince,
      });
    }
    recomputeCustomerRollups(quote.customerId);
  }

  return repo.getOrderByOrderId(order.orderId) ?? order;
}

export function assertOrderAccess(order: OrderRecord, token: string): boolean {
  return tokensEqual(order.accessToken, token);
}

export function lookupOrders(input: {
  orderId?: string;
  email: string;
  phone: string;
}): OrderRecord[] {
  const email = input.email.trim().toLowerCase();
  const phone = digitsPhone(input.phone);
  if (!email || phone.length < 8) return [];
  const repo = getOrderRepository();
  if (input.orderId?.trim()) {
    const order = repo.getOrderByOrderId(input.orderId.trim());
    if (!order) return [];
    if (order.email.toLowerCase() !== email) return [];
    if (digitsPhone(order.phone) !== phone) return [];
    return [order];
  }
  return repo
    .listOrders({ email, limit: 50 })
    .filter((row) => digitsPhone(row.phone) === phone);
}

export function getPublicOrder(orderId: string, token: string): OrderBundle | null {
  const bundle = getOrderBundle(orderId);
  if (!bundle) return null;
  if (!assertOrderAccess(bundle.order, token)) return null;
  return bundle;
}

export function ensureCurrentPayment(orderId: string): PaymentRecord | null {
  const repo = getOrderRepository();
  const order = repo.getOrderByOrderId(orderId);
  if (!order) return null;
  const kind = currentDueKind(order);
  const amount = currentDueAmount(order);
  if (!kind || amount <= 0) return null;
  return createOpenPayment(order, kind, amount);
}

export function submitCustomerPayment(input: {
  orderId: string;
  token: string;
  paymentId: string;
  reference?: string;
}): PaymentRecord {
  const repo = getOrderRepository();
  const order = repo.getOrderByOrderId(input.orderId);
  if (!order || !assertOrderAccess(order, input.token)) {
    throw new Error("order_not_found");
  }
  const payment = repo.getPaymentByPaymentId(input.paymentId);
  if (!payment || payment.orderId !== order.orderId) {
    throw new Error("payment_not_found");
  }
  if (payment.status === "confirmed") return payment;
  if (
    payment.status !== "pending" &&
    payment.status !== "submitted" &&
    payment.status !== "rejected"
  ) {
    throw new Error("payment_not_open");
  }
  const now = new Date().toISOString();
  repo.updatePayment({
    paymentId: payment.paymentId,
    status: "submitted",
    customerReference: input.reference?.trim() || payment.customerReference,
    rejectReason: null,
  });
  repo.insertEvent({
    orderId: order.orderId,
    eventType: "payment_submitted",
    message: `ลูกค้าแจ้งชำระ${PAYMENT_KIND_LABELS[payment.kind]} ${payment.amount.toFixed(2)} บาท — รอบัญชีอนุมัติยอด`,
    actor: order.email,
    createdAt: now,
  });
  const updated = repo.getPaymentByPaymentId(payment.paymentId);
  if (!updated) throw new Error("payment_not_found");
  return updated;
}

export function confirmPayment(input: {
  paymentId: string;
  actor?: string | null;
}): OrderRecord {
  const repo = getOrderRepository();
  const payment = repo.getPaymentByPaymentId(input.paymentId);
  if (!payment) throw new Error("payment_not_found");
  const order = repo.getOrderByOrderId(payment.orderId);
  if (!order) throw new Error("order_not_found");
  if (payment.status === "confirmed") return order;

  const now = new Date().toISOString();
  repo.updatePayment({
    paymentId: payment.paymentId,
    status: "confirmed",
    confirmedAt: now,
    confirmedBy: input.actor ?? null,
    rejectReason: null,
  });
  postCashReceived({
    paymentId: payment.paymentId,
    orderId: order.orderId,
    amount: payment.amount,
    kind: PAYMENT_KIND_LABELS[payment.kind],
    at: now,
    actor: input.actor,
  });

  const paidAmount = roundSatang(order.paidAmount + payment.amount);
  const remaining = roundSatang(Math.max(0, order.totalAmount - paidAmount));
  let paymentStatus = order.paymentStatus;
  if (remaining <= 0) paymentStatus = "paid";
  else if (paidAmount + 0.001 >= order.depositAmount) paymentStatus = "deposit_paid";
  else paymentStatus = "deposit_due";

  repo.updateOrderMoney({
    orderId: order.orderId,
    paidAmount,
    paymentStatus,
    remainingAmount: remaining,
  });

  if (payment.kind === "deposit" || payment.kind === "full") {
    if (!repo.hasDocument(order.orderId, "deposit_receipt")) {
      const share = splitVat({ amount: payment.amount, vatMode: "inclusive" });
      issueDocument({
        type: "deposit_receipt",
        order,
        paymentId: payment.paymentId,
        subtotalExVat: share.subtotalExVat,
        vatAmount: payment.kind === "full" ? order.vatAmount : share.vatAmount,
        grandTotal: payment.amount,
        lineDescription:
          payment.kind === "full"
            ? `รับชำระค่าสินค้าเต็มจำนวน (ใบเสร็จรับเงิน — ใบกำกับภาษีออกเมื่อส่งมอบ)`
            : `รับเงินมัดจำ — ยังไม่ใช่ใบกำกับภาษี ค่าสินค้าจะออกใบกำกับเมื่อสินค้าเข้าคลัง/ส่งมอบ`,
        now,
      });
    }
  }

  if (
    order.fulfillmentStatus === "reserved" &&
    (paymentStatus === "deposit_paid" || paymentStatus === "paid")
  ) {
    repo.updateFulfillment(order.orderId, "awaiting_production");
    repo.insertEvent({
      orderId: order.orderId,
      eventType: "fulfillment",
      message: `ชำระมัดจำแล้ว — สถานะเป็น${FULFILLMENT_LABELS.awaiting_production}`,
      actor: input.actor ?? null,
      createdAt: now,
    });
  }

  repo.insertEvent({
    orderId: order.orderId,
    eventType: "payment_confirmed",
    message: `รับชำระ${PAYMENT_KIND_LABELS[payment.kind]} ${payment.amount.toFixed(2)} บาท · ${PAYMENT_STATUS_LABELS[paymentStatus]}`,
    actor: input.actor ?? null,
    createdAt: now,
  });

  const fresh = repo.getOrderByOrderId(order.orderId);
  if (!fresh) throw new Error("order_not_found");
  maybeIssueTaxInvoice(fresh, now, input.actor ?? null);
  return repo.getOrderByOrderId(order.orderId) ?? fresh;
}

export function normalizeRejectReason(reason: string | undefined | null): string {
  const text = String(reason || "").trim();
  if (text.length < 4) throw new Error("reject_reason_required");
  return text.slice(0, 500);
}

export function rejectPayment(input: {
  paymentId: string;
  actor?: string | null;
  reason: string;
}): PaymentRecord {
  const repo = getOrderRepository();
  const payment = repo.getPaymentByPaymentId(input.paymentId);
  if (!payment) throw new Error("payment_not_found");
  const order = repo.getOrderByOrderId(payment.orderId);
  if (!order) throw new Error("order_not_found");
  if (payment.status === "confirmed") throw new Error("payment_already_confirmed");
  const reason = normalizeRejectReason(input.reason);
  const now = new Date().toISOString();
  repo.updatePayment({
    paymentId: payment.paymentId,
    status: "rejected",
    rejectReason: reason,
  });
  repo.insertEvent({
    orderId: order.orderId,
    eventType: "payment_rejected",
    message: `บัญชีปฏิเสธ${PAYMENT_KIND_LABELS[payment.kind]} ${payment.amount.toFixed(2)} บาท — ${reason}`,
    actor: input.actor ?? null,
    createdAt: now,
  });
  const updated = repo.getPaymentByPaymentId(payment.paymentId);
  if (!updated) throw new Error("payment_not_found");
  return updated;
}

export function updateOrderFulfillment(input: {
  orderId: string;
  status: FulfillmentStatus;
  actor?: string | null;
  /** Ship-to: ข้ามสถานะเข้าคลังไทย */
  skipWarehouse?: boolean;
}): OrderRecord {
  if (!(FULFILLMENT_STATUSES as readonly string[]).includes(input.status)) {
    throw new Error("invalid_status");
  }
  const repo = getOrderRepository();
  const order = repo.getOrderByOrderId(input.orderId);
  if (!order) throw new Error("order_not_found");
  if (order.fulfillmentStatus === input.status) return order;

  const from = order.fulfillmentStatus;
  const to = input.status;
  if (from === "delivered" || from === "cancelled") {
    throw new Error("status_locked");
  }
  if (to !== "cancelled") {
    const fromIdx = FULFILLMENT_FLOW.indexOf(from);
    const toIdx = FULFILLMENT_FLOW.indexOf(to);
    const warehouseIdx = FULFILLMENT_FLOW.indexOf("warehouse");
    const skippingWarehouse =
      Boolean(input.skipWarehouse) &&
      fromIdx < warehouseIdx &&
      toIdx > warehouseIdx;
    if (toIdx <= fromIdx && !skippingWarehouse) {
      throw new Error("invalid_transition");
    }
  }

  const toIdx = FULFILLMENT_FLOW.indexOf(to);
  const productionIdx = FULFILLMENT_FLOW.indexOf("awaiting_production");
  const shipIdx = FULFILLMENT_FLOW.indexOf("out_for_delivery");
  if (to !== "cancelled" && toIdx >= productionIdx && order.paidAmount + 0.001 < order.depositAmount) {
    throw new Error("deposit_required");
  }
  if (to !== "cancelled" && toIdx >= shipIdx && order.paymentStatus !== "paid") {
    throw new Error("balance_required");
  }

  const now = new Date().toISOString();
  repo.updateFulfillment(order.orderId, to);

  const goodsArrivedWithoutWarehouse =
    Boolean(input.skipWarehouse) && to === "out_for_delivery";
  if (
    (to === "warehouse" || goodsArrivedWithoutWarehouse) &&
    order.paymentStatus === "deposit_paid" &&
    order.remainingAmount > 0
  ) {
    repo.updatePaymentStatus(order.orderId, "balance_due");
    if (!repo.hasDocument(order.orderId, "balance_invoice")) {
      const share = splitVat({ amount: order.remainingAmount, vatMode: "inclusive" });
      issueDocument({
        type: "balance_invoice",
        order,
        paymentId: null,
        subtotalExVat: share.subtotalExVat,
        vatAmount: share.vatAmount,
        grandTotal: order.remainingAmount,
        lineDescription: goodsArrivedWithoutWarehouse
          ? `แจ้งหนี้ส่วนที่เหลือเมื่อส่งตรงลูกค้า — ${order.productSummary}`
          : `แจ้งหนี้ส่วนที่เหลือเมื่อสินค้าเข้าคลัง — ${order.productSummary}`,
        now,
      });
    }
    createOpenPayment(order, "remaining", order.remainingAmount);
    repo.insertEvent({
      orderId: order.orderId,
      eventType: "invoice",
      message: goodsArrivedWithoutWarehouse
        ? "ส่งตรงลูกค้า — ออกใบแจ้งหนี้ส่วนที่เหลือ"
        : "สินค้าเข้าคลังแล้ว — ออกใบแจ้งหนี้ส่วนที่เหลือ",
      actor: input.actor ?? null,
      createdAt: now,
    });
  }

  repo.insertEvent({
    orderId: order.orderId,
    eventType: "fulfillment",
    message: `สถานะสินค้า: ${FULFILLMENT_LABELS[to]}`,
    actor: input.actor ?? null,
    createdAt: now,
  });

  const fresh = repo.getOrderByOrderId(order.orderId);
  if (!fresh) throw new Error("order_not_found");
  maybeIssueTaxInvoice(fresh, now, input.actor ?? null);

  if (to === "out_for_delivery" || to === "delivered") {
    try {
      shipFromStock({
        orderId: fresh.orderId,
        actor: input.actor,
        at: now,
      });
    } catch {
      // Stock may already be shipped or WMS not seeded; do not block fulfillment.
    }
  }

  return repo.getOrderByOrderId(order.orderId) ?? fresh;
}

export function paymentStatusLabelForOrder(order: OrderRecord): string {
  if (order.paymentStatus === "deposit_due" && order.remainingAmount <= 0) {
    return "รอชำระเต็มจำนวน";
  }
  return PAYMENT_STATUS_LABELS[order.paymentStatus];
}

export { currentDueAmount, currentDueKind, sellerLine };
