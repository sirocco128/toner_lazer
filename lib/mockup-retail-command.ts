/**
 * Retail-channel follow-up commands for mockup tweaks.
 * Same Thai phrases the buyer already uses: move a bit higher, change color.
 */

import type { MockupFinish } from "@/lib/mockup-studio";
import { clamp } from "@/lib/mockup-studio";
import type { PrintBox } from "@/lib/mockup-compose";

export type RetailAdjustments = {
  dx: number;
  dy: number;
  scale: number;
  finishId: string | null;
  textColor: string | null;
  history: string[];
};

export type RetailCommandPatch = {
  understood: boolean;
  summary: string;
  dx: number;
  dy: number;
  scale: number;
  finishId: string | null;
  cycleFinish: boolean;
  textColor: string | null;
};

export const EMPTY_RETAIL_ADJUSTMENTS: RetailAdjustments = {
  dx: 0,
  dy: 0,
  scale: 1,
  finishId: null,
  textColor: null,
  history: [],
};

export const RETAIL_COMMAND_CHIPS = [
  "สูงขึ้นไปอีกนิด",
  "ต่ำลงนิด",
  "ใหญ่ขึ้น",
  "เล็กลง",
  "เปลี่ยนสีเป็นดำด้าน",
  "เปลี่ยนสีเป็นเขียวป่า",
] as const;

const COLOR_ALIASES: { id: string; hex?: string; labels: string[] }[] = [
  { id: "stainless", labels: ["สแตนเลส", "เงิน", "stainless", "silver"] },
  { id: "black", labels: ["ดำด้าน", "ดำ", "black", "สีดำ"] },
  { id: "white", labels: ["ขาวงาช้าง", "ขาว", "ivory", "white", "สีขาว"] },
  { id: "forest", labels: ["เขียวป่า", "เขียว", "forest", "สีเขียว"] },
  { id: "navy", labels: ["กรมท่า", "navy", "น้ำเงิน", "สีน้ำเงิน"] },
  { id: "brass", labels: ["ทองเหลือง", "ทอง", "brass", "สีทอง"] },
];

function nudgeAmount(raw: string): number {
  if (/นิด|หน่อย|เล็กน้อย|อีกนิด|นิดหน่อย/.test(raw)) return 0.028;
  if (/มาก|เยอะ|ชัด/.test(raw)) return 0.08;
  return 0.045;
}

function matchFinishId(raw: string, finishes: readonly MockupFinish[]): string | null {
  for (const alias of COLOR_ALIASES) {
    if (alias.labels.some((label) => raw.includes(label))) {
      if (finishes.some((item) => item.id === alias.id)) return alias.id;
    }
  }
  for (const finish of finishes) {
    if (raw.includes(finish.label)) return finish.id;
  }
  return null;
}

const HEX = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;

export function parseRetailCommand(
  command: string,
  finishes: readonly MockupFinish[] = [],
): RetailCommandPatch {
  const raw = command.trim();
  const empty: RetailCommandPatch = {
    understood: false,
    summary: "",
    dx: 0,
    dy: 0,
    scale: 1,
    finishId: null,
    cycleFinish: false,
    textColor: null,
  };
  if (!raw) return empty;

  const amount = nudgeAmount(raw);
  let dx = 0;
  let dy = 0;
  let scale = 1;
  const parts: string[] = [];

  if (/สูง|ขึ้นไป|ขยับขึ้น|เลื่อนขึ้น|สูงกว่า|higher|up\b/.test(raw)) {
    dy -= amount;
    parts.push("ขยับโลโก้สูงขึ้น");
  }
  if (/ต่ำ|ลงไป|ขยับลง|เลื่อนลง|ต่ำกว่า|lower|down\b/.test(raw)) {
    dy += amount;
    parts.push("ขยับโลโก้ลง");
  }
  if (/ซ้าย|left/.test(raw)) {
    dx -= amount;
    parts.push("ขยับซ้าย");
  }
  if (/ขวา|right/.test(raw)) {
    dx += amount;
    parts.push("ขยับขวา");
  }
  if (/ใหญ่ขึ้น|ขยาย|โตขึ้น|bigger|larger/.test(raw)) {
    scale *= 1.12;
    parts.push("ขยายโลโก้");
  }
  if (/เล็กลง|ย่อ|smaller/.test(raw)) {
    scale *= 0.9;
    parts.push("ย่อโลโก้");
  }

  const hex = raw.match(HEX)?.[0] ?? null;
  const finishId = matchFinishId(raw, finishes);
  const wantsColor = /เปลี่ยนสี|สีใหม่|recolor|change colour|change color/.test(raw);
  let cycleFinish = false;
  if (finishId) {
    parts.push(`เปลี่ยนสีวัสดุเป็น${finishes.find((item) => item.id === finishId)?.label || finishId}`);
  } else if (wantsColor && !hex) {
    cycleFinish = true;
    parts.push("สลับสีวัสดุถัดไป");
  }
  if (hex) {
    parts.push(`เปลี่ยนสีข้อความเป็น ${hex}`);
  }

  if (!parts.length) return empty;

  return {
    understood: true,
    summary: parts.join(" · "),
    dx,
    dy,
    scale,
    finishId,
    cycleFinish,
    textColor: hex,
  };
}

export function nextFinishId(
  currentId: string,
  finishes: readonly MockupFinish[],
): string {
  if (!finishes.length) return currentId;
  const index = finishes.findIndex((item) => item.id === currentId);
  const next = finishes[(index + 1) % finishes.length];
  return next?.id ?? currentId;
}

export function mergeRetailAdjustments(
  current: RetailAdjustments,
  patch: RetailCommandPatch,
): RetailAdjustments {
  return {
    dx: clamp(current.dx + patch.dx, -0.35, 0.35),
    dy: clamp(current.dy + patch.dy, -0.4, 0.4),
    scale: clamp(current.scale * patch.scale, 0.55, 1.85),
    finishId: patch.finishId ?? current.finishId,
    textColor: patch.textColor ?? current.textColor,
    history: patch.summary
      ? [...current.history, patch.summary].slice(-8)
      : current.history,
  };
}

export function applyPrintAdjustments(
  box: PrintBox,
  adj: RetailAdjustments,
): PrintBox {
  const w = clamp(box.w * adj.scale, 0.08, 0.72);
  const h = clamp(box.h * adj.scale, 0.05, 0.5);
  return {
    ...box,
    w,
    h,
    x: clamp(box.x + adj.dx, 0.02, 0.96 - w),
    y: clamp(box.y + adj.dy, 0.06, 0.9 - h),
  };
}

export function describeRetailAdjustments(adj: RetailAdjustments): string {
  if (!adj.history.length) return "";
  return adj.history.join(" → ");
}
