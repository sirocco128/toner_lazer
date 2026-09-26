"use server";

import { requireOpsActor } from "@/lib/ops-auth";
import {
  computeOpsPricing,
  listOpsCatalog,
  type OpsPricingComputeInput,
  type OpsPricingFailure,
  type OpsPricingResult,
} from "@/lib/ops-pricing";
import type { FreightCategory, FreightMode, FreightOrigin } from "@/lib/alibaba/types";

const ORIGINS: FreightOrigin[] = ["guangzhou_shenzhen", "yiwu"];
const MODES: FreightMode[] = ["truck", "sea"];
const CATEGORIES: FreightCategory[] = ["general", "electronic_tisi"];

function asNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseInput(raw: Record<string, unknown>): OpsPricingComputeInput {
  const origin = ORIGINS.includes(raw.origin as FreightOrigin)
    ? (raw.origin as FreightOrigin)
    : undefined;
  const forceMode = MODES.includes(raw.forceMode as FreightMode)
    ? (raw.forceMode as FreightMode)
    : undefined;
  const category = CATEGORIES.includes(raw.category as FreightCategory)
    ? (raw.category as FreightCategory)
    : undefined;
  return {
    slug: String(raw.slug || "").trim() || undefined,
    extraQty: asNumber(raw.extraQty),
    includeFreight: raw.includeFreight !== false && raw.includeFreight !== "false",
    includePackaging:
      raw.includePackaging === true || raw.includePackaging === "true",
    month: asNumber(raw.month) ?? new Date().getMonth() + 1,
    profile: raw.profile === "corporate" ? "corporate" : "standard",
    forceMode,
    origin,
    category,
    cnyToThb: asNumber(raw.cnyToThb),
    factoryCny: asNumber(raw.factoryCny),
    weightKg: asNumber(raw.weightKg),
    lengthCm: asNumber(raw.lengthCm),
    widthCm: asNumber(raw.widthCm),
    heightCm: asNumber(raw.heightCm),
  };
}

export async function searchOpsCatalogAction(query: string) {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false as const, error: "ไม่มีสิทธิ์" };
  const items = await listOpsCatalog(query);
  return { ok: true as const, items };
}

export async function computeOpsPricingAction(
  raw: Record<string, unknown>,
): Promise<OpsPricingResult | OpsPricingFailure> {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์คิดราคา" };
  return computeOpsPricing(actor, parseInput(raw));
}
