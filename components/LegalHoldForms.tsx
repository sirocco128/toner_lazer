"use client";

import { useActionState } from "react";
import {
  applyLegalHoldAction,
  releaseLegalHoldAction,
  type OpsHoldActionResult,
} from "@/app/actions/ops-holds";

const empty: OpsHoldActionResult | null = null;

export function LegalHoldForms({ canRelease }: { canRelease: boolean }) {
  const [applyState, applyAction] = useActionState(applyLegalHoldAction, empty);
  const [releaseState, releaseAction] = useActionState(
    releaseLegalHoldAction,
    empty,
  );

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <form action={applyAction} className="rounded-lg border border-forest/15 bg-paper p-4">
        <h2 className="font-semibold text-forest">พักลบเอกสาร</h2>
        <p className="mt-1 text-xs text-ink/60">
          ใช้เมื่อมีข้อพิพาท ลูกค้าทัก หรือเอกสารต้องเก็บเป็นหลักฐาน — ห้ามลบจนกว่าจะปลด
        </p>
        <label className="mt-3 block text-sm">
          กุญแจไฟล์
          <input
            name="objectKey"
            required
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono text-sm"
            placeholder="slips/SLP-20260906-ABCD.jpg"
          />
        </label>
        <label className="mt-3 block text-sm">
          อ้างอิงคดี / ออเดอร์
          <input
            name="caseRef"
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
            placeholder="ORD-… หรือเลขเคลม"
          />
        </label>
        <label className="mt-3 block text-sm">
          เหตุผล (อย่างน้อย 3 ตัวอักษร)
          <input
            name="reason"
            required
            minLength={3}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          />
        </label>
        {applyState?.error ? (
          <p className="mt-2 text-sm text-red-800">{applyState.error}</p>
        ) : null}
        {applyState?.ok ? (
          <p className="mt-2 text-sm text-forest">พักลบแล้ว</p>
        ) : null}
        <button
          type="submit"
          className="mt-4 min-h-11 rounded bg-forest px-4 py-2 text-sm text-paper"
        >
          พักลบ
        </button>
      </form>

      {canRelease ? (
        <form action={releaseAction} className="rounded-lg border border-forest/15 bg-paper p-4">
          <h2 className="font-semibold text-forest">ปลดการพักลบ</h2>
          <p className="mt-1 text-xs text-ink/60">
            ต้องเป็นผู้ดูแล และคนละบัญชีกับผู้ที่พักลบ
          </p>
          <label className="mt-3 block text-sm">
            กุญแจไฟล์
            <input
              name="objectKey"
              required
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="mt-3 block text-sm">
            เหตุผลที่ปลด
            <input
              name="reason"
              required
              minLength={3}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
            />
          </label>
          {releaseState?.error ? (
            <p className="mt-2 text-sm text-red-800">{releaseState.error}</p>
          ) : null}
          {releaseState?.ok ? (
            <p className="mt-2 text-sm text-forest">ปลดแล้ว</p>
          ) : null}
          <button
            type="submit"
            className="mt-4 min-h-11 rounded border border-forest/40 px-4 py-2 text-sm text-forest"
          >
            ปลด
          </button>
        </form>
      ) : (
        <p className="text-sm text-ink/60">
          การปลดพักลบทำได้เฉพาะผู้ดูแล และต้องไม่ใช่คนเดียวกับผู้ที่พัก
        </p>
      )}
    </div>
  );
}
