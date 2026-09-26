"use client";

import { useActionState } from "react";
import {
  sopUnlockAction,
  type SopUnlockResult,
} from "@/app/actions/sop-guide";

const initial: SopUnlockResult | null = null;

export function SopUnlockForm() {
  const [state, action, pending] = useActionState(sopUnlockAction, initial);

  return (
    <form action={action} className="mx-auto mt-8 max-w-md space-y-4" aria-busy={pending}>
      <label className="block text-sm">
        <span className="font-medium text-forest">โทเค็นเปิดอ่านคู่มือ</span>
        <input
          type="password"
          name="token"
          required
          autoComplete="off"
          placeholder="วางโทเค็นที่ได้รับ"
          className="mt-1 w-full rounded-lg border border-forest/20 bg-paper px-3 py-2.5 tracking-wide"
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
        className="w-full rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-forest-light disabled:opacity-60"
      >
        {pending ? "กำลังตรวจสอบ…" : "เปิดคู่มือ"}
      </button>
    </form>
  );
}
