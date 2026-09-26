-- Dropship orders to the toner supplier (Color Fly packs in our box and ships
-- straight to the customer). One row per shipment, lines per cartridge model.

CREATE TABLE IF NOT EXISTS dropship_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dropship_id TEXT NOT NULL UNIQUE,
  order_id TEXT,
  supplier TEXT NOT NULL DEFAULT 'COLORFLY',
  status TEXT NOT NULL DEFAULT 'draft',
  ship_to_name TEXT NOT NULL,
  ship_to_phone TEXT NOT NULL,
  ship_to_address TEXT NOT NULL,
  ship_to_province TEXT,
  total_qty INTEGER NOT NULL DEFAULT 0,
  supplier_total_thb REAL NOT NULL DEFAULT 0,
  box_total_thb REAL NOT NULL DEFAULT 0,
  carrier TEXT,
  tracking_no TEXT,
  notes TEXT,
  created_by TEXT,
  sent_at TEXT,
  shipped_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dropship_orders_status
  ON dropship_orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dropship_orders_order
  ON dropship_orders (order_id);

CREATE TABLE IF NOT EXISTS dropship_order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dropship_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  sku TEXT NOT NULL,
  supplier_ref TEXT NOT NULL,
  description TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_supplier_thb REAL NOT NULL,
  unit_box_thb REAL NOT NULL,
  FOREIGN KEY (dropship_id) REFERENCES dropship_orders (dropship_id)
);

CREATE INDEX IF NOT EXISTS idx_dropship_lines_order
  ON dropship_order_lines (dropship_id, line_no);
