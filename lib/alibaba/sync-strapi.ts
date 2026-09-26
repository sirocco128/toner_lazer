/**
 * Write computed THB priceMin/priceMax/priceRange into Strapi products.
 * Run via: npm run 1688:sync
 *
 * Does not expose factory CNY on the public Product type.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetch1688Product,
  readAlibabaClientConfig,
} from "@/lib/alibaba/client";
import { computePublicPriceRange, defaultLandedCostConfig } from "@/lib/alibaba/landed-cost";
import { loadOffersFromFile, mergeLiveFactoryPrices } from "@/lib/alibaba/offers";
import type { AlibabaOffer, PublicPriceRange } from "@/lib/alibaba/types";

export type SyncRow = {
  slug: string;
  offerId: string;
  range: PublicPriceRange | null;
  skipped?: string;
  updated?: boolean;
};

function loadCmsEnv(root: string): Record<string, string> {
  const path = join(root, ".env.cms.local");
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]!] = match[2]!.trim();
  }
  return out;
}

function loadDotEnv(root: string): void {
  for (const name of [".env.local", ".env"]) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

async function adminLogin(base: string, email: string, password: string): Promise<string> {
  const response = await fetch(`${base}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = (await response.json()) as { data?: { token?: string; accessToken?: string } };
  if (!response.ok) {
    throw new Error(`Strapi login failed: ${JSON.stringify(json)}`);
  }
  const token = json.data?.token || json.data?.accessToken;
  if (!token) throw new Error("Strapi login returned no token");
  return token;
}

async function ensureWriteToken(base: string, adminToken: string): Promise<string> {
  const existing = process.env.STRAPI_API_TOKEN?.trim();
  if (existing) return existing;
  const response = await fetch(`${base}/admin/api-tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `1688-sync-${Date.now()}`,
      description: "Temporary write token for 1688 price sync",
      type: "full-access",
      lifespan: null,
    }),
  });
  const json = (await response.json()) as { data?: { accessKey?: string } };
  if (!response.ok) {
    throw new Error(`Strapi API token: ${JSON.stringify(json)}`);
  }
  const key = json.data?.accessKey;
  if (!key) throw new Error("Strapi API token missing accessKey");
  return key;
}

async function listProducts(base: string, token: string): Promise<Record<string, unknown>[]> {
  const query = new URLSearchParams({
    "pagination[pageSize]": "100",
    status: "published",
  });
  const response = await fetch(`${base}/api/products?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await response.json()) as { data?: unknown; error?: unknown };
  if (!response.ok) {
    throw new Error(`list products: ${JSON.stringify(json)}`);
  }
  return Array.isArray(json.data) ? (json.data as Record<string, unknown>[]) : [];
}

function productSlug(row: Record<string, unknown>): string {
  const attrs = (row.attributes as Record<string, unknown> | undefined) ?? row;
  return String(attrs.slug ?? "").trim();
}

function productDocumentId(row: Record<string, unknown>): string {
  return String(row.documentId ?? row.id ?? "");
}

async function patchProduct(
  base: string,
  token: string,
  documentId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${base}/api/products/${documentId}?status=published`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`update product ${documentId}: ${JSON.stringify(json)}`);
  }
  await fetch(`${base}/api/products/${documentId}/actions/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
}

export async function run1688StrapiSync(options: {
  root: string;
  dryRun: boolean;
  fetchLive: boolean;
}): Promise<SyncRow[]> {
  loadDotEnv(options.root);
  const cmsEnv = loadCmsEnv(options.root);
  const base = (
    process.env.STRAPI_URL ||
    cmsEnv.STRAPI_URL ||
    "http://127.0.0.1:1337"
  ).replace(/\/+$/, "");
  const email = process.env.CMS_ADMIN_EMAIL || cmsEnv.CMS_ADMIN_EMAIL || "";
  const password = process.env.CMS_ADMIN_PASSWORD || cmsEnv.CMS_ADMIN_PASSWORD || "";

  const offers = loadOffersFromFile();
  if (offers.length === 0) {
    throw new Error(
      `No offers found. Copy data/1688-offers.example.json → data/1688-offers.json (or set ALIBABA_OFFERS_PATH).`,
    );
  }

  const client = options.fetchLive ? readAlibabaClientConfig() : null;
  const config = defaultLandedCostConfig();
  const enriched: AlibabaOffer[] = [];

  for (const offer of offers) {
    if (client) {
      try {
        const live = await fetch1688Product(offer.offerId, client);
        enriched.push(mergeLiveFactoryPrices(offer, live));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[1688] fetch failed for ${offer.offerId}: ${message}`);
        enriched.push(offer);
      }
    } else {
      enriched.push(offer);
    }
  }

  const rows: SyncRow[] = [];
  for (const offer of enriched) {
    const range = computePublicPriceRange(offer, config);
    rows.push({
      slug: offer.slug,
      offerId: offer.offerId,
      range,
      skipped: range ? undefined : "missing weight/dims — cannot bill freight",
    });
  }

  if (options.dryRun) {
    return rows;
  }

  if (!email || !password) {
    throw new Error("CMS_ADMIN_EMAIL / CMS_ADMIN_PASSWORD required to write Strapi");
  }

  const adminToken = await adminLogin(base, email, password);
  const token = await ensureWriteToken(base, adminToken);
  const existing = await listProducts(base, token);
  const bySlug = new Map(existing.map((row) => [productSlug(row), row]));

  for (const row of rows) {
    if (!row.range) continue;
    const found = bySlug.get(row.slug);
    if (!found) {
      row.skipped = `no Strapi product with slug ${row.slug}`;
      continue;
    }
    const documentId = productDocumentId(found);
    const corePrices = {
      priceMin: row.range.priceMin,
      priceMax: row.range.priceMax,
      priceRange: row.range.priceRange,
      minOrder: row.range.minOrder,
      currency: "THB",
    };
    try {
      await patchProduct(base, token, documentId, {
        ...corePrices,
        sourcePlatform: "alibaba1688",
        sourceOfferId: row.offerId,
        priceExFreightMin: row.range.priceExFreightMin,
        priceExFreightMax: row.range.priceExFreightMax,
        packagingMin: row.range.packagingMin,
        packagingMax: row.range.packagingMax,
      });
    } catch {
      await patchProduct(base, token, documentId, corePrices);
    }
    row.updated = true;
  }

  return rows;
}
