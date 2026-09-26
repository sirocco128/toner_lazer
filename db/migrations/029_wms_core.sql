-- WMS core (SQLite): warehouses, locations, balances, movements, reservations, cycle counts

CREATE TABLE IF NOT EXISTS wms_warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warehouse_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wms_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_code TEXT NOT NULL UNIQUE,
  warehouse_code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'bin',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wms_locations_wh
  ON wms_locations (warehouse_code, status);

CREATE TABLE IF NOT EXISTS wms_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_key TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  qty_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  qty_reserved INTEGER NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  updated_at TEXT NOT NULL,
  UNIQUE (product_key, location_id),
  CHECK (qty_reserved <= qty_on_hand)
);

CREATE INDEX IF NOT EXISTS idx_wms_balances_product
  ON wms_balances (product_key);

CREATE TABLE IF NOT EXISTS wms_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  product_key TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  qty_delta INTEGER NOT NULL,
  qty_reserved_delta INTEGER NOT NULL DEFAULT 0,
  receipt_id TEXT,
  order_id TEXT,
  po_id TEXT,
  reservation_id TEXT,
  memo TEXT,
  actor TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wms_movements_product
  ON wms_movements (product_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wms_movements_order
  ON wms_movements (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wms_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  product_key TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  consumed_at TEXT,
  released_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_wms_reservations_order
  ON wms_reservations (order_id, status);

CREATE TABLE IF NOT EXISTS wms_cycle_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  count_id TEXT NOT NULL UNIQUE,
  product_key TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  qty_system INTEGER NOT NULL,
  qty_counted INTEGER NOT NULL,
  qty_variance INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted',
  memo TEXT,
  actor TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wms_cycle_counts_created
  ON wms_cycle_counts (created_at DESC);

INSERT OR IGNORE INTO wms_warehouses (warehouse_code, name, status, created_at)
VALUES ('WH-MAIN', 'คลังหลัก Terabis', 'active', datetime('now'));

INSERT OR IGNORE INTO wms_locations (location_code, warehouse_code, name, kind, status, created_at)
VALUES
  ('BIN-DEFAULT', 'WH-MAIN', 'ชั้นวางหลัก', 'bin', 'active', datetime('now')),
  ('BIN-QC', 'WH-MAIN', 'กักกัน QC', 'qc', 'active', datetime('now'));

ALTER TABLE goods_receipts ADD COLUMN product_key TEXT;
ALTER TABLE goods_receipts ADD COLUMN location_id INTEGER;
ALTER TABLE assets ADD COLUMN product_key TEXT;
ALTER TABLE assets ADD COLUMN location_id INTEGER;
