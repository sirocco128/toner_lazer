import type { WmsMovementKind } from "@/lib/wms-types";

export const WMS_MOVEMENT_LABELS: Record<string, string> = {
  receive: "รับเข้า",
  ship: "ตัดส่ง",
  adjust: "ปรับยอด",
  transfer_out: "โอนออก",
  transfer_in: "โอนเข้า",
  reserve: "จอง",
  release: "ปล่อยจอง",
  consume_reserve: "ใช้จอง",
  void_receive: "ยกเลิกรับ",
  qc_hold: "เข้า QC",
  cycle_count: "ตรวจนับ",
};

export function wmsMovementLabel(kind: string): string {
  return WMS_MOVEMENT_LABELS[kind] || kind;
}

/** Tailwind classes for Δ qty (positive green / negative amber-red). */
export function wmsDeltaClass(delta: number): string {
  if (delta > 0) return "text-forest font-medium";
  if (delta < 0) return "text-amber-800 font-medium";
  return "text-ink/50";
}

export function formatWmsDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export type WmsMovementKindKnown = WmsMovementKind;
