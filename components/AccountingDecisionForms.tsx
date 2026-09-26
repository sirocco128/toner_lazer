"use client";

import { useActionState } from "react";
import {
  confirmOrderPaymentAction,
  rejectOrderPaymentAction,
} from "@/app/actions/ops-orders";
import {
  confirmCashReceiptAction,
  rejectCashReceiptAction,
} from "@/app/actions/ops-cycle";
import type { OpsActionResult } from "@/app/actions/ops";
import {
  PAYMENT_KIND_LABELS,
  PAYMENT_RECORD_STATUS_LABELS,
  type PaymentRecord,
} from "@/lib/order-types";
import { formatThb } from "@/lib/th-billing";

const initial: OpsActionResult | null = null;

export function PaymentReviewForm({
  payment,
  orderId,
  readOnly,
  next,
}: {
  payment: PaymentRecord;
  orderId: string;
  readOnly?: boolean;
  next?: string;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    confirmOrderPaymentAction,
    initial,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectOrderPaymentAction,
    initial,
  );

  if (readOnly || payment.status === "confirmed") {
    return (
      <p className="text-xs text-ink/60">
        {PAYMENT_RECORD_STATUS_LABELS[payment.status]}
      </p>
    );
  }

  if (payment.status === "rejected") {
    return (
      <p className="text-sm text-red-800">
        ปฏิเสธแล้ว
        {payment.rejectReason ? ` — ${payment.rejectReason}` : ""}
        <span className="mt-1 block text-xs text-ink/60">
          รอลูกค้าแนบสลิปใหม่ แล้วรายการจะกลับมารออนุมัติ
        </span>
      </p>
    );
  }

  const busy = approvePending || rejectPending;

  return (
    <div className="space-y-4">
      <form action={approveAction} className="space-y-2">
        <input type="hidden" name="paymentId" value={payment.paymentId} />
        <input type="hidden" name="orderId" value={orderId} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {approveState?.ok ? (
          <p className="text-sm text-forest">อนุมัติรับเงินแล้ว</p>
        ) : null}
        {approveState && !approveState.ok ? (
          <p className="text-sm text-red-700" role="alert">
            {approveState.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-forest px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
        >
          {approvePending
            ? "กำลังอนุมัติ…"
            : `อนุมัติรับเงิน ${PAYMENT_KIND_LABELS[payment.kind]} ${formatThb(payment.amount)}`}
        </button>
      </form>
      <form
        action={rejectAction}
        className="space-y-2 rounded-lg border border-red-200 bg-red-50/60 p-3"
      >
        <input type="hidden" name="paymentId" value={payment.paymentId} />
        <input type="hidden" name="orderId" value={orderId} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label className="block text-sm">
          <span className="font-medium text-red-900">ปฏิเสธ — ใส่เหตุผล</span>
          <textarea
            name="reason"
            required
            minLength={4}
            rows={3}
            placeholder="เช่น ยอดไม่ตรง / สลิปไม่ชัด / โอนผิดบัญชี"
            className="mt-1 w-full rounded border border-red-200 px-3 py-2"
          />
        </label>
        {rejectState?.ok ? (
          <p className="text-sm text-forest">ปฏิเสธแล้ว — รอลูกค้าส่งสลิปใหม่</p>
        ) : null}
        {rejectState && !rejectState.ok ? (
          <p className="text-sm text-red-700" role="alert">
            {rejectState.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded border border-red-700 px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-60"
        >
          {rejectPending ? "กำลังปฏิเสธ…" : "ปฏิเสธยอดนี้"}
        </button>
      </form>
    </div>
  );
}

export function VoucherReviewForm({
  voucherId,
  amount,
  readOnly,
  rejected,
  rejectReason,
  next = "/ops/approvals",
}: {
  voucherId: string;
  amount: number;
  readOnly?: boolean;
  rejected?: boolean;
  rejectReason?: string | null;
  next?: string;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    confirmCashReceiptAction,
    initial,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectCashReceiptAction,
    initial,
  );

  if (readOnly) {
    return <p className="text-xs text-ink/60">ดูอย่างเดียว</p>;
  }

  if (rejected) {
    return (
      <p className="text-sm text-red-800">
        ปฏิเสธแล้ว{rejectReason ? ` — ${rejectReason}` : ""}
        <span className="mt-1 block text-xs text-ink/60">
          รอลูกค้าแนบสลิปใหม่ แล้วรายการจะกลับมารออนุมัติ
        </span>
      </p>
    );
  }

  const busy = approvePending || rejectPending;

  return (
    <div className="space-y-4">
      <form action={approveAction} className="space-y-2">
        <input type="hidden" name="voucherId" value={voucherId} />
        <input type="hidden" name="next" value={next} />
        {approveState && !approveState.ok ? (
          <p className="text-sm text-red-700" role="alert">
            {approveState.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-forest px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
        >
          {approvePending ? "กำลังอนุมัติ…" : `อนุมัติรับเงิน ${formatThb(amount)}`}
        </button>
      </form>
      <form
        action={rejectAction}
        className="space-y-2 rounded-lg border border-red-200 bg-red-50/60 p-3"
      >
        <input type="hidden" name="voucherId" value={voucherId} />
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm">
          <span className="font-medium text-red-900">ปฏิเสธ — ใส่เหตุผล</span>
          <textarea
            name="reason"
            required
            minLength={4}
            rows={3}
            placeholder="เช่น ยอดไม่ตรง / สลิปไม่ชัด / โอนผิดบัญชี"
            className="mt-1 w-full rounded border border-red-200 px-3 py-2"
          />
        </label>
        {rejectState && !rejectState.ok ? (
          <p className="text-sm text-red-700" role="alert">
            {rejectState.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded border border-red-700 px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-60"
        >
          {rejectPending ? "กำลังปฏิเสธ…" : "ปฏิเสธยอดนี้"}
        </button>
      </form>
    </div>
  );
}
