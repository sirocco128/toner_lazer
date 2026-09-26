/**
 * Production-minded mockup compose helpers.
 * Pure math stays here so Node tests can cover warp/print sizing.
 */

import type {
  MockupFinish,
  MockupSurface,
  MockupSurfaceKind,
} from "@/lib/mockup-studio";

export type PrintBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees clockwise. */
  rotateDeg: number;
  /** Horizontal cylinder bend amount (0 = flat, ~0.7 = tumbler). */
  bend: number;
};

/** Realistic printable area for the selected surface (fractions of product frame). */
export function resolvePrintBox(surface: MockupSurface): PrintBox {
  const base =
    surface.logoZones?.product ??
    surface.logoZones?.lifestyle ??
    surface.logoZones?.office ??
    surface.logoZones?.retail ?? {
      x: 0.32,
      y: 0.36,
      w: 0.36,
      h: 0.24,
    };
  const kind = surface.kind;

  if (kind === "cylinder") {
    const w = clamp(base.w, 0.16, 0.34);
    const h = clamp(base.h, 0.1, 0.2);
    return {
      x: clamp(0.5 - w / 2, 0.05, 0.9 - w),
      y: clamp(base.y, 0.32, 0.58),
      w,
      h,
      rotateDeg: 0,
      bend: 0.62,
    };
  }

  if (kind === "pen") {
    const w = clamp(base.w, 0.28, 0.52);
    const h = clamp(base.h, 0.08, 0.16);
    return {
      x: clamp(base.x, 0.12, 0.7 - w),
      y: clamp(base.y, 0.3, 0.58),
      w,
      h,
      rotateDeg: -34,
      bend: 0.28,
    };
  }

  const w = clamp(base.w, 0.22, 0.48);
  const h = clamp(base.h, 0.16, 0.34);
  return {
    x: clamp(base.x, 0.08, 0.85 - w),
    y: clamp(base.y, 0.2, 0.62),
    w,
    h,
    rotateDeg: kind === "cover" ? -8 : 0,
    bend: 0.08,
  };
}

/** Where to drop the branded product onto a lifestyle / office / retail scene. */
export function sceneProductSlot(
  variantId: "lifestyle" | "office" | "retail",
  kind: MockupSurfaceKind,
  slotIndex = 0,
): { x: number; y: number; w: number; h: number } {
  const officeSlots =
    kind === "cylinder"
      ? [
          { x: 0.58, y: 0.28, w: 0.34, h: 0.48 },
          { x: 0.12, y: 0.3, w: 0.32, h: 0.46 },
          { x: 0.36, y: 0.22, w: 0.36, h: 0.5 },
        ]
      : kind === "pen"
        ? [
            { x: 0.48, y: 0.42, w: 0.42, h: 0.28 },
            { x: 0.18, y: 0.46, w: 0.4, h: 0.26 },
            { x: 0.32, y: 0.36, w: 0.44, h: 0.3 },
          ]
        : [
            { x: 0.5, y: 0.32, w: 0.4, h: 0.42 },
            { x: 0.14, y: 0.34, w: 0.38, h: 0.4 },
            { x: 0.34, y: 0.24, w: 0.42, h: 0.44 },
          ];

  const lifestyleSlots =
    kind === "cylinder"
      ? [
          { x: 0.52, y: 0.22, w: 0.4, h: 0.55 },
          { x: 0.1, y: 0.24, w: 0.38, h: 0.52 },
          { x: 0.3, y: 0.18, w: 0.42, h: 0.56 },
        ]
      : kind === "pen"
        ? [
            { x: 0.42, y: 0.38, w: 0.48, h: 0.32 },
            { x: 0.12, y: 0.4, w: 0.46, h: 0.3 },
            { x: 0.28, y: 0.34, w: 0.5, h: 0.34 },
          ]
        : [
            { x: 0.48, y: 0.26, w: 0.44, h: 0.48 },
            { x: 0.1, y: 0.28, w: 0.42, h: 0.46 },
            { x: 0.3, y: 0.2, w: 0.46, h: 0.5 },
          ];

  const retailSlots =
    kind === "cylinder"
      ? [
          { x: 0.3, y: 0.16, w: 0.4, h: 0.56 },
          { x: 0.08, y: 0.2, w: 0.38, h: 0.52 },
          { x: 0.5, y: 0.18, w: 0.42, h: 0.54 },
        ]
      : kind === "pen"
        ? [
            { x: 0.26, y: 0.34, w: 0.48, h: 0.3 },
            { x: 0.1, y: 0.4, w: 0.46, h: 0.28 },
            { x: 0.4, y: 0.32, w: 0.5, h: 0.32 },
          ]
        : [
            { x: 0.28, y: 0.2, w: 0.44, h: 0.5 },
            { x: 0.08, y: 0.24, w: 0.42, h: 0.46 },
            { x: 0.46, y: 0.18, w: 0.46, h: 0.5 },
          ];

  const list =
    variantId === "office"
      ? officeSlots
      : variantId === "retail"
        ? retailSlots
        : lifestyleSlots;
  const idx = ((slotIndex % list.length) + list.length) % list.length;
  return list[idx]!;
}

export function sceneSlotCount(
  variantId: "lifestyle" | "office" | "retail",
  kind: MockupSurfaceKind,
): number {
  return sceneProductSlot(variantId, kind, 0) && 3;
}

export type FinishBlendMode = "multiply" | "soft-light";

export function finishBlendMode(finish: MockupFinish): FinishBlendMode {
  const dark = luminance(finish.body) < 0.42;
  // Ink on dark coatings reads better with soft-light; light metal/paper with multiply.
  return dark ? "soft-light" : "multiply";
}

export function finishRecolorAlpha(finish: MockupFinish): number {
  if (finish.id === "stainless") return 0.28;
  if (finish.id === "brass") return 0.4;
  if (finish.id === "white") return 0.45;
  return 0.58;
}

/**
 * Map a destination column (0..1 across print box) to source sample + strip scale
 * for a simple front-facing cylinder.
 */
export function cylinderSampleAt(
  destT: number,
  bend: number,
): { srcT: number; scale: number } {
  const safeBend = clamp(bend, 0, 0.95);
  if (safeBend < 0.01) {
    return { srcT: clamp(destT, 0, 1), scale: 1 };
  }
  const theta = (destT - 0.5) * Math.PI * safeBend;
  const srcT = 0.5 + theta / (Math.PI * safeBend);
  const scale = Math.max(0.18, Math.cos(theta));
  return { srcT, scale };
}

export function materialHint(kind: MockupSurfaceKind): string {
  if (kind === "cylinder") {
    return "สกรีนโค้งตามลำตัวกระบอก — ขนาดประมาณพื้นที่พิมพ์จริง";
  }
  if (kind === "pen") {
    return "พิมพ์ตามแนวลำกล้องปากกา — แถบแคบตามงานจริง";
  }
  return "พิมพ์แบนบนปก/หน้าสมุด — วางกึ่งกลางพื้นที่พิมพ์";
}

function luminance(hex: string): number {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => `${ch}${ch}`)
          .join("")
      : raw;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return 0.5;
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
