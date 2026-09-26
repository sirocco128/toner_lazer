"use client";

import { useActionState } from "react";
import {
  importCustomersAction,
  mergeCustomersAction,
} from "@/app/actions/ops-customers";
import type { OpsActionResult } from "@/app/actions/ops";

const initial: OpsActionResult | null = null;

export function CustomerImportForm() {
  const [state, action, pending] = useActionState(importCustomersAction, initial);
  return (
    <form action={action} className="mt-6 space-y-4 rounded border border-forest/15 bg-paper p-4">
      <p className="text-sm text-ink/70">
        รองรับสมุดรายชื่อ FlowAccount (คอลัมน์ภาษาไทย) หรือ CSV หัวข้อ company,email,phone,taxId
      </p>
      <label className="block text-sm">
        ไฟล์ CSV
        <input type="file" name="file" accept=".csv,text/csv,text/plain" className="mt-1 block" />
      </label>
      <label className="block text-sm">
        หรือวางข้อความ
        <textarea name="csv" rows={10} className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono text-xs" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="dryRun" value="1" defaultChecked />
        ตรวจก่อน ไม่บันทึก
      </label>
      {state?.error ? (
        <p className={state.ok ? "text-sm text-forest" : "text-sm text-red-700"}>{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-forest px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
      >
        {pending ? "กำลังนำเข้า…" : "นำเข้า"}
      </button>
    </form>
  );
}

export function CustomerMergeForm({
  targetId,
  duplicates,
}: {
  targetId: number;
  duplicates: Array<{ id: number; company: string; email: string }>;
}) {
  const [state, action, pending] = useActionState(mergeCustomersAction, initial);
  if (duplicates.length === 0) return null;
  return (
    <form action={action} className="mt-4 rounded border border-amber-700/30 bg-amber-50 p-4 text-sm">
      <input type="hidden" name="targetId" value={targetId} />
      <p className="font-medium text-forest">พบรายที่อาจซ้ำ</p>
      <label className="mt-2 block">
        ยุบรายนี้เข้ามาในลูกค้าปัจจุบัน
        <select name="sourceId" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
          {duplicates.map((d) => (
            <option key={d.id} value={d.id}>
              {d.company} · {d.email}
            </option>
          ))}
        </select>
      </label>
      {state && !state.ok ? <p className="mt-2 text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded bg-forest px-3 py-1.5 text-paper disabled:opacity-60"
      >
        {pending ? "กำลังรวม…" : "รวมราย"}
      </button>
    </form>
  );
}
