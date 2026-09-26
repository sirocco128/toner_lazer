import { getOrderRepository } from "@/lib/order-repository";
import { listCashReceipts } from "@/lib/ops-cycle-repository";
import { PAYMENT_KIND_LABELS } from "@/lib/order-types";
import {
  getLatestSlipForPayment,
  getLatestSlipForVoucher,
  type PaymentSlipRecord,
} from "@/lib/payment-slips";
import type { SlipCheckStatus } from "@/lib/slip-verify";

export type ApprovalQueueItem = {
  kind: "payment" | "voucher";
  id: string;
  href: string;
  title: string;
  payer: string;
  amount: number;
  orderId: string | null;
  updatedAt: string;
  slip: PaymentSlipRecord | null;
  checkStatus: SlipCheckStatus | null;
};

export function listApprovalQueue(limit = 80): ApprovalQueueItem[] {
  const coveredPaymentIds = new Set<string>();
  const items: ApprovalQueueItem[] = [];

  for (const voucher of listCashReceipts({ status: "open", limit: 100 })) {
    if (voucher.rejectReason) continue;
    const slip = getLatestSlipForVoucher(voucher.voucherId);
    if (!slip) continue;
    for (const line of voucher.lines) {
      if (line.paymentId) coveredPaymentIds.add(line.paymentId);
    }
    items.push({
      kind: "voucher",
      id: voucher.voucherId,
      href: `/ops/approvals/rv/${encodeURIComponent(voucher.voucherId)}`,
      title: `ใบรับเงิน ${voucher.voucherId}`,
      payer: voucher.payerName,
      amount: voucher.totalAmount,
      orderId: voucher.orderId,
      updatedAt: slip.createdAt,
      slip,
      checkStatus: slip.checkStatus,
    });
  }

  for (const payment of getOrderRepository().listSubmittedPayments(100)) {
    if (coveredPaymentIds.has(payment.paymentId)) continue;
    const slip = getLatestSlipForPayment(payment.paymentId);
    const order = getOrderRepository().getOrderByOrderId(payment.orderId);
    items.push({
      kind: "payment",
      id: payment.paymentId,
      href: `/ops/approvals/pay/${encodeURIComponent(payment.paymentId)}`,
      title: `${PAYMENT_KIND_LABELS[payment.kind]} ${payment.paymentId}`,
      payer: order?.company || order?.contactName || payment.orderId,
      amount: payment.amount,
      orderId: payment.orderId,
      updatedAt: payment.updatedAt,
      slip,
      checkStatus: slip?.checkStatus ?? null,
    });
  }

  items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return items.slice(0, Math.min(200, Math.max(1, limit)));
}

export function countApprovalQueue(): number {
  return listApprovalQueue(200).length;
}
