"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { consumeRateLimit } from "@/lib/quote-repository";
import { hashIp, resolveClientIp } from "@/lib/quote-service";
import {
  lookupOrders,
  submitCustomerPayment,
} from "@/lib/order-service";

export type OrderLookupResult = {
  ok: boolean;
  error?: string;
};

export async function lookupOrdersAction(
  _prev: OrderLookupResult | null,
  formData: FormData,
): Promise<OrderLookupResult> {
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const orderId = String(formData.get("orderId") || "").trim();

  const h = await headers();
  const ipHash = hashIp(resolveClientIp(h));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const allowed = consumeRateLimit({
    keyHash: `order-lookup:${ipHash}`,
    bucketStart: nowSeconds - (nowSeconds % 900),
    maxAttempts: 10,
    nowSeconds,
  });
  if (!allowed) {
    return { ok: false, error: "ค้นหาบ่อยเกินไป กรุณารอสักครู่" };
  }

  const rows = lookupOrders({ orderId, email, phone });
  if (rows.length === 0) {
    return { ok: false, error: "ไม่พบออเดอร์ที่ตรงกับอีเมลและเบอร์โทร" };
  }
  const first = rows[0]!;
  redirect(`/orders/${first.orderId}?t=${first.accessToken}`);
}

export type PayNotifyResult = {
  ok: boolean;
  error?: string;
  checkStatus?: string;
  notes?: string;
};

export async function notifyPaymentAction(
  _prev: PayNotifyResult | null,
  formData: FormData,
): Promise<PayNotifyResult> {
  const orderId = String(formData.get("orderId") || "").trim();
  const token = String(formData.get("token") || "").trim();
  const paymentId = String(formData.get("paymentId") || "").trim();
  const reference = String(formData.get("reference") || "").trim();
  const file = formData.get("slip");
  try {
    const { getPublicOrder } = await import("@/lib/order-service");
    const bundle = getPublicOrder(orderId, token);
    const payment = bundle?.payments.find((p) => p.paymentId === paymentId);
    if (!bundle || !payment) {
      return { ok: false, error: "ไม่พบรายการชำระเงิน" };
    }
    if (!(file instanceof File) || file.size <= 0) {
      return { ok: false, error: "กรุณาแนบรูปสลิปการโอน" };
    }
    const { fileToSlipInput, processTransferSlip } = await import("@/lib/transfer-notify");
    const parsed = await fileToSlipInput(file);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    const result = await processTransferSlip({
      expectedAmount: payment.amount,
      paymentId,
      file: parsed,
    });
    const note = [reference, result.notes].filter(Boolean).join(" · ");
    submitCustomerPayment({
      orderId,
      token,
      paymentId,
      reference: note,
    });
    return { ok: true, checkStatus: result.checkStatus, notes: result.notes };
  } catch {
    return { ok: false, error: "ไม่สามารถแจ้งชำระได้ กรุณาตรวจเลขออเดอร์หรือลองใหม่" };
  }
}

export async function notifyVoucherPaymentAction(
  _prev: PayNotifyResult | null,
  formData: FormData,
): Promise<PayNotifyResult> {
  const voucherId = String(formData.get("voucherId") || "").trim();
  const token = String(formData.get("token") || "").trim();
  const reference = String(formData.get("reference") || "").trim();
  const file = formData.get("slip");
  try {
    const { getCashReceiptByAccessToken } = await import("@/lib/ops-cycle-service");
    const voucher = getCashReceiptByAccessToken(token);
    if (!voucher || voucher.voucherId !== voucherId) {
      return { ok: false, error: "ไม่พบใบรับเงิน" };
    }
    if (voucher.status !== "open") {
      return { ok: false, error: "ใบนี้ยืนยันรับเงินแล้ว" };
    }
    if (!(file instanceof File) || file.size <= 0) {
      return { ok: false, error: "กรุณาแนบรูปสลิปการโอน" };
    }
    const { fileToSlipInput, processTransferSlip } = await import("@/lib/transfer-notify");
    const parsed = await fileToSlipInput(file);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    const result = await processTransferSlip({
      expectedAmount: voucher.totalAmount,
      paymentId: voucher.lines.find((l) => l.paymentId)?.paymentId ?? null,
      voucherId: voucher.voucherId,
      file: parsed,
    });
    const { getOrderRepository } = await import("@/lib/order-repository");
    const paymentId = voucher.lines.find((l) => l.paymentId)?.paymentId;
    const orderId = voucher.orderId || voucher.lines.find((l) => l.orderId)?.orderId;
    if (paymentId && orderId) {
      const order = getOrderRepository().getOrderByOrderId(orderId);
      if (order) {
        submitCustomerPayment({
          orderId,
          token: order.accessToken,
          paymentId,
          reference: [reference, result.notes].filter(Boolean).join(" · "),
        });
      }
    }
    const { clearCashReceiptRejectReason } = await import("@/lib/ops-cycle-service");
    clearCashReceiptRejectReason(voucher.voucherId);
    return { ok: true, checkStatus: result.checkStatus, notes: result.notes };
  } catch {
    return { ok: false, error: "ไม่สามารถแจ้งโอนได้ กรุณาลองใหม่" };
  }
}
