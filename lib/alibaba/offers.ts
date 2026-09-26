import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { extractOfferImages } from "@/lib/alibaba/images";
import type { AlibabaOffer, FreightCategory, FreightOrigin } from "@/lib/alibaba/types";

const ORIGINS = new Set<FreightOrigin>(["guangzhou_shenzhen", "yiwu"]);
const CATEGORIES = new Set<FreightCategory>(["general", "electronic_tisi"]);

export function defaultOffersPath(): string {
  return (
    process.env.ALIBABA_OFFERS_PATH?.trim() ||
    resolve(process.cwd(), "data/1688-offers.json")
  );
}

export function loadOffersFromFile(filePath = defaultOffersPath()): AlibabaOffer[] {
  if (!existsSync(filePath)) return [];
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  return parseOffersDocument(raw);
}

export function parseOffersDocument(raw: unknown): AlibabaOffer[] {
  const list = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { offers?: unknown }).offers)
      ? (raw as { offers: unknown[] }).offers
      : [];

  const offers: AlibabaOffer[] = [];
  for (const item of list) {
    const parsed = parseOffer(item);
    if (parsed) offers.push(parsed);
  }
  return offers;
}

export function parseOffer(raw: unknown): AlibabaOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const slug = String(row.slug ?? "").trim();
  const offerId = String(row.offerId ?? row.productId ?? "").trim();
  const factoryMinCny = Number(row.factoryMinCny ?? row.minPriceCny);
  const factoryMaxCny = Number(row.factoryMaxCny ?? row.maxPriceCny ?? factoryMinCny);
  const minOrder = Math.floor(Number(row.minOrder ?? row.moq ?? 1));

  if (!slug || !offerId) return null;
  if (!Number.isFinite(factoryMinCny) || factoryMinCny < 0) return null;
  if (!Number.isFinite(factoryMaxCny) || factoryMaxCny < factoryMinCny) return null;
  if (!Number.isInteger(minOrder) || minOrder < 1) return null;

  const origin = ORIGINS.has(row.origin as FreightOrigin)
    ? (row.origin as FreightOrigin)
    : undefined;
  const category = CATEGORIES.has(row.category as FreightCategory)
    ? (row.category as FreightCategory)
    : undefined;

  const offer: AlibabaOffer = {
    slug,
    offerId,
    minOrder,
    factoryMinCny,
    factoryMaxCny,
    ...(origin ? { origin } : {}),
    ...(category ? { category } : {}),
  };

  const weightKg = Number(row.weightKg);
  if (Number.isFinite(weightKg) && weightKg > 0) offer.weightKg = weightKg;
  const lengthCm = Number(row.lengthCm);
  const widthCm = Number(row.widthCm);
  const heightCm = Number(row.heightCm);
  if (Number.isFinite(lengthCm) && lengthCm > 0) offer.lengthCm = lengthCm;
  if (Number.isFinite(widthCm) && widthCm > 0) offer.widthCm = widthCm;
  if (Number.isFinite(heightCm) && heightCm > 0) offer.heightCm = heightCm;

  const inland = Number(row.inlandFreightCny);
  if (Number.isFinite(inland) && inland >= 0) offer.inlandFreightCny = inland;

  const bulkQty = Math.floor(Number(row.bulkQty));
  if (Number.isInteger(bulkQty) && bulkQty >= minOrder) offer.bulkQty = bulkQty;

  const images = extractOfferImages(row.imageUrls ?? row);
  if (images.length > 0) offer.imageUrls = images;

  if (Array.isArray(row.ladders)) {
    const ladders = row.ladders
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const rec = entry as Record<string, unknown>;
        const minQty = Math.floor(Number(rec.minQty ?? rec.startQuantity));
        const priceCny = Number(rec.priceCny ?? rec.price);
        if (!Number.isInteger(minQty) || minQty < 1) return null;
        if (!Number.isFinite(priceCny) || priceCny < 0) return null;
        return { minQty, priceCny };
      })
      .filter((item): item is { minQty: number; priceCny: number } => item !== null);
    if (ladders.length > 0) offer.ladders = ladders;
  }

  return offer;
}

export function mergeLiveFactoryPrices(
  offer: AlibabaOffer,
  live: Partial<Pick<AlibabaOffer, "factoryMinCny" | "factoryMaxCny" | "minOrder" | "weightKg" | "lengthCm" | "widthCm" | "heightCm" | "imageUrls" | "ladders">>,
): AlibabaOffer {
  const next: AlibabaOffer = { ...offer };
  if (isPositive(live.factoryMinCny)) next.factoryMinCny = live.factoryMinCny;
  if (isPositive(live.factoryMaxCny) && live.factoryMaxCny >= next.factoryMinCny) {
    next.factoryMaxCny = live.factoryMaxCny;
  } else if (isPositive(live.factoryMinCny)) {
    next.factoryMaxCny = Math.max(next.factoryMaxCny, live.factoryMinCny);
  }
  if (Number.isInteger(live.minOrder) && (live.minOrder ?? 0) >= 1) {
    next.minOrder = live.minOrder as number;
  }
  if (isPositive(live.weightKg)) next.weightKg = live.weightKg;
  if (isPositive(live.lengthCm)) next.lengthCm = live.lengthCm;
  if (isPositive(live.widthCm)) next.widthCm = live.widthCm;
  if (isPositive(live.heightCm)) next.heightCm = live.heightCm;
  if (live.imageUrls && live.imageUrls.length > 0) next.imageUrls = live.imageUrls;
  if (live.ladders && live.ladders.length > 0) next.ladders = live.ladders;
  return next;
}

function isPositive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
