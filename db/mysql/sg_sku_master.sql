-- Commercial SKU master A/B/C/D on SmartGift MySQL.
-- product_id = {class}{5-digit running} e.g. A00001
-- Factory identity lives on sg_ori_products; sellable codes live on sg_sku.

SET NAMES utf8mb4;
USE smartgift;

CREATE TABLE IF NOT EXISTS master_basic_colors (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(32)  NOT NULL,
  name_th     VARCHAR(80)  NOT NULL,
  name_en     VARCHAR(80)  NULL,
  hex         VARCHAR(7)   NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_master_basic_colors_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='basic color master for ori products';

CREATE TABLE IF NOT EXISTS sg_ori_products (
  ori_product_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ori_product_code      VARCHAR(32)  NOT NULL,
  ori_product_name_th   VARCHAR(255) NOT NULL,
  ori_product_name_eng  VARCHAR(255) NULL,
  color_id              INT UNSIGNED NULL,
  notes                 TEXT         NULL,
  factory_id            INT UNSIGNED NULL,
  pcs_per_ctn           INT UNSIGNED NULL,
  length_cm             DECIMAL(10,2) NULL,
  width_cm              DECIMAL(10,2) NULL,
  height_cm             DECIMAL(10,2) NULL,
  carton_kg             DECIMAL(10,3) NULL,
  dims_are_carton       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ori_product_id),
  UNIQUE KEY uk_sg_ori_code (ori_product_code),
  KEY idx_sg_ori_color (color_id),
  KEY idx_sg_ori_factory (factory_id),
  CONSTRAINT fk_sg_ori_color
    FOREIGN KEY (color_id) REFERENCES master_basic_colors (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='factory identity (nt0001) separate from commercial SKU';

CREATE TABLE IF NOT EXISTS sg_sku_seq (
  stock_class CHAR(1)     NOT NULL,
  last_no     INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (stock_class)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='per-class running numbers so A and B never share a digit';

CREATE TABLE IF NOT EXISTS sg_sku (
  product_id            VARCHAR(8)    NOT NULL,
  stock_class           CHAR(1)       NOT NULL,
  running_no            INT UNSIGNED  NOT NULL,
  ori_product_id        INT UNSIGNED  NULL,
  name_th               VARCHAR(255)  NOT NULL,
  name_en               VARCHAR(255)  NULL,
  sell_price_thb        DECIMAL(12,2) NULL,
  is_bundle             TINYINT(1)    NOT NULL DEFAULT 0,
  clearance_reason      VARCHAR(500)  NULL,
  catalog_slug          VARCHAR(160)  NULL,
  image_url             VARCHAR(512)  NULL,
  factory_unit_cny      DECIMAL(12,4) NULL,
  factory_unit_usd      DECIMAL(12,4) NULL,
  unit_landed_cost_thb  DECIMAL(12,2) NULL,
  forced_min_qty        INT UNSIGNED  NULL,
  on_hand_qty           INT           NOT NULL DEFAULT 0,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  UNIQUE KEY uk_sg_sku_class_running (stock_class, running_no),
  KEY idx_sg_sku_ori (ori_product_id),
  KEY idx_sg_sku_class (stock_class),
  KEY idx_sg_sku_slug (catalog_slug),
  CONSTRAINT fk_sg_sku_ori
    FOREIGN KEY (ori_product_id) REFERENCES sg_ori_products (ori_product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='commercial SKU A stock / B MTO / C clearance / D fill-in';

CREATE TABLE IF NOT EXISTS sg_sku_bundle_item (
  bundle_product_id     VARCHAR(8) NOT NULL,
  component_product_id  VARCHAR(8) NOT NULL,
  qty                   INT        NOT NULL DEFAULT 1,
  PRIMARY KEY (bundle_product_id, component_product_id),
  KEY idx_sg_sku_bundle_component (component_product_id),
  CONSTRAINT fk_sg_sku_bundle_parent
    FOREIGN KEY (bundle_product_id) REFERENCES sg_sku (product_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sg_sku_bundle_child
    FOREIGN KEY (component_product_id) REFERENCES sg_sku (product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='bundle BOM — no component sell prices';

CREATE TABLE IF NOT EXISTS sg_sku_serial (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id  VARCHAR(8)      NOT NULL,
  serial_no   VARCHAR(64)     NOT NULL,
  status      ENUM('on_hand','moved','sold') NOT NULL DEFAULT 'on_hand',
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sg_sku_serial (product_id, serial_no),
  KEY idx_sg_sku_serial_status (product_id, status),
  CONSTRAINT fk_sg_sku_serial_sku
    FOREIGN KEY (product_id) REFERENCES sg_sku (product_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sg_sku_move (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_product_id      VARCHAR(8)      NOT NULL,
  to_product_id        VARCHAR(8)      NOT NULL,
  serial_no            VARCHAR(64)     NOT NULL,
  defect_reason        VARCHAR(500)    NOT NULL,
  clearance_price_thb  DECIMAL(12,2)   NOT NULL,
  actor_email          VARCHAR(160)    NULL,
  moved_at             TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sg_sku_move_from (from_product_id),
  KEY idx_sg_sku_move_to (to_product_id),
  CONSTRAINT fk_sg_sku_move_from
    FOREIGN KEY (from_product_id) REFERENCES sg_sku (product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sg_sku_move_to
    FOREIGN KEY (to_product_id) REFERENCES sg_sku (product_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='A/B serial moved to C clearance';

CREATE TABLE IF NOT EXISTS sg_sku_group (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  notes       VARCHAR(500) NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sg_sku_group_item (
  group_id    INT UNSIGNED NOT NULL,
  product_id  VARCHAR(8)   NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, product_id),
  KEY idx_sg_sku_group_item_sku (product_id),
  KEY idx_sg_sku_group_item_sort (group_id, sort_order),
  CONSTRAINT fk_sg_sku_group
    FOREIGN KEY (group_id) REFERENCES sg_sku_group (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sg_sku_group_sku
    FOREIGN KEY (product_id) REFERENCES sg_sku (product_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sg_sku_tag (
  tag         VARCHAR(40) NOT NULL,
  product_id  VARCHAR(8)  NOT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tag, product_id),
  KEY idx_sg_sku_tag_sku (product_id),
  CONSTRAINT fk_sg_sku_tag_sku
    FOREIGN KEY (product_id) REFERENCES sg_sku (product_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sg_sku_file (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id     VARCHAR(8)      NULL,
  ori_product_id INT UNSIGNED    NULL,
  file_kind      ENUM('photo','document','other') NOT NULL DEFAULT 'other',
  original_name  VARCHAR(255)    NOT NULL,
  object_key     VARCHAR(255)    NOT NULL,
  bucket         VARCHAR(80)     NOT NULL,
  content_type   VARCHAR(120)    NOT NULL,
  byte_size      INT UNSIGNED    NOT NULL,
  is_cover       TINYINT(1)      NOT NULL DEFAULT 0,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sg_sku_file_sku (product_id),
  KEY idx_sg_sku_file_ori (ori_product_id),
  CONSTRAINT fk_sg_sku_file_sku
    FOREIGN KEY (product_id) REFERENCES sg_sku (product_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sg_sku_file_ori
    FOREIGN KEY (ori_product_id) REFERENCES sg_ori_products (ori_product_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SKU/ori files in MinIO (photos + documents)';

INSERT IGNORE INTO sg_sku_seq (stock_class, last_no) VALUES
  ('A', 0), ('B', 0), ('C', 0), ('D', 0);

INSERT IGNORE INTO master_basic_colors (code, name_th, name_en, hex, sort_order) VALUES
  ('black', 'ดำ', 'Black', '#111111', 10),
  ('white', 'ขาว', 'White', '#F5F5F5', 20),
  ('silver', 'เงิน', 'Silver', '#C0C0C0', 30),
  ('gold', 'ทอง', 'Gold', '#C9A227', 40),
  ('navy', 'กรมท่า', 'Navy', '#1B3A4B', 50),
  ('blue', 'น้ำเงิน', 'Blue', '#2563EB', 60),
  ('red', 'แดง', 'Red', '#B91C1C', 70),
  ('green', 'เขียว', 'Green', '#15803D', 80),
  ('pink', 'ชมพู', 'Pink', '#DB2777', 90),
  ('gray', 'เทา', 'Gray', '#6B7280', 100),
  ('natural', 'ธรรมชาติ', 'Natural', '#D6C4A8', 110);

-- Migrate factory codes from the existing catalog component table when present.
INSERT IGNORE INTO sg_ori_products (ori_product_code, ori_product_name_th, ori_product_name_eng)
SELECT p.code, COALESCE(NULLIF(p.name_th, ''), p.code), NULLIF(p.name_en, '')
FROM sg_products p;

-- Default commercial code is class B (made-to-order gift sets).
INSERT INTO sg_sku (
  product_id, stock_class, running_no, ori_product_id, name_th, name_en, is_bundle
)
SELECT CONCAT('B', LPAD(src.rn, 5, '0')), 'B', src.rn,
       src.ori_product_id, src.ori_product_name_th, src.ori_product_name_eng, 0
FROM (
  SELECT o.ori_product_id, o.ori_product_name_th, o.ori_product_name_eng,
         ROW_NUMBER() OVER (ORDER BY o.ori_product_id)
           + COALESCE((SELECT last_no FROM sg_sku_seq WHERE stock_class = 'B'), 0) AS rn
  FROM sg_ori_products o
  LEFT JOIN sg_sku s ON s.ori_product_id = o.ori_product_id AND s.is_bundle = 0
  WHERE s.product_id IS NULL
) src;

SET @b_last := (SELECT COALESCE(MAX(running_no), 0) FROM sg_sku WHERE stock_class = 'B');
UPDATE sg_sku_seq SET last_no = @b_last WHERE stock_class = 'B';
