"use client";

import { useActionState } from "react";
import type { OpsActionResult } from "@/app/actions/ops";
import { QC_LOCATION_CODE, XDOCK_LOCATION_CODE } from "@/lib/wms-types";

const initial: OpsActionResult | null = null;

export type WmsBalanceHint = {
  productKey: string;
  locationCode: string;
  qtyOnHand: number;
};

type GuardMode = "adjust" | "transfer" | "cycle" | "plain";

function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function findSystemQty(
  hints: WmsBalanceHint[],
  productKey: string,
  locationCode: string,
): number {
  const key = normalizeKey(productKey);
  const loc = locationCode.trim() || "BIN-DEFAULT";
  const hit = hints.find(
    (h) =>
      normalizeKey(h.productKey) === key && h.locationCode === loc,
  );
  return hit?.qtyOnHand ?? 0;
}

export function WmsGuardedForm({
  action,
  submitLabel,
  children,
  mode = "plain",
  balanceHints = [],
  varianceSoft = 5,
  variancePct = 0.2,
}: {
  action: (
    prev: OpsActionResult | null,
    formData: FormData,
  ) => Promise<OpsActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  mode?: GuardMode;
  balanceHints?: WmsBalanceHint[];
  /** Absolute variance that triggers confirm on cycle count. */
  varianceSoft?: number;
  /** Relative variance (vs system qty) that triggers confirm. */
  variancePct?: number;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const data = new FormData(form);
    const productKey = String(data.get("productKey") || "");
    let message: string | null = null;

    if (mode === "adjust") {
      const delta = Number(String(data.get("qtyDelta") || "").replace(/,/g, ""));
      if (Number.isFinite(delta) && delta < 0) {
        message = `ยืนยันลดสต็อก ${Math.abs(delta)} ชิ้นของ ${productKey || "SKU นี้"}?`;
      }
    }

    if (mode === "transfer") {
      const from = String(data.get("fromLocation") || "").trim();
      const to = String(data.get("toLocation") || "").trim();
      const qty = Number(String(data.get("qty") || "").replace(/,/g, ""));
      if (to === QC_LOCATION_CODE) {
        message = `ยืนยันโอน ${qty || "?"} ชิ้นไปที่เก็บ QC (${QC_LOCATION_CODE})? ของนี้จะไม่พร้อมขายจนกว่าจะโอนกลับ`;
      } else if (
        from === XDOCK_LOCATION_CODE &&
        to !== XDOCK_LOCATION_CODE &&
        to !== QC_LOCATION_CODE
      ) {
        message = `ของนี้อยู่จุดแพ็ก Cross-Dock (${XDOCK_LOCATION_CODE}) — ยืนยันขึ้นชั้น ${to}? (ปกติควรแพ็กส่ง ไม่ขึ้นชั้น)`;
      }
    }

    if (mode === "cycle") {
      const locationCode = String(data.get("locationCode") || "BIN-DEFAULT");
      const counted = Number(String(data.get("qtyCounted") || "").replace(/,/g, ""));
      const system = findSystemQty(balanceHints, productKey, locationCode);
      if (Number.isFinite(counted)) {
        const variance = counted - system;
        const abs = Math.abs(variance);
        const rel = abs / Math.max(system, 1);
        if (abs >= varianceSoft || rel >= variancePct) {
          message = `ส่วนต่าง ${variance > 0 ? "+" : ""}${variance} (ระบบ ${system} → นับได้ ${counted}) ระบบจะปรับยอดทันที ยืนยัน?`;
        }
      }
    }

    if (message && !window.confirm(message)) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} className="space-y-4" onSubmit={onSubmit}>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}
      {children}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-forest px-4 py-2 text-sm text-paper disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : submitLabel}
      </button>
    </form>
  );
}
