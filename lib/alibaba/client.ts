/**
 * Optional 1688 Open Platform product fetch.
 * Requires ALIBABA_APP_KEY + ALIBABA_APP_SECRET + ALIBABA_ACCESS_TOKEN.
 * Signature: HMAC-SHA1 over urlPath + sorted key/value concat (1688 gateway).
 */

import { createHmac } from "node:crypto";
import { extractOfferImages } from "@/lib/alibaba/images";
import type { AlibabaOffer } from "@/lib/alibaba/types";

const DEFAULT_GATEWAY = "https://gw.open.1688.com/openapi";
const API_NAMESPACE = "com.alibaba.product";
const API_NAME = "alibaba.agent.product.get";
const API_VERSION = "1";

export type AlibabaClientConfig = {
  appKey: string;
  appSecret: string;
  accessToken: string;
  gateway?: string;
};

export function readAlibabaClientConfig(): AlibabaClientConfig | null {
  const appKey = process.env.ALIBABA_APP_KEY?.trim() ?? "";
  const appSecret = process.env.ALIBABA_APP_SECRET?.trim() ?? "";
  const accessToken = process.env.ALIBABA_ACCESS_TOKEN?.trim() ?? "";
  if (!appKey || !appSecret || !accessToken) return null;
  return {
    appKey,
    appSecret,
    accessToken,
    gateway: process.env.ALIBABA_GATEWAY_URL?.trim() || DEFAULT_GATEWAY,
  };
}

export function sign1688Request(
  urlPath: string,
  params: Record<string, string>,
  appSecret: string,
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  const toSign = `${urlPath}${sorted}`;
  return createHmac("sha1", appSecret).update(toSign, "utf8").digest("hex").toUpperCase();
}

export async function fetch1688Product(
  offerId: string,
  config: AlibabaClientConfig,
): Promise<Partial<AlibabaOffer>> {
  const gateway = (config.gateway || DEFAULT_GATEWAY).replace(/\/+$/, "");
  const urlPath = `param2/${API_VERSION}/${API_NAMESPACE}/${API_NAME}/${config.appKey}`;
  const params: Record<string, string> = {
    access_token: config.accessToken,
    productID: offerId,
    webSite: "1688",
  };
  params.sign = sign1688Request(urlPath, params, config.appSecret);

  const body = new URLSearchParams(params);
  const response = await fetch(`${gateway}/${urlPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(`1688 HTTP ${response.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  assertNoApiError(json);
  return parse1688ProductPayload(json);
}

export function parse1688ProductPayload(raw: unknown): Partial<AlibabaOffer> {
  const product = findProductRecord(raw);
  if (!product) return {};

  const sale = asRecord(product.saleInfo) ?? asRecord(product.sale_info) ?? product;
  const shipping =
    asRecord(product.shippingInfo) ?? asRecord(product.shipping_info) ?? product;

  const ladders = extractLadders(sale);
  const prices = ladders.map((row) => row.priceCny);
  const factoryMinCny = prices.length > 0 ? Math.min(...prices) : numberOrUndef(sale.price);
  const factoryMaxCny = prices.length > 0 ? Math.max(...prices) : factoryMinCny;

  const minOrder = Math.floor(
    Number(
      sale.minOrderQuantity ??
        sale.minOrder ??
        product.minOrderQuantity ??
        product.moq ??
        0,
    ),
  );

  const weightKg = firstPositive(
    shipping.unitWeight,
    shipping.weight,
    product.weight,
  );
  const lengthCm = firstPositive(shipping.length, shipping.packageLength, product.length);
  const widthCm = firstPositive(shipping.width, shipping.packageWidth, product.width);
  const heightCm = firstPositive(shipping.height, shipping.packageHeight, product.height);

  const imageBag =
    product.image ??
    product.productImage ??
    product.images ??
    asRecord(product.image)?.images;

  const imageUrls = extractOfferImages(imageBag ?? product);
  const offerId = String(product.productID ?? product.productId ?? product.offerId ?? "").trim();

  const out: Partial<AlibabaOffer> = {};
  if (offerId) out.offerId = offerId;
  if (factoryMinCny !== undefined) out.factoryMinCny = factoryMinCny;
  if (factoryMaxCny !== undefined) out.factoryMaxCny = factoryMaxCny;
  if (Number.isInteger(minOrder) && minOrder >= 1) out.minOrder = minOrder;
  if (weightKg !== undefined) out.weightKg = weightKg;
  if (lengthCm !== undefined) out.lengthCm = lengthCm;
  if (widthCm !== undefined) out.widthCm = widthCm;
  if (heightCm !== undefined) out.heightCm = heightCm;
  if (imageUrls.length > 0) out.imageUrls = imageUrls;
  if (ladders.length > 0) out.ladders = ladders;
  return out;
}

function extractLadders(
  sale: Record<string, unknown>,
): { minQty: number; priceCny: number }[] {
  const raw =
    sale.priceRanges ??
    sale.priceRangeList ??
    sale.ladderPriceList ??
    sale.ladders ??
    [];
  if (!Array.isArray(raw)) return [];
  const rows: { minQty: number; priceCny: number }[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec) continue;
    const minQty = Math.floor(Number(rec.startQuantity ?? rec.minQty ?? rec.quantity ?? 1));
    const price = rec.price;
    const amount =
      typeof price === "object" && price !== null
        ? Number((price as { amount?: unknown }).amount ?? (price as { price?: unknown }).price)
        : Number(price ?? rec.priceCny ?? rec.amount);
    if (!Number.isInteger(minQty) || minQty < 1) continue;
    if (!Number.isFinite(amount) || amount < 0) continue;
    rows.push({ minQty, priceCny: amount });
  }
  return rows;
}

function findProductRecord(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw);
  if (!root) return null;
  const candidates = [
    root.productInfo,
    root.product,
    asRecord(root.result)?.productInfo,
    asRecord(root.result)?.result,
    asRecord(root.data)?.productInfo,
    asRecord(root.data)?.product,
    asRecord(root.result)?.data,
    root,
  ];
  for (const candidate of candidates) {
    const rec = asRecord(candidate);
    if (!rec) continue;
    if (
      rec.productID !== undefined ||
      rec.productId !== undefined ||
      rec.saleInfo !== undefined ||
      rec.subject !== undefined
    ) {
      return rec;
    }
  }
  return root;
}

function assertNoApiError(raw: unknown): void {
  const rec = asRecord(raw);
  if (!rec) return;
  const err = asRecord(rec.error_message) ?? asRecord(rec.error);
  const msg = String(rec.error_message ?? rec.errorMsg ?? err?.message ?? "").trim();
  const code = rec.error_code ?? rec.errorCode ?? rec.code;
  if (code && String(code) !== "0" && String(code) !== "200") {
    throw new Error(`1688 API error ${String(code)}: ${msg || JSON.stringify(rec).slice(0, 300)}`);
  }
  if (rec.success === false) {
    throw new Error(`1688 API failed: ${msg || JSON.stringify(rec).slice(0, 300)}`);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function numberOrUndef(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function firstPositive(...values: unknown[]): number | undefined {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}
