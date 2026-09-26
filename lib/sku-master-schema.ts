/**
 * Apply commercial SKU master tables on SmartGift MySQL.
 * Safe to call from ops pages; public catalog only reads if tables already exist.
 */

import type { RowDataPacket } from "mysql2/promise";
import {
  isSmartgiftMysqlEnabled,
  smartgiftExec,
  smartgiftQuery,
  withSmartgiftTransaction,
} from "@/lib/smartgift-mysql";
import { formatProductId } from "@/lib/sku-master-ids";

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS master_basic_colors (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(32) NOT NULL,
    name_th VARCHAR(80) NOT NULL,
    name_en VARCHAR(80) NULL,
    hex VARCHAR(7) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_master_basic_colors_code (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sg_ori_products (
    ori_product_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ori_product_code VARCHAR(32) NOT NULL,
    ori_product_name_th VARCHAR(255) NOT NULL,
    ori_product_name_eng VARCHAR(255) NULL,
    color_id INT UNSIGNED NULL,
    notes TEXT NULL,
    factory_id INT UNSIGNED NULL,
    pcs_per_ctn INT UNSIGNED NULL,
    length_cm DECIMAL(10,2) NULL,
    width_cm DECIMAL(10,2) NULL,
    height_cm DECIMAL(10,2) NULL,
    carton_kg DECIMAL(10,3) NULL,
    dims_are_carton TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (ori_product_id),
    UNIQUE KEY uk_sg_ori_code (ori_product_code),
    KEY idx_sg_ori_color (color_id),
    KEY idx_sg_ori_factory (factory_id),
    CONSTRAINT fk_sg_ori_color
      FOREIGN KEY (color_id) REFERENCES master_basic_colors (id)
      ON UPDATE CASCADE ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sg_sku_seq (
    stock_class CHAR(1) NOT NULL,
    last_no INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (stock_class)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sg_sku (
    product_id VARCHAR(8) NOT NULL,
    stock_class CHAR(1) NOT NULL,
    running_no INT UNSIGNED NOT NULL,
    ori_product_id INT UNSIGNED NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NULL,
    sell_price_thb DECIMAL(12,2) NULL,
    is_bundle TINYINT(1) NOT NULL DEFAULT 0,
    clearance_reason VARCHAR(500) NULL,
    catalog_slug VARCHAR(160) NULL,
    image_url VARCHAR(512) NULL,
    factory_unit_cny DECIMAL(12,4) NULL,
    factory_unit_usd DECIMAL(12,4) NULL,
    unit_landed_cost_thb DECIMAL(12,2) NULL,
    forced_min_qty INT UNSIGNED NULL,
    on_hand_qty INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id),
    UNIQUE KEY uk_sg_sku_class_running (stock_class, running_no),
    KEY idx_sg_sku_ori (ori_product_id),
    KEY idx_sg_sku_class (stock_class),
    KEY idx_sg_sku_slug (catalog_slug),
    CONSTRAINT fk_sg_sku_ori
      FOREIGN KEY (ori_product_id) REFERENCES sg_ori_products (ori_product_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sg_sku_bundle_item (
    bundle_product_id VARCHAR(8) NOT NULL,
    component_product_id VARCHAR(8) NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    PRIMARY KEY (bundle_product_id, component_product_id),
    KEY idx_sg_sku_bundle_component (component_product_id),
    CONSTRAINT fk_sg_sku_bundle_parent
      FOREIGN KEY (bundle_product_id) REFERENCES sg_sku (product_id)
      ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_sg_sku_bundle_child
      FOREIGN KEY (component_product_id) REFERENCES sg_sku (product_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sg_sku_serial (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id VARCHAR(8) NOT NULL,
    serial_no VARCHAR(64) NOT NULL,
    status ENUM('on_hand','moved','sold') NOT NULL DEFAULT 'on_hand',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sg_sku_serial (product_id, serial_no),
    KEY idx_sg_sku_serial_status (product_id, status),
    CONSTRAINT fk_sg_sku_serial_sku
      FOREIGN KEY (product_id) REFERENCES sg_sku (product_id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sg_sku_move (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    from_product_id VARCHAR(8) NOT NULL,
    to_product_id VARCHAR(8) NOT NULL,
    serial_no VARCHAR(64) NOT NULL,
    defect_reason VARCHAR(500) NOT NULL,
    clearance_price_thb DECIMAL(12,2) NOT NULL,
    actor_email VARCHAR(160) NULL,
    moved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sg_sku_move_from (from_product_id),
    KEY idx_sg_sku_move_to (to_product_id),
    CONSTRAINT fk_sg_sku_move_from
      FOREIGN KEY (from_product_id) REFERENCES sg_sku (product_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_sg_sku_move_to
      FOREIGN KEY (to_product_id) REFERENCES sg_sku (product_id)
      ON UPDATE CASCADE ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sg_sku_group (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sg_sku_group_item (
    group_id INT UNSIGNED NOT NULL,
    product_id VARCHAR(8) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (group_id, product_id),
    KEY idx_sg_sku_group_item_sku (product_id),
    KEY idx_sg_sku_group_item_sort (group_id, sort_order),
    CONSTRAINT fk_sg_sku_group
      FOREIGN KEY (group_id) REFERENCES sg_sku_group (id)
      ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_sg_sku_group_sku
      FOREIGN KEY (product_id) REFERENCES sg_sku (product_id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sg_sku_file (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id VARCHAR(8) NULL,
    ori_product_id INT UNSIGNED NULL,
    file_kind ENUM('photo','document','other') NOT NULL DEFAULT 'other',
    original_name VARCHAR(255) NOT NULL,
    object_key VARCHAR(255) NOT NULL,
    bucket VARCHAR(80) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    is_cover TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sg_sku_file_sku (product_id),
    KEY idx_sg_sku_file_ori (ori_product_id),
    CONSTRAINT fk_sg_sku_file_sku
      FOREIGN KEY (product_id) REFERENCES sg_sku (product_id)
      ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_sg_sku_file_ori
      FOREIGN KEY (ori_product_id) REFERENCES sg_ori_products (ori_product_id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const COLOR_SEED: Array<{
  code: string;
  name_th: string;
  name_en: string;
  hex: string;
  sort_order: number;
}> = [
  { code: "black", name_th: "ดำ", name_en: "Black", hex: "#111111", sort_order: 10 },
  { code: "white", name_th: "ขาว", name_en: "White", hex: "#F5F5F5", sort_order: 20 },
  { code: "silver", name_th: "เงิน", name_en: "Silver", hex: "#C0C0C0", sort_order: 30 },
  { code: "gold", name_th: "ทอง", name_en: "Gold", hex: "#C9A227", sort_order: 40 },
  { code: "navy", name_th: "กรมท่า", name_en: "Navy", hex: "#1B3A4B", sort_order: 50 },
  { code: "blue", name_th: "น้ำเงิน", name_en: "Blue", hex: "#2563EB", sort_order: 60 },
  { code: "red", name_th: "แดง", name_en: "Red", hex: "#B91C1C", sort_order: 70 },
  { code: "green", name_th: "เขียว", name_en: "Green", hex: "#15803D", sort_order: 80 },
  { code: "pink", name_th: "ชมพู", name_en: "Pink", hex: "#DB2777", sort_order: 90 },
  { code: "gray", name_th: "เทา", name_en: "Gray", hex: "#6B7280", sort_order: 100 },
  { code: "natural", name_th: "ธรรมชาติ", name_en: "Natural", hex: "#D6C4A8", sort_order: 110 },
];

let ensured: Promise<void> | null = null;

export function resetSkuMasterSchemaCache(): void {
  ensured = null;
}

export async function skuMasterTablesReady(): Promise<boolean> {
  if (!isSmartgiftMysqlEnabled()) return false;
  try {
    await smartgiftQuery("SELECT 1 FROM sg_sku LIMIT 1");
    return true;
  } catch {
    return false;
  }
}

async function tableExists(name: string): Promise<boolean> {
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = :name LIMIT 1`,
    { name },
  );
  return rows.length > 0;
}

async function seedDefaults(): Promise<void> {
  await smartgiftExec(
    `INSERT IGNORE INTO sg_sku_seq (stock_class, last_no) VALUES
     ('A', 0), ('B', 0), ('C', 0), ('D', 0)`,
  );
  for (const color of COLOR_SEED) {
    await smartgiftExec(
      `INSERT IGNORE INTO master_basic_colors (code, name_th, name_en, hex, sort_order)
       VALUES (:code, :name_th, :name_en, :hex, :sort_order)`,
      color,
    );
  }
}

async function migrateFromSgProducts(): Promise<void> {
  if (!(await tableExists("sg_products"))) return;
  await smartgiftExec(
    `INSERT IGNORE INTO sg_ori_products (ori_product_code, ori_product_name_th, ori_product_name_eng)
     SELECT p.code, COALESCE(NULLIF(p.name_th, ''), p.code), NULLIF(p.name_en, '')
     FROM sg_products p`,
  );

  const missing = await smartgiftQuery<RowDataPacket[]>(
    `SELECT o.ori_product_id, o.ori_product_code, o.ori_product_name_th, o.ori_product_name_eng
     FROM sg_ori_products o
     LEFT JOIN sg_sku s ON s.ori_product_id = o.ori_product_id AND s.is_bundle = 0
     WHERE s.product_id IS NULL
     ORDER BY o.ori_product_id ASC
     LIMIT 2000`,
  );
  if (missing.length === 0) return;

  await withSmartgiftTransaction(async (conn) => {
    const [seqRows] = await conn.query<RowDataPacket[]>(
      `SELECT last_no FROM sg_sku_seq WHERE stock_class = 'B' FOR UPDATE`,
    );
    let lastNo = Number(seqRows[0]?.last_no ?? 0);
    for (const row of missing) {
      lastNo += 1;
      const productId = formatProductId("B", lastNo);
      await conn.query(
        `INSERT INTO sg_sku (
           product_id, stock_class, running_no, ori_product_id, name_th, name_en, is_bundle
         ) VALUES (?, 'B', ?, ?, ?, ?, 0)`,
        [
          productId,
          lastNo,
          row.ori_product_id,
          row.ori_product_name_th,
          row.ori_product_name_eng,
        ],
      );
    }
    await conn.query(`UPDATE sg_sku_seq SET last_no = ? WHERE stock_class = 'B'`, [lastNo]);
  });
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT 1 AS ok FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column
     LIMIT 1`,
    { table, column },
  );
  return rows.length > 0;
}

async function ensureSkuMasterColumns(): Promise<void> {
  if (!(await columnExists("sg_sku", "image_url"))) {
    await smartgiftExec(
      `ALTER TABLE sg_sku ADD COLUMN image_url VARCHAR(512) NULL AFTER catalog_slug`,
    );
  }
  if (!(await columnExists("sg_sku_group_item", "sort_order"))) {
    await smartgiftExec(
      `ALTER TABLE sg_sku_group_item ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER product_id`,
    );
  }
  if (!(await columnExists("sg_ori_products", "factory_id"))) {
    await smartgiftExec(
      `ALTER TABLE sg_ori_products ADD COLUMN factory_id INT UNSIGNED NULL AFTER notes`,
    );
  }
  if (!(await columnExists("sg_ori_products", "pcs_per_ctn"))) {
    await smartgiftExec(
      `ALTER TABLE sg_ori_products ADD COLUMN pcs_per_ctn INT UNSIGNED NULL AFTER factory_id`,
    );
  }
  if (!(await columnExists("sg_ori_products", "length_cm"))) {
    await smartgiftExec(
      `ALTER TABLE sg_ori_products ADD COLUMN length_cm DECIMAL(10,2) NULL AFTER pcs_per_ctn`,
    );
  }
  if (!(await columnExists("sg_ori_products", "width_cm"))) {
    await smartgiftExec(
      `ALTER TABLE sg_ori_products ADD COLUMN width_cm DECIMAL(10,2) NULL AFTER length_cm`,
    );
  }
  if (!(await columnExists("sg_ori_products", "height_cm"))) {
    await smartgiftExec(
      `ALTER TABLE sg_ori_products ADD COLUMN height_cm DECIMAL(10,2) NULL AFTER width_cm`,
    );
  }
  if (!(await columnExists("sg_ori_products", "carton_kg"))) {
    await smartgiftExec(
      `ALTER TABLE sg_ori_products ADD COLUMN carton_kg DECIMAL(10,3) NULL AFTER height_cm`,
    );
  }
  if (!(await columnExists("sg_ori_products", "dims_are_carton"))) {
    await smartgiftExec(
      `ALTER TABLE sg_ori_products ADD COLUMN dims_are_carton TINYINT(1) NOT NULL DEFAULT 1 AFTER carton_kg`,
    );
  }
}

async function ensureOnce(): Promise<void> {
  if (!isSmartgiftMysqlEnabled()) {
    throw new Error("SmartGift MySQL is not enabled");
  }
  for (const sql of DDL) {
    await smartgiftExec(sql);
  }
  await ensureSkuMasterColumns();
  await seedDefaults();
  await migrateFromSgProducts();
}

export async function ensureSkuMasterSchema(): Promise<void> {
  if (!ensured) {
    ensured = ensureOnce().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  await ensured;
}
