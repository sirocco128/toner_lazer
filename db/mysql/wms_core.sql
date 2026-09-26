-- MySQL WMS mirror (Phase 3). Apply when WMS_STORE=mysql.

CREATE TABLE IF NOT EXISTS wms_warehouse (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  warehouse_code VARCHAR(32) NOT NULL,
  name VARCHAR(191) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_wms_warehouse_code (warehouse_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wms_location (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  location_code VARCHAR(32) NOT NULL,
  warehouse_code VARCHAR(32) NOT NULL,
  name VARCHAR(191) NOT NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'bin',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_wms_location_code (location_code),
  KEY idx_wms_location_wh (warehouse_code, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wms_balance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_key VARCHAR(64) NOT NULL,
  location_id BIGINT UNSIGNED NOT NULL,
  qty_on_hand INT NOT NULL DEFAULT 0,
  qty_reserved INT NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_wms_balance_product_loc (product_key, location_id),
  KEY idx_wms_balance_product (product_key),
  CONSTRAINT chk_wms_on_hand_nonneg CHECK (qty_on_hand >= 0),
  CONSTRAINT chk_wms_reserved_nonneg CHECK (qty_reserved >= 0),
  CONSTRAINT chk_wms_reserved_le_on_hand CHECK (qty_reserved <= qty_on_hand)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wms_movement (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  movement_key VARCHAR(96) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  product_key VARCHAR(64) NOT NULL,
  location_id BIGINT UNSIGNED NOT NULL,
  qty_delta INT NOT NULL,
  qty_reserved_delta INT NOT NULL DEFAULT 0,
  receipt_id VARCHAR(64) NULL,
  order_id VARCHAR(64) NULL,
  po_id VARCHAR(64) NULL,
  reservation_id VARCHAR(64) NULL,
  memo VARCHAR(500) NULL,
  actor VARCHAR(191) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_wms_movement_key (movement_key),
  KEY idx_wms_movement_product (product_key, created_at),
  KEY idx_wms_movement_order (order_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wms_reservation (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reservation_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  product_key VARCHAR(64) NOT NULL,
  location_id BIGINT UNSIGNED NOT NULL,
  qty INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  consumed_at DATETIME(3) NULL,
  released_at DATETIME(3) NULL,
  UNIQUE KEY uq_wms_reservation_id (reservation_id),
  KEY idx_wms_reservation_order (order_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wms_warehouse (warehouse_code, name, status)
VALUES ('WH-MAIN', 'คลังหลัก Terabis', 'active');

INSERT IGNORE INTO wms_location (location_code, warehouse_code, name, kind, status)
VALUES
  ('BIN-DEFAULT', 'WH-MAIN', 'ชั้นวางหลัก', 'bin', 'active'),
  ('BIN-QC', 'WH-MAIN', 'กักกัน QC', 'qc', 'active'),
  ('BIN-XDOCK', 'WH-MAIN', 'จุดแพ็ก Cross-Dock', 'staging', 'active');
