"use client";

import { useActionState } from "react";
import {
  lookupOrdersAction,
  notifyPaymentAction,
  notifyVoucherPaymentAction,
  type OrderLookupResult,
  type PayNotifyResult,
} from "@/app/actions/orders";

const lookupInitial: OrderLookupResult | null = null;
const payInitial: PayNotifyResult | null = null;

export function OrderLookupForm() {
  const [state, action, pending] = useActionState(
    lookupOrdersAction,
    lookupInitial,
  );

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-forest/15 bg-paper p-6">
      <label className="block text-sm">
        <span className="font-medium text-forest">อีเมลที่ใช้ขอใบเสนอราคา</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-forest">เบอร์โทร</span>
        <input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-forest">เลขออเดอร์ (ถ้ามี)</span>
        <input
          name="orderId"
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono text-sm"
          placeholder="ORD-…"
        />
      </label>
      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-forest px-4 py-3 text-sm font-semibold text-paper disabled:opacity-60"
      >
        {pending ? "กำลังค้นหา…" : "ดูออเดอร์และชำระเงิน"}
      </button>
    </form>
  );
}

export function NotifyPaymentForm({
  orderId,
  token,
  paymentId,
  voucherId,
}: {
  orderId?: string;
  token: string;
  paymentId?: string;
  voucherId?: string;
}) {
  const [state, action, pending] = useActionState(
    voucherId ? notifyVoucherPaymentAction : notifyPaymentAction,
    payInitial,
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      {orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}
      {paymentId ? <input type="hidden" name="paymentId" value={paymentId} /> : null}
      {voucherId ? <input type="hidden" name="voucherId" value={voucherId} /> : null}
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm">
        <span className="font-medium">แนบสลิปการโอน</span>
        <input
          name="slip"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp"
          className="mt-1 w-full text-sm"
        />
        <span className="mt-1 block text-xs text-ink/55">
          รูปจากแอปธนาคาร ระบบจะตรวจยอดและหมายเลขพร้อมเพย์ให้
        </span>
      </label>
      <label className="block text-sm">
        <span className="font-medium">เลขที่อ้างอิง / เวลาโอน (ถ้ามี)</span>
        <input
          name="reference"
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          placeholder="เช่น โอน 20:15 น."
        />
      </label>
      {state?.ok ? (
        <p className="text-sm text-forest" role="status">
          {state.notes || "แจ้งโอนแล้ว รอบัญชีตรวจสอบและอนุมัติยอด"}
        </p>
      ) : null}
      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || state?.ok}
        className="rounded-full bg-brass px-4 py-2 text-sm font-semibold text-forest disabled:opacity-60"
      >
        {pending ? "กำลังตรวจสลิป…" : "แจ้งโอนเงินและแนบสลิป"}
      </button>
    </form>
  );
}
