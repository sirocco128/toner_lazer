/**
 * Batch landed-cost → public sell ladder from an imported factory workbook.
 * Preview numbers are frozen on the batch so apply writes what the user exported.
 */

import {
  computeQuoteLadder,
  defaultLandedCostConfig,
  DEFAULT_QUOTE_QTYS,
  markupForLandedCost,
  quoteQtyBreaks,
  quoteSellWithOptions,
  type QuoteLadderRow,
} from "@/lib/alibaba/landed-cost";
import type {
  AlibabaOffer,
  FreightCategory,
  FreightMode,
  FreightOrigin,
} from "@/lib/alibaba/types";
import {
  CORPORATE_BREAKS,
  CORPORATE_MARKUP,
  evaluateForcedMinStep,
  type ForcedMinQtyProfile,
} from "@/lib/alibaba/forced-min-qty";
import { getDb } from "@/lib/database";
import {
  COMMERCIAL_SKU_IMPORT_WARNING,
  factoryUnitDims,
  type FactoryWorkbookProduct,
} from "@/lib/factory-workbook";
import { isCommercialProductId } from "@/lib/sku-master-ids";
import { offerCodeToSlug } from "@/lib/smartgift-products";
import {
  applyOfferSellLadder,
  listCatalogOfferHits,
  type CatalogOfferHit,
} from "@/lib/smartgift-price-write";
import { updateOriPackingByCode } from "@/lib/sku-master-repository";
import { actorMay, type OpsActor } from "@/lib/ops-roles";
import {
  DEFAULT_PACKAGING_MAX_THB,
  DEFAULT_PACKAGING_MIN_THB,
} from "@/lib/product-price-options";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";
import { formatFormulaCheckNote } from "@/lib/price-formula-note";
import { getProducts } from "@/lib/strapi";

export const SALES_QTY_LADDER = DEFAULT_QUOTE_QTYS;

const ORIGINS: FreightOrigin[] = ["guangzhou_shenzhen", "yiwu"];
const MODES: FreightMode[] = ["truck", "sea"];
const CATEGORIES: FreightCategory[] = ["general", "electronic_tisi"];

export type PriceBatchConfig = {
  name?: string;
  cnyToThb: number;
  month: number;
  origin: FreightOrigin;
  forceMode?: FreightMode;
  category: FreightCategory;
  includeFreight: boolean;
  includePackaging: boolean;
  profile: ForcedMinQtyProfile;
  minOrder: number;
  bulkQty: number;
};

export type PriceBatchTier = {
  qty: number;
  sellThb: number;
  formulaNote?: string;
};

export type PriceBatchRowCost = {
  factoryCny: number;
  landedCostThb: number;
  freightThb: number;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
};

export type PriceBatchPreviewRow = {
  code: string;
  name: string;
  match: "matched" | "unmatched" | "skip";
  offerCode?: string;
  slug?: string;
  currentMin?: number | null;
  currentMax?: number | null;
  priceMin: number | null;
  priceMax: number | null;
  tiers: PriceBatchTier[];
  warning?: string;
  selected: boolean;
  cost?: PriceBatchRowCost;
  formulaNote?: string;
};

export type PriceConfigRecord = {
  id: number;
  name: string;
  isDefault: boolean;
  config: PriceBatchConfig;
  updatedAt: string;
};

export type PriceBatchSummary = {
  id: number;
  fileName: string | null;
  status: string;
  rowCount: number;
  matchedCount: number;
  createdAt: string;
  appliedAt: string | null;
};

export function defaultPriceBatchConfig(
  overrides: Partial<PriceBatchConfig> = {},
): PriceBatchConfig {
  const fx = defaultLandedCostConfig().cnyToThb;
  return {
    cnyToThb: fx,
    month: new Date().getMonth() + 1,
    origin: "guangzhou_shenzhen",
    category: "general",
    includeFreight: true,
    includePackaging: false,
    profile: "standard",
    minOrder: 10,
    bulkQty: 300,
    ...overrides,
  };
}

export function parsePriceBatchConfig(raw: unknown): PriceBatchConfig {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const origin = ORIGINS.includes(row.origin as FreightOrigin)
    ? (row.origin as FreightOrigin)
    : "guangzhou_shenzhen";
  const forceMode = MODES.includes(row.forceMode as FreightMode)
    ? (row.forceMode as FreightMode)
    : undefined;
  const category = CATEGORIES.includes(row.category as FreightCategory)
    ? (row.category as FreightCategory)
    : "general";
  const cny = Number(row.cnyToThb);
  const month = Math.round(Number(row.month));
  const minOrder = Math.round(Number(row.minOrder));
  const bulkQty = Math.round(Number(row.bulkQty));
  return defaultPriceBatchConfig({
    cnyToThb: Number.isFinite(cny) && cny > 0 ? cny : undefined,
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : undefined,
    origin,
    forceMode,
    category,
    includeFreight: row.includeFreight !== false && row.includeFreight !== "false",
    includePackaging:
      row.includePackaging === true || row.includePackaging === "true",
    profile: row.profile === "corporate" ? "corporate" : "standard",
    minOrder:
      Number.isInteger(minOrder) && minOrder > 0 ? minOrder : undefined,
    bulkQty: Number.isInteger(bulkQty) && bulkQty > 0 ? bulkQty : undefined,
  });
}

export function parseFactoryProducts(raw: unknown): FactoryWorkbookProduct[] {
  if (!Array.isArray(raw)) return [];
  const out: FactoryWorkbookProduct[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const code = String(row.code || "").trim();
    if (!code) continue;
    out.push({
      code,
      name: String(row.name || "").trim(),
      rmb: asPos(row.rmb),
      usd: asPos(row.usd),
      upc: asPos(row.upc),
      lengthCm: asPos(row.lengthCm),
      widthCm: asPos(row.widthCm),
      heightCm: asPos(row.heightCm),
      cartonKg: asPos(row.cartonKg),
      dimsAreCarton: row.dimsAreCarton !== false,
      row: Math.round(Number(row.row) || out.length + 1),
    });
  }
  return out.slice(0, 2000);
}

function asPos(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function codeKey(value: string): string {
  return normalizeCode(value).replace(/\(.*\)$/, "");
}

export function matchCatalogHit(
  product: FactoryWorkbookProduct,
  index: CatalogIndex,
): CatalogOfferHit | null {
  const raw = normalizeCode(product.code);
  const key = codeKey(product.code);
  const slug = offerCodeToSlug(product.code);
  return (
    index.byCode.get(raw) ||
    index.byCode.get(key) ||
    index.bySlug.get(slug) ||
    index.bySlug.get(product.code.trim().toLowerCase()) ||
    null
  );
}

export type CatalogIndex = {
  byCode: Map<string, CatalogOfferHit>;
  bySlug: Map<string, CatalogOfferHit>;
};

export function catalogIndexFromHits(hits: CatalogOfferHit[]): CatalogIndex {
  const byCode = new Map<string, CatalogOfferHit>();
  const bySlug = new Map<string, CatalogOfferHit>();
  for (const hit of hits) {
    byCode.set(normalizeCode(hit.offerCode), hit);
    byCode.set(codeKey(hit.offerCode), hit);
    bySlug.set(hit.slug.toLowerCase(), hit);
    bySlug.set(offerCodeToSlug(hit.offerCode), hit);
  }
  return { byCode, bySlug };
}

async function loadCatalogIndex(): Promise<CatalogIndex> {
  const mysqlHits = await listCatalogOfferHits().catch(
    () => [] as CatalogOfferHit[],
  );
  if (mysqlHits.length > 0) return catalogIndexFromHits(mysqlHits);
  const products = await getProducts();
  return catalogIndexFromHits(
    products.map((product) => ({
      offerCode: product.slug.toUpperCase(),
      slug: product.slug,
      name: product.name,
      supplierCode: "",
      categorySlug: product.categorySlug,
      giftTier: null,
      priceMin: product.priceMin || null,
      priceMax: product.priceMax || null,
      minOrder: product.minOrder,
      hasPrice: product.priceMin > 0,
    })),
  );
}

function productToOffer(
  product: FactoryWorkbookProduct,
  config: PriceBatchConfig,
): { offer: AlibabaOffer; dims: ReturnType<typeof factoryUnitDims> } | null {
  if (!product.rmb || product.rmb <= 0) return null;
  const dims = factoryUnitDims(product);
  if (!dims.weightKg && !(dims.lengthCm && dims.widthCm && dims.heightCm)) {
    return null;
  }
  const offer: AlibabaOffer = {
    slug: offerCodeToSlug(product.code),
    offerId: product.code,
    origin: config.origin,
    category: config.category,
    minOrder: config.minOrder,
    factoryMinCny: product.rmb,
    factoryMaxCny: product.rmb,
    bulkQty: config.bulkQty,
    ...dims,
  };
  return { offer, dims };
}

export function computePriceBatchRows(
  products: FactoryWorkbookProduct[],
  config: PriceBatchConfig,
  catalog: CatalogIndex,
  canSeeCost: boolean,
): PriceBatchPreviewRow[] {
  const fxConfig = defaultLandedCostConfig({
    cnyToThb: config.cnyToThb,
    month: config.month,
    ...(config.forceMode ? { forceMode: config.forceMode } : {}),
  });
  const flags = {
    includeFreight: config.includeFreight,
    includePackaging: config.includePackaging,
  };
  const pack = {
    min: DEFAULT_PACKAGING_MIN_THB,
    max: DEFAULT_PACKAGING_MAX_THB,
  };
  const ladder =
    config.profile === "corporate" ? CORPORATE_BREAKS : SALES_QTY_LADDER;

  return products.map((product) => {
    if (isCommercialProductId(product.code)) {
      return {
        code: product.code,
        name: product.name || product.code,
        match: "skip" as const,
        priceMin: null,
        priceMax: null,
        tiers: [],
        warning: COMMERCIAL_SKU_IMPORT_WARNING,
        selected: false,
      };
    }
    const hit = matchCatalogHit(product, catalog);
    const mapped = productToOffer(product, config);
    if (!mapped) {
      return {
        code: product.code,
        name: product.name || hit?.name || product.code,
        match: "skip" as const,
        offerCode: hit?.offerCode,
        slug: hit?.slug,
        currentMin: hit?.priceMin ?? null,
        currentMax: hit?.priceMax ?? null,
        priceMin: null,
        priceMax: null,
        tiers: [],
        warning: !product.rmb
          ? "ไม่มีราคาโรงงาน RMB"
          : "ไม่มีน้ำหนักหรือขนาดกล่อง — คิดค่าขนส่งไม่ได้",
        selected: false,
        ...(canSeeCost && product.rmb
          ? { cost: { factoryCny: product.rmb, landedCostThb: 0, freightThb: 0 } }
          : {}),
      };
    }

    const qtys = quoteQtyBreaks(config.minOrder, [], ladder);
    const computed = computeQuoteLadder(mapped.offer, qtys, fxConfig);
    if (!computed) {
      return {
        code: product.code,
        name: product.name || hit?.name || product.code,
        match: hit ? "matched" : "unmatched",
        offerCode: hit?.offerCode,
        slug: hit?.slug,
        currentMin: hit?.priceMin ?? null,
        currentMax: hit?.priceMax ?? null,
        priceMin: null,
        priceMax: null,
        tiers: [],
        warning: "คิดต้นทุนลงไม่ได้จากข้อมูลกล่อง",
        selected: false,
      };
    }

    const tiers: PriceBatchTier[] = computed.map((row) => {
      const priced =
        config.profile === "corporate"
          ? {
              sellThb: Math.round(
                row.landed.landedCostThb * row.landed.sof * CORPORATE_MARKUP,
              ),
              sellExFreightThb: Math.round(
                (row.landed.factoryThb + row.landed.inlandThb) *
                  row.landed.sof *
                  CORPORATE_MARKUP,
              ),
            }
          : row.landed;
      const sell = quoteSellWithOptions(priced, flags, pack);
      const tier: PriceBatchTier = { qty: row.qty, sellThb: sell.sellThb };
      if (canSeeCost) {
        tier.formulaNote = formulaNoteForLadderRow(
          row,
          sell.sellThb,
          config,
          pack.min,
        );
      }
      return tier;
    });
    const sells = tiers.map((t) => t.sellThb);
    const bulk =
      tiers.find((t) => t.qty >= config.bulkQty)?.sellThb ??
      sells[sells.length - 1]!;
    const moq = sells[0]!;
    const priceMin = Math.min(bulk, moq);
    const priceMax = Math.max(bulk, moq);
    const last = computed[computed.length - 1]!;

    const row: PriceBatchPreviewRow = {
      code: product.code,
      name: product.name || hit?.name || product.code,
      match: hit ? "matched" : "unmatched",
      offerCode: hit?.offerCode,
      slug: hit?.slug,
      currentMin: hit?.priceMin ?? null,
      currentMax: hit?.priceMax ?? null,
      priceMin,
      priceMax,
      tiers,
      warning: hit ? undefined : "ยังไม่พบรหัสนี้ในแคตตาล็อกเว็บ — ส่งอัปเดตไม่ได้",
      selected: Boolean(hit),
    };
    if (canSeeCost) {
      row.cost = {
        factoryCny: last.factoryCny,
        landedCostThb: Math.round(last.landed.landedCostThb * 100) / 100,
        freightThb: Math.round(last.landed.freightThb * 100) / 100,
        ...mapped.dims,
      };
      const moqNote = tiers[0]?.formulaNote;
      const bulkTier =
        tiers.find((t) => t.qty >= config.bulkQty) ?? tiers[tiers.length - 1];
      const bulkNote =
        bulkTier && bulkTier.qty !== tiers[0]?.qty ? bulkTier.formulaNote : undefined;
      row.formulaNote = [moqNote, bulkNote].filter(Boolean).join("\n");
    }
    return row;
  });
}

export function stripCostFromRows(
  rows: PriceBatchPreviewRow[],
  canSeeCost: boolean,
): PriceBatchPreviewRow[] {
  if (canSeeCost) return rows;
  return rows.map(({ cost: _cost, formulaNote: _note, ...rest }) => ({
    ...rest,
    tiers: rest.tiers.map(({ formulaNote: _tierNote, ...tier }) => tier),
  }));
}

function formulaNoteForLadderRow(
  row: QuoteLadderRow,
  sellThb: number,
  config: PriceBatchConfig,
  packagingThb: number,
): string {
  const goodsThb = row.landed.factoryThb + row.landed.inlandThb;
  const markup =
    config.profile === "corporate"
      ? CORPORATE_MARKUP
      : config.includeFreight
        ? row.landed.markup
        : markupForLandedCost(goodsThb);
  const floor = evaluateForcedMinStep(
    row.landed.landedCostThb,
    row.qty,
    config.profile,
  );
  return formatFormulaCheckNote({
    qty: row.qty,
    factoryCny: row.factoryCny,
    fx: config.cnyToThb,
    factoryThb: row.landed.factoryThb,
    inlandThb: row.landed.inlandThb,
    freightThb: row.landed.freightThb,
    landedCostThb: row.landed.landedCostThb,
    sof: row.landed.sof,
    markup,
    sellThb,
    includeFreight: config.includeFreight,
    includePackaging: config.includePackaging,
    packagingThb: config.includePackaging ? packagingThb : 0,
    mode: row.landed.mode,
    tier: row.landed.tier,
    gpThb: Math.round((sellThb - row.landed.landedCostThb) * row.qty),
    meetsFloor: floor.meetsFloor,
    floorThb: floor.floor,
    profile: config.profile,
  });
}

export async function buildPriceBatchPreview(
  actor: OpsActor,
  products: FactoryWorkbookProduct[],
  config: PriceBatchConfig,
): Promise<PriceBatchPreviewRow[]> {
  const catalog = await loadCatalogIndex();
  return computePriceBatchRows(
    products,
    config,
    catalog,
    actorMay(actor, "factory.read"),
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

export function listPriceConfigs(): PriceConfigRecord[] {
  try {
    const rows = getDb()
    .prepare(
      `SELECT id, name, is_default, payload_json, updated_at
       FROM ops_price_configs
       ORDER BY is_default DESC, updated_at DESC
       LIMIT 40`,
    )
    .all() as Array<{
    id: number;
    name: string;
    is_default: number;
    payload_json: string;
    updated_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isDefault: row.is_default === 1,
    config: parsePriceBatchConfig(JSON.parse(row.payload_json)),
    updatedAt: row.updated_at,
  }));
  } catch {
    return [];
  }
}

export function savePriceConfig(
  name: string,
  config: PriceBatchConfig,
  actor: OpsActor,
  asDefault = false,
): PriceConfigRecord {
  const trimmed = name.trim().slice(0, 80) || "ชุดเงื่อนไข";
  const db = getDb();
  if (asDefault) {
    db.prepare("UPDATE ops_price_configs SET is_default = 0").run();
  }
  const payload = JSON.stringify(config);
  const at = nowIso();
  const existing = db
    .prepare("SELECT id FROM ops_price_configs WHERE name = ?")
    .get(trimmed) as { id: number } | undefined;
  let id: number;
  if (existing) {
    db.prepare(
      `UPDATE ops_price_configs
       SET payload_json = ?, is_default = ?, updated_at = ?, created_by = ?
       WHERE id = ?`,
    ).run(payload, asDefault ? 1 : 0, at, actor.email, existing.id);
    id = existing.id;
  } else {
    const result = db
      .prepare(
        `INSERT INTO ops_price_configs
           (name, is_default, payload_json, created_at, updated_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(trimmed, asDefault ? 1 : 0, payload, at, at, actor.email);
    id = Number(result.lastInsertRowid);
  }
  return {
    id,
    name: trimmed,
    isDefault: asDefault,
    config,
    updatedAt: at,
  };
}

export function deletePriceConfig(id: number): void {
  getDb().prepare("DELETE FROM ops_price_configs WHERE id = ?").run(id);
}

export function savePriceBatch(params: {
  actor: OpsActor;
  fileName: string;
  config: PriceBatchConfig;
  configId?: number;
  products: FactoryWorkbookProduct[];
  rows: PriceBatchPreviewRow[];
}): PriceBatchSummary {
  const matchedCount = params.rows.filter((row) => row.match === "matched").length;
  const payload = JSON.stringify({
    config: params.config,
    products: params.products,
    rows: params.rows,
  });
  const at = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO ops_price_batches
         (config_id, file_name, status, row_count, matched_count,
          payload_json, created_at, created_by)
       VALUES (?, ?, 'preview', ?, ?, ?, ?, ?)`,
    )
    .run(
      params.configId ?? null,
      params.fileName.slice(0, 180),
      params.rows.length,
      matchedCount,
      payload,
      at,
      params.actor.email,
    );
  return {
    id: Number(result.lastInsertRowid),
    fileName: params.fileName,
    status: "preview",
    rowCount: params.rows.length,
    matchedCount,
    createdAt: at,
    appliedAt: null,
  };
}

type StoredBatch = {
  id: number;
  status: string;
  payload: {
    config: PriceBatchConfig;
    products: FactoryWorkbookProduct[];
    rows: PriceBatchPreviewRow[];
  };
};

function loadStoredBatch(id: number): StoredBatch | null {
  const row = getDb()
    .prepare(
      `SELECT id, status, payload_json FROM ops_price_batches WHERE id = ?`,
    )
    .get(id) as { id: number; status: string; payload_json: string } | undefined;
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.payload_json) as StoredBatch["payload"];
    return { id: row.id, status: row.status, payload: parsed };
  } catch {
    return null;
  }
}

export function getPriceBatchForActor(
  id: number,
  actor: OpsActor,
): {
  summary: PriceBatchSummary;
  config: PriceBatchConfig;
  rows: PriceBatchPreviewRow[];
} | null {
  const row = getDb()
    .prepare(
      `SELECT id, file_name, status, row_count, matched_count,
              created_at, applied_at, payload_json
       FROM ops_price_batches WHERE id = ?`,
    )
    .get(id) as
    | {
        id: number;
        file_name: string | null;
        status: string;
        row_count: number;
        matched_count: number;
        created_at: string;
        applied_at: string | null;
        payload_json: string;
      }
    | undefined;
  if (!row) return null;
  const payload = JSON.parse(row.payload_json) as StoredBatch["payload"];
  return {
    summary: {
      id: row.id,
      fileName: row.file_name,
      status: row.status,
      rowCount: row.row_count,
      matchedCount: row.matched_count,
      createdAt: row.created_at,
      appliedAt: row.applied_at,
    },
    config: parsePriceBatchConfig(payload.config),
    rows: stripCostFromRows(
      payload.rows || [],
      actorMay(actor, "factory.read"),
    ),
  };
}

export async function applyPriceBatch(params: {
  actor: OpsActor;
  batchId: number;
  codes: string[];
}): Promise<{ updated: number; skipped: number }> {
  if (!isSmartgiftMysqlEnabled()) {
    throw new Error("ยังไม่ได้เปิด SMARTGIFT_MYSQL_ENABLED — ส่งราคาขึ้นเว็บไม่ได้");
  }
  const stored = loadStoredBatch(params.batchId);
  if (!stored) throw new Error("ไม่พบชุดพรีวิวนี้");
  if (stored.status === "applied") {
    throw new Error("ชุดนี้ส่งอัปเดตไปแล้ว");
  }
  const wanted = new Set(params.codes.map((c) => normalizeCode(c)));
  const catalog = await loadCatalogIndex();
  const productsByCode = new Map(
    (stored.payload.products || []).map((product) => [
      normalizeCode(product.code),
      product,
    ]),
  );
  let updated = 0;
  let skipped = 0;
  for (const row of stored.payload.rows) {
    if (!wanted.has(normalizeCode(row.code))) continue;
    if (row.match !== "matched" || !row.priceMin || !row.priceMax || !row.tiers.length) {
      skipped += 1;
      continue;
    }
    const hit =
      (row.offerCode
        ? catalog.byCode.get(normalizeCode(row.offerCode))
        : undefined) ||
      catalog.byCode.get(normalizeCode(row.code)) ||
      catalog.byCode.get(codeKey(row.code));
    if (!hit) {
      skipped += 1;
      continue;
    }
    await applyOfferSellLadder({
      hit,
      priceMin: row.priceMin,
      priceMax: row.priceMax,
      tiers: row.tiers.map((tier) => ({
        qty: tier.qty,
        unitPrice: tier.sellThb,
      })),
    });
    const factory = productsByCode.get(normalizeCode(row.code));
    if (factory) {
      await updateOriPackingByCode({
        oriProductCode: factory.code,
        pcsPerCtn: factory.upc,
        lengthCm: factory.lengthCm,
        widthCm: factory.widthCm,
        heightCm: factory.heightCm,
        cartonKg: factory.cartonKg,
        dimsAreCarton: factory.dimsAreCarton,
      }).catch(() => false);
    }
    updated += 1;
  }
  if (updated > 0) {
    getDb()
      .prepare(
        `UPDATE ops_price_batches
         SET status = 'applied', applied_at = ?, applied_by = ?
         WHERE id = ?`,
      )
      .run(nowIso(), params.actor.email, params.batchId);
  }
  return { updated, skipped };
}

export function previewRowsToCsv(
  rows: PriceBatchPreviewRow[],
  canSeeCost: boolean,
): string {
  const headers = [
    "code",
    "name",
    "match",
    "offer_code",
    "slug",
    "current_min",
    "current_max",
    "price_min",
    "price_max",
    ...SALES_QTY_LADDER.map((qty) => `qty_${qty}`),
  ];
  if (canSeeCost) headers.push("factory_cny", "landed_thb", "formula_check");
  const lines = [headers.join(",")];
  for (const row of rows) {
    const byQty = new Map(row.tiers.map((t) => [t.qty, t.sellThb]));
    const cols = [
      csvCell(row.code),
      csvCell(row.name),
      row.match,
      csvCell(row.offerCode || ""),
      csvCell(row.slug || ""),
      row.currentMin ?? "",
      row.currentMax ?? "",
      row.priceMin ?? "",
      row.priceMax ?? "",
      ...SALES_QTY_LADDER.map((qty) => byQty.get(qty) ?? ""),
    ];
    if (canSeeCost) {
      cols.push(
        row.cost?.factoryCny ?? "",
        row.cost?.landedCostThb ?? "",
        csvCell((row.formulaNote || "").replace(/\n/g, " | ")),
      );
    }
    lines.push(cols.join(","));
  }
  return lines.join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
