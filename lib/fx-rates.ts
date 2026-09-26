/**
 * Live FX guide for factory PO costing (CNY/USD → THB).
 * The ops form keeps an editable working rate; this is the market reference.
 */

import {
  FACTORY_MARKET_FX_USD_THB,
  SMARTGIFT_FX_CNY_THB,
} from "@/lib/alibaba/rates";
import type { FactoryCurrency } from "@/lib/factory-po-types";

export type FxGuide = {
  cnyThb: number;
  usdThb: number;
  source: string;
  fetchedAt: string;
  live: boolean;
};

const CACHE_MS = 30 * 60 * 1000;
const FETCH_MS = 6_000;

let cache: { at: number; data: FxGuide } | null = null;

export function fallbackFxGuide(): FxGuide {
  return {
    cnyThb: SMARTGIFT_FX_CNY_THB,
    usdThb: FACTORY_MARKET_FX_USD_THB,
    source: "ค่าเริ่มต้นในระบบ",
    fetchedAt: new Date().toISOString(),
    live: false,
  };
}

export function rateForCurrency(guide: FxGuide, currency: FactoryCurrency): number {
  return currency === "USD" ? guide.usdThb : guide.cnyThb;
}

export function roundFxRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10000) / 10000;
}

export function formatFxRate(value: number): string {
  const n = roundFxRate(value);
  if (!n) return "—";
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function positiveRate(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 200) return null;
  return roundFxRate(n);
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fromFrankfurter(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const rates = (payload as { rates?: { THB?: unknown } }).rates;
  return positiveRate(rates?.THB);
}

function fromOpenErApi(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as { result?: string; rates?: { THB?: unknown } };
  if (row.result && row.result !== "success") return null;
  return positiveRate(row.rates?.THB);
}

async function fetchLiveFxGuide(
  fetchImpl: typeof fetch,
): Promise<FxGuide | null> {
  const frankfurter = await Promise.all([
    fetchJson("https://api.frankfurter.app/latest?from=CNY&to=THB", fetchImpl),
    fetchJson("https://api.frankfurter.app/latest?from=USD&to=THB", fetchImpl),
  ]);
  const cnyFromFrank = fromFrankfurter(frankfurter[0]);
  const usdFromFrank = fromFrankfurter(frankfurter[1]);
  if (cnyFromFrank && usdFromFrank) {
    return {
      cnyThb: cnyFromFrank,
      usdThb: usdFromFrank,
      source: "frankfurter.app",
      fetchedAt: new Date().toISOString(),
      live: true,
    };
  }

  const openEr = await Promise.all([
    fetchJson("https://open.er-api.com/v6/latest/CNY", fetchImpl),
    fetchJson("https://open.er-api.com/v6/latest/USD", fetchImpl),
  ]);
  const cnyFromOpen = fromOpenErApi(openEr[0]) ?? cnyFromFrank;
  const usdFromOpen = fromOpenErApi(openEr[1]) ?? usdFromFrank;
  if (cnyFromOpen && usdFromOpen) {
    return {
      cnyThb: cnyFromOpen,
      usdThb: usdFromOpen,
      source: "open.er-api.com",
      fetchedAt: new Date().toISOString(),
      live: true,
    };
  }

  return null;
}

export async function getFxGuide(options?: {
  fetchImpl?: typeof fetch;
  now?: number;
  bypassCache?: boolean;
}): Promise<FxGuide> {
  const now = options?.now ?? Date.now();
  if (!options?.bypassCache && cache && now - cache.at < CACHE_MS) {
    return cache.data;
  }
  const live = await fetchLiveFxGuide(options?.fetchImpl ?? fetch);
  const data = live ?? fallbackFxGuide();
  cache = { at: now, data };
  return data;
}

export function resetFxGuideCache(): void {
  cache = null;
}
