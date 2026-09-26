"use client";

import { useActionState } from "react";
import { updateOrderFulfillmentAction } from "@/app/actions/ops-orders";
import { PaymentReviewForm } from "@/components/AccountingDecisionForms";
import type { OpsActionResult } from "@/app/actions/ops";
import {
  FULFILLMENT_LABELS,
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
  type PaymentRecord,
} from "@/lib/order-types";

const initial: OpsActionResult | null = null;

export function OrderFulfillmentForm({
  orderId,
  current,
  readOnly,
  collapsed = false,
}: {
  orderId: string;
  current: FulfillmentStatus;
  readOnly?: boolean;
  /** When ready to ship, tuck the generic dropdown away */
  collapsed?: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateOrderFulfillmentAction,
    initial,
  );

  if (readOnly) {
    return (
      <p className="text-sm">สถานะสินค้า: {FULFILLMENT_LABELS[current]}</p>
    );
  }

  const form = (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block text-sm">
        <span className="font-medium">เลื่อนสถานะสินค้า</span>
        <select
          name="status"
          defaultValue={current}
          className="mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
        >
          {FULFILLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FULFILLMENT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {state?.ok ? <p className="text-sm text-forest">บันทึกแล้ว</p> : null}
      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "อัปเดตสถานะ"}
      </button>
    </form>
  );

  if (collapsed) {
    return (
      <details className="rounded-lg border border-forest/10 bg-ink/[0.02] px-3 py-2">
        <summary className="cursor-pointer text-sm text-ink/65">
          สถานะอื่น (ไม่ใช่ยืนยันส่ง)
        </summary>
        <div className="mt-3">{form}</div>
      </details>
    );
  }

  return form;
}

/** One-click Ship Confirm → out_for_delivery (cuts WMS reservation on transition). */
export function ShipConfirmForm({
  orderId,
  enabled,
  readOnly,
}: {
  orderId: string;
  enabled: boolean;
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateOrderFulfillmentAction,
    initial,
  );

  if (readOnly || !enabled) return null;

  return (
    <form
      action={action}
      className="space-y-2"
      onSubmit={(event) => {
        if (
          !window.confirm(
            "ยืนยันส่ง (Ship Confirm)? ระบบจะตัดสต็อกที่จองและเปลี่ยนเป็นกำลังจัดส่ง",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="status" value="out_for_delivery" />
      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg bg-amber-700 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-amber-800 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "กำลังยืนยัน…" : "2. ยืนยันส่ง / Ship Confirm"}
      </button>
    </form>
  );
}

export function ConfirmPaymentForm({
  payment,
  orderId,
  readOnly,
}: {
  payment: PaymentRecord;
  orderId: string;
  readOnly?: boolean;
}) {
  return (
    <PaymentReviewForm payment={payment} orderId={orderId} readOnly={readOnly} />
  );
}
