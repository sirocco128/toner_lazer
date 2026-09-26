"use client";

import { useActionState } from "react";
import { moveSerialToCAction } from "@/app/actions/ops-products";
import type { OpsActionResult } from "@/app/actions/ops";
import type { SkuSerial } from "@/lib/sku-master-types";

const initial: OpsActionResult | null = null;

export function SkuMoveToCForm({
  fromProductId,
  serials,
}: {
  fromProductId: string;
  serials: SkuSerial[];
}) {
  const onHand = serials.filter((item) => item.status === "on_hand");
  const [state, action, pending] = useActionState(moveSerialToCAction, initial);

  if (onHand.length === 0) {
    return (
      <p className="text-sm text-ink/60">ยังไม่มีซีเรียลในคลังของรหัสนี้</p>
    );
  }

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(event) => {
        if (!window.confirm("ย้ายซีเรียลนี้ไปคลาส C เคลียร์? จำนวนในคลัง A/B จะลด 1")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="fromProductId" value={fromProductId} />
      {state?.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="font-medium">ซีเรียลในคลัง</span>
        <select name="serialNo" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
          {onHand.map((item) => (
            <option key={item.id} value={item.serialNo}>
              {item.serialNo}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">ตำหนิ (โชว์หน้าราคาเคลียร์)</span>
        <textarea
          name="defectReason"
          required
          rows={3}
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">ราคาเคลียร์ (บาท)</span>
        <input
          name="clearancePriceThb"
          type="number"
          min={0}
          step="0.01"
          required
          className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-forest px-3 py-1.5 text-sm text-paper disabled:opacity-60"
      >
        {pending ? "กำลังย้าย…" : "ย้ายไปคลาส C"}
      </button>
    </form>
  );
}
