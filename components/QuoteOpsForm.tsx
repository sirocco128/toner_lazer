"use client";

import { useActionState } from "react";
import {
  updateQuoteOpsAction,
  type OpsActionResult,
} from "@/app/actions/ops";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "@/lib/quote-types";

const initial: OpsActionResult | null = null;

export function QuoteOpsForm({
  requestId,
  leadStatus,
  readOnly = false,
}: {
  requestId: string;
  leadStatus: LeadStatus;
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateQuoteOpsAction,
    initial,
  );

  if (readOnly) {
    return (
      <div className="mt-6 space-y-3 rounded border border-forest/15 bg-paper p-4 text-sm">
        <h2 className="text-lg font-semibold text-forest">สถานะขาย (ดูอย่างเดียว)</h2>
        <p>สถานะปัจจุบัน: {LEAD_STATUS_LABELS[leadStatus]}</p>
        <p className="text-ink/70">บันทึกการติดต่อดูได้จากไทม์ไลน์ด้านล่าง</p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4 rounded border border-forest/15 bg-paper p-4">
      <input type="hidden" name="requestId" value={requestId} />
      <h2 className="text-lg font-semibold text-forest">อัปเดตสถานะขาย</h2>
      <label className="block text-sm">
        <span className="font-medium">สถานะ lead</span>
        <select
          name="leadStatus"
          defaultValue={leadStatus}
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">บันทึกครั้งนี้</span>
        <textarea
          name="salesNotes"
          rows={4}
          defaultValue=""
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
          placeholder="เช่น โทรแล้ว ลูกค้ายังไม่รับสาย / นัดส่งแบบวันพุธ"
        />
      </label>
      <p className="text-xs text-ink/60">
        แต่ละครั้งที่บันทึกจะเพิ่มเป็นรายการในไทม์ไลน์ ไม่ทับข้อความเดิม
      </p>
      {state?.ok ? (
        <p className="text-sm text-forest">บันทึกลงไทม์ไลน์แล้ว</p>
      ) : null}
      {state && !state.ok ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-forest px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "บันทึกลงไทม์ไลน์"}
      </button>
    </form>
  );
}
