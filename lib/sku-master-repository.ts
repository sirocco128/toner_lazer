import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { SMARTGIFT_FX_CNY_THB } from "@/lib/alibaba/rates";
import {
  computeForcedMinQty,
  unitLandedFromFactory,
  type ForcedMinQtyProfile,
} from "@/lib/alibaba/forced-min-qty";
import { normalizeOpsTags } from "@/lib/ops-tags";
import { isUsableImageSrc, skuOpsImageSrc } from "@/lib/product-media";
import {
  canMoveToClearance,
  formatProductId,
  isSellableBundleClass,
  isStockClass,
  normalizeOriCode,
  parseProductId,
  uniqueProductIdsInOrder,
} from "@/lib/sku-master-ids";
import { ensureSkuMasterSchema, skuMasterTablesReady } from "@/lib/sku-master-schema";
import type {
  BasicColor,
  BundleComponentOption,
  OriListFilter,
  OriProduct,
  SkuBundleItem,
  SkuGroup,
  SkuListFilter,
  SkuMove,
  SkuRecord,
  SkuSerial,
  StockClass,
} from "@/lib/sku-master-types";
import {
  smartgiftExec,
  smartgiftQuery,
  withSmartgiftTransaction,
} from "@/lib/smartgift-mysql";

type SkuRow = RowDataPacket & {
  product_id: string;
  stock_class: string;
  running_no: number;
  ori_product_id: number | null;
  ori_product_code: string | null;
  ori_product_name_th: string | null;
  color_name_th: string | null;
  name_th: string;
  name_en: string | null;
  sell_price_thb: number | string | null;
  is_bundle: number;
  clearance_reason: string | null;
  catalog_slug: string | null;
  image_url: string | null;
  offer_image_url: string | null;
  factory_unit_cny: number | string | null;
  factory_unit_usd: number | string | null;
  unit_landed_cost_thb: number | string | null;
  forced_min_qty: number | null;
  pcs_per_ctn: number | string | null;
  length_cm: number | string | null;
  width_cm: number | string | null;
  height_cm: number | string | null;
  carton_kg: number | string | null;
  dims_are_carton: number | null;
  on_hand_qty: number;
  tags: string | null;
};

function money(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function packingFields(row: Record<string, unknown>) {
  const pcs = money(row.pcs_per_ctn as number | string | null | undefined);
  return {
    pcsPerCtn: pcs != null && pcs > 0 ? Math.round(pcs) : null,
    lengthCm: money(row.length_cm as number | string | null | undefined),
    widthCm: money(row.width_cm as number | string | null | undefined),
    heightCm: money(row.height_cm as number | string | null | undefined),
    cartonKg: money(row.carton_kg as number | string | null | undefined),
    dimsAreCarton:
      row.dims_are_carton == null
        ? true
        : Number(row.dims_are_carton) !== 0,
  };
}

function mapSku(row: SkuRow): SkuRecord {
  const stockClass = isStockClass(row.stock_class) ? row.stock_class : "B";
  const packing = packingFields(row);
  return {
    productId: row.product_id,
    stockClass,
    runningNo: Number(row.running_no),
    oriProductId: row.ori_product_id,
    oriProductCode: row.ori_product_code,
    oriProductNameTh: row.ori_product_name_th,
    colorNameTh: row.color_name_th,
    nameTh: row.name_th,
    nameEn: row.name_en,
    sellPriceThb: money(row.sell_price_thb),
    isBundle: Number(row.is_bundle) === 1,
    clearanceReason: row.clearance_reason,
    catalogSlug: row.catalog_slug,
    imageUrl: row.image_url ? String(row.image_url) : null,
    displayImageUrl: skuOpsImageSrc(row.image_url, row.offer_image_url),
    factoryUnitCny: money(row.factory_unit_cny),
    factoryUnitUsd: money(row.factory_unit_usd),
    unitLandedCostThb: money(row.unit_landed_cost_thb),
    forcedMinQty: row.forced_min_qty == null ? null : Number(row.forced_min_qty),
    ...packing,
    onHandQty: Number(row.on_hand_qty || 0),
    tags: row.tags
      ? row.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  };
}

const SKU_SELECT = `
  SELECT s.product_id, s.stock_class, s.running_no, s.ori_product_id,
         o.ori_product_code, o.ori_product_name_th, c.name_th AS color_name_th,
         s.name_th, s.name_en, s.sell_price_thb, s.is_bundle, s.clearance_reason,
         s.catalog_slug, s.image_url, s.factory_unit_cny, s.factory_unit_usd,
         s.unit_landed_cost_thb, s.forced_min_qty, s.on_hand_qty,
         o.pcs_per_ctn, o.length_cm, o.width_cm, o.height_cm, o.carton_kg,
         o.dims_are_carton,
         MAX(NULLIF(off.image_url, '')) AS offer_image_url,
         GROUP_CONCAT(DISTINCT t.tag ORDER BY t.tag SEPARATOR ',') AS tags
  FROM sg_sku s
  LEFT JOIN sg_ori_products o ON o.ori_product_id = s.ori_product_id
  LEFT JOIN master_basic_colors c ON c.id = o.color_id
  LEFT JOIN sg_sku_tag t ON t.product_id = s.product_id
  LEFT JOIN sg_offer off
    ON off.image_url IS NOT NULL AND off.image_url <> ''
   AND (
     (s.catalog_slug IS NOT NULL AND s.catalog_slug <> ''
       AND (off.source_slug = s.catalog_slug OR off.offer_code = s.catalog_slug))
     OR (o.ori_product_code IS NOT NULL
       AND (off.offer_code = o.ori_product_code OR off.source_slug = o.ori_product_code))
   )
`;

export async function listColors(): Promise<BasicColor[]> {
  await ensureSkuMasterSchema();
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT id, code, name_th, name_en, hex, sort_order
     FROM master_basic_colors ORDER BY sort_order ASC, name_th ASC`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    code: String(row.code),
    nameTh: String(row.name_th),
    nameEn: row.name_en ? String(row.name_en) : null,
    hex: row.hex ? String(row.hex) : null,
    sortOrder: Number(row.sort_order || 0),
  }));
}

export async function createColor(input: {
  code: string;
  nameTh: string;
  nameEn?: string;
  hex?: string;
}): Promise<BasicColor> {
  await ensureSkuMasterSchema();
  const code = String(input.code || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const nameTh = String(input.nameTh || "").trim();
  if (!code || !nameTh) throw new Error("invalid_color");
  const result = await smartgiftExec(
    `INSERT INTO master_basic_colors (code, name_th, name_en, hex, sort_order)
     VALUES (:code, :name_th, :name_en, :hex, 200)`,
    {
      code,
      name_th: nameTh,
      name_en: input.nameEn?.trim() || null,
      hex: input.hex?.trim() || null,
    },
  );
  const colors = await listColors();
  const created = colors.find((item) => item.id === Number(result.insertId));
  if (!created) throw new Error("color_not_created");
  return created;
}

function mapOri(row: RowDataPacket): OriProduct {
  const packing = packingFields(row);
  return {
    oriProductId: Number(row.ori_product_id),
    oriProductCode: String(row.ori_product_code),
    oriProductNameTh: String(row.ori_product_name_th),
    oriProductNameEng: row.ori_product_name_eng ? String(row.ori_product_name_eng) : null,
    colorId: row.color_id == null ? null : Number(row.color_id),
    colorNameTh: row.color_name_th ? String(row.color_name_th) : null,
    colorHex: row.color_hex ? String(row.color_hex) : null,
    notes: row.notes ? String(row.notes) : null,
    factoryId: row.factory_id == null ? null : Number(row.factory_id),
    ...packing,
    skuIds: row.sku_ids
      ? String(row.sku_ids)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined,
    displayImageUrl: skuOpsImageSrc(row.offer_image_url),
  };
}

const ORI_SELECT = `
  SELECT o.ori_product_id, o.ori_product_code, o.ori_product_name_th,
         o.ori_product_name_eng, o.color_id, c.name_th AS color_name_th,
         c.hex AS color_hex, o.notes, o.factory_id,
         o.pcs_per_ctn, o.length_cm, o.width_cm, o.height_cm, o.carton_kg,
         o.dims_are_carton,
         (SELECT off.image_url FROM sg_offer off
           WHERE off.image_url IS NOT NULL AND off.image_url <> ''
             AND (off.offer_code = o.ori_product_code OR off.source_slug = o.ori_product_code)
           LIMIT 1) AS offer_image_url,
         GROUP_CONCAT(DISTINCT s.product_id ORDER BY s.product_id SEPARATOR ',') AS sku_ids
  FROM sg_ori_products o
  LEFT JOIN master_basic_colors c ON c.id = o.color_id
  LEFT JOIN sg_sku s ON s.ori_product_id = o.ori_product_id
`;

function oriFilterWhere(filter: OriListFilter = {}): {
  where: string;
  params: Record<string, string>;
} {
  const q = String(filter.q || "").trim();
  if (!q) return { where: "", params: {} };
  const like = `%${q}%`;
  return {
    where: `WHERE (
      o.ori_product_code LIKE :q
      OR o.ori_product_name_th LIKE :q
      OR o.ori_product_name_eng LIKE :q
      OR EXISTS (
        SELECT 1 FROM sg_sku sx
        WHERE sx.ori_product_id = o.ori_product_id AND sx.product_id LIKE :q
      )
    )`,
    params: { q: like },
  };
}

export async function listOriProductsByFactoryId(factoryId: number): Promise<OriProduct[]> {
  await ensureSkuMasterSchema();
  if (!Number.isInteger(factoryId) || factoryId < 1) return [];
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `${ORI_SELECT}
     WHERE o.factory_id = :id
     GROUP BY o.ori_product_id
     ORDER BY o.ori_product_code ASC
     LIMIT 400`,
    { id: factoryId },
  );
  return rows.map(mapOri);
}

export async function countOriProducts(filter: OriListFilter = {}): Promise<number> {
  await ensureSkuMasterSchema();
  const { where, params } = oriFilterWhere(filter);
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM sg_ori_products o ${where}`,
    params,
  );
  return Number(rows[0]?.n || 0);
}

export async function listOriProducts(filter: OriListFilter = {}): Promise<OriProduct[]> {
  await ensureSkuMasterSchema();
  const { where, params } = oriFilterWhere(filter);
  const limit = Math.min(Math.max(filter.limit ?? 400, 1), 2000);
  const offset = Math.max(0, Math.floor(filter.offset ?? 0));
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `${ORI_SELECT}
     ${where}
     GROUP BY o.ori_product_id
     ORDER BY o.ori_product_code ASC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return rows.map(mapOri);
}

export async function getOriProduct(oriProductId: number): Promise<OriProduct | null> {
  await ensureSkuMasterSchema();
  const id = Number(oriProductId);
  if (!Number.isInteger(id) || id < 1) return null;
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `${ORI_SELECT} WHERE o.ori_product_id = :id GROUP BY o.ori_product_id LIMIT 1`,
    { id },
  );
  return rows[0] ? mapOri(rows[0]) : null;
}

export async function listSkusForOri(oriProductId: number): Promise<SkuRecord[]> {
  await ensureSkuMasterSchema();
  const rows = await smartgiftQuery<SkuRow[]>(
    `${SKU_SELECT} WHERE s.ori_product_id = :id GROUP BY s.product_id
     ORDER BY s.stock_class ASC, s.running_no ASC`,
    { id: oriProductId },
  );
  return rows.map(mapSku);
}

async function allocateProductId(
  conn: PoolConnection,
  stockClass: StockClass,
): Promise<{ productId: string; runningNo: number }> {
  const [seqRows] = await conn.query<RowDataPacket[]>(
    `SELECT last_no FROM sg_sku_seq WHERE stock_class = ? FOR UPDATE`,
    [stockClass],
  );
  let lastNo = Number(seqRows[0]?.last_no ?? 0);
  if (!seqRows[0]) {
    await conn.query(
      `INSERT INTO sg_sku_seq (stock_class, last_no) VALUES (?, 0)`,
      [stockClass],
    );
    lastNo = 0;
  }
  const runningNo = lastNo + 1;
  await conn.query(`UPDATE sg_sku_seq SET last_no = ? WHERE stock_class = ?`, [
    runningNo,
    stockClass,
  ]);
  return { productId: formatProductId(stockClass, runningNo), runningNo };
}

async function insertSku(
  conn: PoolConnection,
  input: {
    stockClass: StockClass;
    oriProductId: number | null;
    nameTh: string;
    nameEn?: string | null;
    isBundle?: boolean;
    sellPriceThb?: number | null;
  },
): Promise<string> {
  const { productId, runningNo } = await allocateProductId(conn, input.stockClass);
  await conn.query(
    `INSERT INTO sg_sku (
       product_id, stock_class, running_no, ori_product_id, name_th, name_en,
       sell_price_thb, is_bundle
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      input.stockClass,
      runningNo,
      input.oriProductId,
      input.nameTh,
      input.nameEn ?? null,
      input.sellPriceThb ?? null,
      input.isBundle ? 1 : 0,
    ],
  );
  return productId;
}

export async function createOriWithSkus(input: {
  oriProductCode: string;
  oriProductNameTh: string;
  oriProductNameEng?: string;
  colorId?: number | null;
  notes?: string;
  factoryId?: number | null;
  createA?: boolean;
  createB?: boolean;
}): Promise<{ ori: OriProduct; productIds: string[] }> {
  await ensureSkuMasterSchema();
  const code = normalizeOriCode(input.oriProductCode);
  const nameTh = String(input.oriProductNameTh || "").trim();
  if (!code || !nameTh) throw new Error("invalid_ori");
  const createA = input.createA !== false;
  const createB = input.createB !== false;

  const { productIds, oriProductId } = await withSmartgiftTransaction(async (conn) => {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO sg_ori_products (
         ori_product_code, ori_product_name_th, ori_product_name_eng, color_id, notes, factory_id
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        code,
        nameTh,
        input.oriProductNameEng?.trim() || null,
        input.colorId || null,
        input.notes?.trim() || null,
        input.factoryId || null,
      ],
    );
    const oriProductId = Number(result.insertId);
    const ids: string[] = [];
    if (createA) {
      ids.push(
        await insertSku(conn, {
          stockClass: "A",
          oriProductId,
          nameTh,
          nameEn: input.oriProductNameEng?.trim() || null,
        }),
      );
    }
    if (createB) {
      ids.push(
        await insertSku(conn, {
          stockClass: "B",
          oriProductId,
          nameTh,
          nameEn: input.oriProductNameEng?.trim() || null,
        }),
      );
    }
    return { productIds: ids, oriProductId };
  });

  const ori = await getOriProduct(oriProductId);
  if (!ori) throw new Error("ori_not_created");
  return { ori, productIds };
}

export async function updateOriProduct(input: {
  oriProductId: number;
  oriProductNameTh: string;
  oriProductNameEng?: string;
  colorId?: number | null;
  notes?: string;
  factoryId?: number | null;
}): Promise<void> {
  await ensureSkuMasterSchema();
  const nameTh = String(input.oriProductNameTh || "").trim();
  if (!nameTh) throw new Error("invalid_ori");
  await smartgiftExec(
    `UPDATE sg_ori_products
     SET ori_product_name_th = :name_th,
         ori_product_name_eng = :name_en,
         color_id = :color_id,
         notes = :notes,
         factory_id = :factory_id
     WHERE ori_product_id = :id`,
    {
      id: input.oriProductId,
      name_th: nameTh,
      name_en: input.oriProductNameEng?.trim() || null,
      color_id: input.colorId || null,
      notes: input.notes?.trim() || null,
      factory_id: input.factoryId || null,
    },
  );
}

/** Persist factory carton packing onto ORI by factory code (Excel round-trip). */
export async function updateOriPackingByCode(input: {
  oriProductCode: string;
  pcsPerCtn?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  cartonKg?: number | null;
  dimsAreCarton?: boolean;
}): Promise<boolean> {
  await ensureSkuMasterSchema();
  const code = normalizeOriCode(input.oriProductCode);
  if (!code) return false;
  const result = await smartgiftExec(
    `UPDATE sg_ori_products
     SET pcs_per_ctn = :pcs,
         length_cm = :length_cm,
         width_cm = :width_cm,
         height_cm = :height_cm,
         carton_kg = :carton_kg,
         dims_are_carton = :dims_are_carton
     WHERE ori_product_code = :code`,
    {
      code,
      pcs:
        input.pcsPerCtn != null && input.pcsPerCtn > 0
          ? Math.round(input.pcsPerCtn)
          : null,
      length_cm:
        input.lengthCm != null && input.lengthCm > 0 ? input.lengthCm : null,
      width_cm:
        input.widthCm != null && input.widthCm > 0 ? input.widthCm : null,
      height_cm:
        input.heightCm != null && input.heightCm > 0 ? input.heightCm : null,
      carton_kg:
        input.cartonKg != null && input.cartonKg > 0 ? input.cartonKg : null,
      dims_are_carton: input.dimsAreCarton === false ? 0 : 1,
    },
  );
  return Number(result.affectedRows || 0) > 0;
}

export async function createSkuForOri(input: {
  oriProductId: number;
  stockClass: StockClass;
  nameTh?: string;
  sellPriceThb?: number | null;
}): Promise<string> {
  await ensureSkuMasterSchema();
  if (input.stockClass === "C") throw new Error("create_c_via_move");
  const ori = await getOriProduct(input.oriProductId);
  if (!ori) throw new Error("ori_not_found");
  if (input.stockClass === "A" || input.stockClass === "B") {
    const existing = await smartgiftQuery<RowDataPacket[]>(
      `SELECT product_id FROM sg_sku
       WHERE ori_product_id = :ori AND stock_class = :cls AND is_bundle = 0
       LIMIT 1`,
      { ori: input.oriProductId, cls: input.stockClass },
    );
    if (existing[0]) return String(existing[0].product_id);
  }
  return withSmartgiftTransaction((conn) =>
    insertSku(conn, {
      stockClass: input.stockClass,
      oriProductId: input.oriProductId,
      nameTh: input.nameTh?.trim() || ori.oriProductNameTh,
      nameEn: ori.oriProductNameEng,
      sellPriceThb: input.sellPriceThb,
    }),
  );
}

function skuFilterWhere(
  filter: SkuListFilter,
  options?: { ignoreClass?: boolean },
): { where: string; params: Record<string, unknown> } {
  const params: Record<string, unknown> = {};
  let where = "WHERE 1=1";
  if (!options?.ignoreClass && filter.stockClass && isStockClass(filter.stockClass)) {
    where += " AND s.stock_class = :stockClass";
    params.stockClass = filter.stockClass;
  }
  if (filter.tag?.trim()) {
    where +=
      " AND s.product_id IN (SELECT product_id FROM sg_sku_tag WHERE tag = :tag)";
    params.tag = filter.tag.trim().toLowerCase();
  }
  if (filter.groupId && Number.isInteger(filter.groupId)) {
    where +=
      " AND s.product_id IN (SELECT product_id FROM sg_sku_group_item WHERE group_id = :groupId)";
    params.groupId = filter.groupId;
  }
  if (filter.q?.trim()) {
    where +=
      " AND (s.product_id LIKE :q OR s.name_th LIKE :q OR o.ori_product_code LIKE :q OR o.ori_product_name_th LIKE :q)";
    params.q = `%${filter.q.trim()}%`;
  }
  return { where, params };
}

export async function countSkus(filter: SkuListFilter = {}): Promise<number> {
  await ensureSkuMasterSchema();
  const { where, params } = skuFilterWhere(filter);
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT s.product_id) AS n
     FROM sg_sku s
     LEFT JOIN sg_ori_products o ON o.ori_product_id = s.ori_product_id
     ${where}`,
    params,
  );
  return Number(rows[0]?.n || 0);
}

export async function countSkusByClass(
  filter: Omit<SkuListFilter, "stockClass"> = {},
): Promise<Record<StockClass, number>> {
  await ensureSkuMasterSchema();
  const { where, params } = skuFilterWhere(filter, { ignoreClass: true });
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT s.stock_class, COUNT(DISTINCT s.product_id) AS n
     FROM sg_sku s
     LEFT JOIN sg_ori_products o ON o.ori_product_id = s.ori_product_id
     ${where}
     GROUP BY s.stock_class`,
    params,
  );
  const counts: Record<StockClass, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const row of rows) {
    if (isStockClass(String(row.stock_class))) {
      counts[row.stock_class as StockClass] = Number(row.n || 0);
    }
  }
  return counts;
}

export async function listSkus(filter: SkuListFilter = {}): Promise<SkuRecord[]> {
  await ensureSkuMasterSchema();
  const { where, params } = skuFilterWhere(filter);
  const limit = Math.min(Math.max(filter.limit ?? 400, 1), 2000);
  const offset = Math.max(0, Math.floor(filter.offset ?? 0));
  const rows = await smartgiftQuery<SkuRow[]>(
    `${SKU_SELECT}
     ${where}
     GROUP BY s.product_id
     ORDER BY s.stock_class ASC, s.running_no ASC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return rows.map(mapSku);
}

export async function getSku(productId: string): Promise<SkuRecord | null> {
  await ensureSkuMasterSchema();
  const parsed = parseProductId(productId);
  if (!parsed) return null;
  const rows = await smartgiftQuery<SkuRow[]>(
    `${SKU_SELECT} WHERE s.product_id = :productId GROUP BY s.product_id LIMIT 1`,
    { productId: parsed.stockClass + String(parsed.runningNo).padStart(5, "0") },
  );
  return rows[0] ? mapSku(rows[0]) : null;
}

export async function updateSku(input: {
  productId: string;
  nameTh: string;
  nameEn?: string;
  sellPriceThb?: number | null;
  catalogSlug?: string;
  imageUrl?: string;
  clearanceReason?: string;
}): Promise<void> {
  await ensureSkuMasterSchema();
  const sku = await getSku(input.productId);
  if (!sku) throw new Error("sku_not_found");
  const nameTh = String(input.nameTh || "").trim();
  if (!nameTh) throw new Error("invalid_sku");
  const imageUrl = String(input.imageUrl ?? sku.imageUrl ?? "").trim();
  await smartgiftExec(
    `UPDATE sg_sku
     SET name_th = :name_th,
         name_en = :name_en,
         sell_price_thb = :sell_price,
         catalog_slug = :catalog_slug,
         image_url = :image_url,
         clearance_reason = :clearance_reason
     WHERE product_id = :product_id`,
    {
      product_id: sku.productId,
      name_th: nameTh,
      name_en: input.nameEn?.trim() || null,
      sell_price: input.sellPriceThb ?? sku.sellPriceThb,
      catalog_slug: input.catalogSlug?.trim() || null,
      image_url: isUsableImageSrc(imageUrl) ? imageUrl : null,
      clearance_reason: input.clearanceReason?.trim() || sku.clearanceReason,
    },
  );
}

export async function listBundleComponentOptions(): Promise<BundleComponentOption[]> {
  await ensureSkuMasterSchema();
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT s.product_id, s.name_th, s.stock_class, o.ori_product_code
     FROM sg_sku s
     LEFT JOIN sg_ori_products o ON o.ori_product_id = s.ori_product_id
     WHERE s.is_bundle = 0 AND s.stock_class IN ('A', 'B')
     ORDER BY s.stock_class ASC, s.running_no ASC
     LIMIT 2000`,
  );
  return rows.map((row) => ({
    productId: String(row.product_id),
    nameTh: String(row.name_th),
    stockClass: row.stock_class === "A" ? "A" : "B",
    oriProductCode: row.ori_product_code ? String(row.ori_product_code) : null,
  }));
}

export async function listBundleItems(bundleProductId: string): Promise<SkuBundleItem[]> {
  await ensureSkuMasterSchema();
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT i.component_product_id, i.qty, s.name_th, s.stock_class
     FROM sg_sku_bundle_item i
     JOIN sg_sku s ON s.product_id = i.component_product_id
     WHERE i.bundle_product_id = :id
     ORDER BY i.component_product_id ASC`,
    { id: bundleProductId },
  );
  return rows.map((row) => ({
    componentProductId: String(row.component_product_id),
    qty: Number(row.qty),
    nameTh: String(row.name_th),
    stockClass: isStockClass(String(row.stock_class)) ? (row.stock_class as StockClass) : "B",
  }));
}

export async function createBundle(input: {
  nameTh: string;
  nameEn?: string;
  stockClass: "A" | "B";
  sellPriceThb: number;
  items: Array<{ componentProductId: string; qty: number }>;
}): Promise<string> {
  await ensureSkuMasterSchema();
  const nameTh = String(input.nameTh || "").trim();
  if (!nameTh) throw new Error("invalid_bundle_name");
  if (!isSellableBundleClass(input.stockClass)) throw new Error("invalid_bundle_class");
  if (!Number.isFinite(input.sellPriceThb) || input.sellPriceThb < 0) {
    throw new Error("invalid_bundle_price");
  }
  const items = input.items
    .map((item) => ({
      componentProductId: parseProductId(item.componentProductId)?.stockClass
        ? formatProductId(
            parseProductId(item.componentProductId)!.stockClass,
            parseProductId(item.componentProductId)!.runningNo,
          )
        : "",
      qty: Math.max(1, Math.floor(item.qty || 1)),
    }))
    .filter((item) => item.componentProductId);
  if (items.length === 0) throw new Error("bundle_empty");

  return withSmartgiftTransaction(async (conn) => {
    for (const item of items) {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT product_id, stock_class, is_bundle FROM sg_sku WHERE product_id = ? LIMIT 1`,
        [item.componentProductId],
      );
      const row = rows[0];
      if (!row) throw new Error("component_not_found");
      if (Number(row.is_bundle) === 1) throw new Error("component_is_bundle");
      if (row.stock_class !== "A" && row.stock_class !== "B") {
        throw new Error("component_not_ab");
      }
    }
    const productId = await insertSku(conn, {
      stockClass: input.stockClass,
      oriProductId: null,
      nameTh,
      nameEn: input.nameEn?.trim() || null,
      isBundle: true,
      sellPriceThb: input.sellPriceThb,
    });
    for (const item of items) {
      await conn.query(
        `INSERT INTO sg_sku_bundle_item (bundle_product_id, component_product_id, qty)
         VALUES (?, ?, ?)`,
        [productId, item.componentProductId, item.qty],
      );
    }
    return productId;
  });
}

export async function replaceSkuTags(productId: string, tags: string[]): Promise<string[]> {
  await ensureSkuMasterSchema();
  const sku = await getSku(productId);
  if (!sku) throw new Error("sku_not_found");
  const unique = normalizeOpsTags(tags);
  await withSmartgiftTransaction(async (conn) => {
    await conn.query(`DELETE FROM sg_sku_tag WHERE product_id = ?`, [sku.productId]);
    for (const tag of unique) {
      await conn.query(
        `INSERT INTO sg_sku_tag (tag, product_id) VALUES (?, ?)`,
        [tag, sku.productId],
      );
    }
  });
  return unique;
}

export async function listSkuTagSuggestions(): Promise<string[]> {
  await ensureSkuMasterSchema();
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT DISTINCT tag FROM sg_sku_tag ORDER BY tag ASC LIMIT 200`,
  );
  return rows.map((row) => String(row.tag));
}

export async function listSkuGroups(): Promise<SkuGroup[]> {
  await ensureSkuMasterSchema();
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT g.id, g.name, g.notes, COUNT(i.product_id) AS item_count
     FROM sg_sku_group g
     LEFT JOIN sg_sku_group_item i ON i.group_id = g.id
     GROUP BY g.id
     ORDER BY g.name ASC`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    notes: row.notes ? String(row.notes) : null,
    itemCount: Number(row.item_count || 0),
  }));
}

export async function createSkuGroup(name: string, notes?: string): Promise<number> {
  await ensureSkuMasterSchema();
  const title = String(name || "").trim();
  if (!title) throw new Error("invalid_group");
  const result = await smartgiftExec(
    `INSERT INTO sg_sku_group (name, notes) VALUES (:name, :notes)`,
    { name: title, notes: notes?.trim() || null },
  );
  return Number(result.insertId);
}

export async function listGroupItems(groupId: number): Promise<string[]> {
  await ensureSkuMasterSchema();
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT product_id FROM sg_sku_group_item WHERE group_id = :id ORDER BY sort_order ASC, product_id ASC`,
    { id: groupId },
  );
  return rows.map((row) => String(row.product_id));
}

export async function setGroupItems(groupId: number, productIds: string[]): Promise<void> {
  await ensureSkuMasterSchema();
  const unique = uniqueProductIdsInOrder(productIds);
  await withSmartgiftTransaction(async (conn) => {
    await conn.query(`DELETE FROM sg_sku_group_item WHERE group_id = ?`, [groupId]);
    for (let index = 0; index < unique.length; index += 1) {
      await conn.query(
        `INSERT INTO sg_sku_group_item (group_id, product_id, sort_order) VALUES (?, ?, ?)`,
        [groupId, unique[index], index],
      );
    }
  });
}

export async function listSerials(productId: string): Promise<SkuSerial[]> {
  await ensureSkuMasterSchema();
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT id, product_id, serial_no, status
     FROM sg_sku_serial WHERE product_id = :id
     ORDER BY status ASC, serial_no ASC`,
    { id: productId },
  );
  return rows.map((row) => ({
    id: Number(row.id),
    productId: String(row.product_id),
    serialNo: String(row.serial_no),
    status: row.status as SkuSerial["status"],
  }));
}

export async function addSerial(productId: string, serialNo: string): Promise<void> {
  await ensureSkuMasterSchema();
  const sku = await getSku(productId);
  if (!sku) throw new Error("sku_not_found");
  const serial = String(serialNo || "").trim();
  if (!serial) throw new Error("invalid_serial");
  await withSmartgiftTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO sg_sku_serial (product_id, serial_no, status) VALUES (?, ?, 'on_hand')`,
      [sku.productId, serial],
    );
    await conn.query(
      `UPDATE sg_sku SET on_hand_qty = on_hand_qty + 1 WHERE product_id = ?`,
      [sku.productId],
    );
  });
}

async function getOrCreateClearanceSku(
  conn: PoolConnection,
  source: SkuRecord,
  defectReason: string,
  clearancePriceThb: number,
): Promise<string> {
  if (source.oriProductId) {
    const [existing] = await conn.query<RowDataPacket[]>(
      `SELECT product_id FROM sg_sku
       WHERE ori_product_id = ? AND stock_class = 'C' AND is_bundle = 0
       LIMIT 1`,
      [source.oriProductId],
    );
    if (existing[0]?.product_id) {
      const productId = String(existing[0].product_id);
      await conn.query(
        `UPDATE sg_sku SET clearance_reason = ?, sell_price_thb = ? WHERE product_id = ?`,
        [defectReason, clearancePriceThb, productId],
      );
      return productId;
    }
  }
  return insertSku(conn, {
    stockClass: "C",
    oriProductId: source.oriProductId,
    nameTh: source.nameTh,
    nameEn: source.nameEn,
    sellPriceThb: clearancePriceThb,
  });
}

export async function moveSerialToC(input: {
  fromProductId: string;
  serialNo: string;
  defectReason: string;
  clearancePriceThb: number;
  actorEmail?: string;
}): Promise<{ fromProductId: string; toProductId: string }> {
  await ensureSkuMasterSchema();
  const source = await getSku(input.fromProductId);
  if (!source) throw new Error("sku_not_found");
  if (!canMoveToClearance(source.stockClass)) throw new Error("source_not_ab");
  const serialNo = String(input.serialNo || "").trim();
  const defectReason = String(input.defectReason || "").trim();
  if (!serialNo || !defectReason) throw new Error("invalid_move");
  if (!Number.isFinite(input.clearancePriceThb) || input.clearancePriceThb < 0) {
    throw new Error("invalid_clearance_price");
  }

  return withSmartgiftTransaction(async (conn) => {
    const [serialRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM sg_sku_serial
       WHERE product_id = ? AND serial_no = ? AND status = 'on_hand'
       LIMIT 1 FOR UPDATE`,
      [source.productId, serialNo],
    );
    if (!serialRows[0]) throw new Error("serial_not_on_hand");

    const toProductId = await getOrCreateClearanceSku(
      conn,
      source,
      defectReason,
      input.clearancePriceThb,
    );
    await conn.query(
      `UPDATE sg_sku SET clearance_reason = ?, sell_price_thb = ? WHERE product_id = ?`,
      [defectReason, input.clearancePriceThb, toProductId],
    );
    await conn.query(
      `UPDATE sg_sku_serial SET status = 'moved' WHERE product_id = ? AND serial_no = ?`,
      [source.productId, serialNo],
    );
    await conn.query(
      `UPDATE sg_sku SET on_hand_qty = GREATEST(on_hand_qty - 1, 0) WHERE product_id = ?`,
      [source.productId],
    );
    await conn.query(
      `INSERT INTO sg_sku_serial (product_id, serial_no, status) VALUES (?, ?, 'on_hand')`,
      [toProductId, serialNo],
    );
    await conn.query(
      `UPDATE sg_sku SET on_hand_qty = on_hand_qty + 1 WHERE product_id = ?`,
      [toProductId],
    );
    await conn.query(
      `INSERT INTO sg_sku_move (
         from_product_id, to_product_id, serial_no, defect_reason,
         clearance_price_thb, actor_email
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        source.productId,
        toProductId,
        serialNo,
        defectReason,
        input.clearancePriceThb,
        input.actorEmail || null,
      ],
    );
    return { fromProductId: source.productId, toProductId };
  });
}

export async function listSkuMoves(productId: string): Promise<SkuMove[]> {
  await ensureSkuMasterSchema();
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT id, from_product_id, to_product_id, serial_no, defect_reason,
            clearance_price_thb, actor_email, moved_at
     FROM sg_sku_move
     WHERE from_product_id = :id OR to_product_id = :id
     ORDER BY moved_at DESC
     LIMIT 100`,
    { id: productId },
  );
  return rows.map((row) => ({
    id: Number(row.id),
    fromProductId: String(row.from_product_id),
    toProductId: String(row.to_product_id),
    serialNo: String(row.serial_no),
    defectReason: String(row.defect_reason),
    clearancePriceThb: Number(row.clearance_price_thb),
    actorEmail: row.actor_email ? String(row.actor_email) : null,
    movedAt: String(row.moved_at),
  }));
}

export async function saveSkuLandedCost(input: {
  productId: string;
  factoryUnitCny?: number | null;
  factoryUnitUsd?: number | null;
  unitLandedCostThb?: number | null;
  profile?: ForcedMinQtyProfile;
}): Promise<number> {
  await ensureSkuMasterSchema();
  const sku = await getSku(input.productId);
  if (!sku) throw new Error("sku_not_found");
  const landed =
    unitLandedFromFactory(
      input.factoryUnitCny ?? sku.factoryUnitCny,
      input.factoryUnitUsd ?? sku.factoryUnitUsd,
      input.unitLandedCostThb ?? sku.unitLandedCostThb,
      SMARTGIFT_FX_CNY_THB,
    );
  if (landed == null) throw new Error("missing_landed_cost");
  const computed = computeForcedMinQty({
    unitLandedCostThb: landed,
    profile: input.profile ?? "standard",
  });
  await smartgiftExec(
    `UPDATE sg_sku
     SET factory_unit_cny = :cny,
         factory_unit_usd = :usd,
         unit_landed_cost_thb = :landed,
         forced_min_qty = :min_qty
     WHERE product_id = :id`,
    {
      id: sku.productId,
      cny: input.factoryUnitCny ?? sku.factoryUnitCny,
      usd: input.factoryUnitUsd ?? sku.factoryUnitUsd,
      landed,
      min_qty: computed.forcedMinQty,
    },
  );
  return computed.forcedMinQty;
}

export async function getForcedMinQtyForCatalogSlug(
  slug: string | null | undefined,
): Promise<number | null> {
  const wanted = String(slug || "").trim();
  if (!wanted) return null;
  try {
    if (!(await skuMasterTablesReady())) {
      return null;
    }
    const rows = await smartgiftQuery<RowDataPacket[]>(
      `SELECT forced_min_qty FROM sg_sku
       WHERE (catalog_slug = :slug OR product_id = :productId)
         AND forced_min_qty IS NOT NULL
       ORDER BY FIELD(stock_class, 'B', 'A', 'D', 'C'), running_no ASC
       LIMIT 1`,
      { slug: wanted, productId: wanted.toUpperCase() },
    );
    const qty = Number(rows[0]?.forced_min_qty);
    return Number.isInteger(qty) && qty > 0 ? qty : null;
  } catch {
    return null;
  }
}

export async function listSkusByCatalogSlugs(
  slugs: string[],
): Promise<Map<string, SkuRecord>> {
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  const map = new Map<string, SkuRecord>();
  if (unique.length === 0) return map;
  try {
    if (!(await skuMasterTablesReady())) return map;
    const inParams: Record<string, string> = {};
    const inList = unique
      .map((slug, index) => {
        const key = `slug${index}`;
        inParams[key] = slug;
        return `:${key}`;
      })
      .join(", ");
    const rows = await smartgiftQuery<SkuRow[]>(
      `${SKU_SELECT} WHERE s.catalog_slug IN (${inList}) GROUP BY s.product_id`,
      inParams,
    );
    for (const row of rows) {
      const sku = mapSku(row);
      if (sku.catalogSlug && !map.has(sku.catalogSlug)) {
        map.set(sku.catalogSlug, sku);
      }
    }
  } catch {
    return map;
  }
  return map;
}

export async function listClearanceSkus(limit = 80): Promise<SkuRecord[]> {
  return listSkus({ stockClass: "C", limit });
}
