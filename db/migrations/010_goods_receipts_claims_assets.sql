-- Goods receipt vs ship-to, supplier pay vs received qty, cash receipt lines, assets, claims, issues

ALTER TABLE factory_pos ADD COLUMN destination_mode TEXT NOT NULL DEFAULT 'warehouse';
ALTER TABLE factory_pos ADD COLUMN received_qty INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS goods_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id TEXT NOT NULL UNIQUE,
  po_id TEXT NOT NULL,
  order_id TEXT,
  destination TEXT NOT NULL DEFAULT 'warehouse',
  qty_ordered INTEGER NOT NULL,
  qty_received INTEGER NOT NULL,
  qty_damaged INTEGER NOT NULL DEFAULT 0,
  qty_short INTEGER NOT NULL DEFAULT 0,
  unit_thb REAL NOT NULL DEFAULT 0,
  amount_thb REAL NOT NULL DEFAULT 0,
  qc_notes TEXT,
  tracking_th TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  received_at TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goods_receipts_po
  ON goods_receipts (po_id, received_at DESC);

CREATE TABLE IF NOT EXISTS cash_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id TEXT NOT NULL UNIQUE,
  order_id TEXT,
  payer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  total_amount REAL NOT NULL DEFAULT 0,
  qr_payload TEXT,
  method TEXT NOT NULL DEFAULT 'promptpay_qr',
  confirmed_at TEXT,
  confirmed_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cash_receipts_status
  ON cash_receipts (status, created_at DESC);

CREATE TABLE IF NOT EXISTS cash_receipt_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_id TEXT,
  order_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_cash_receipt_lines_voucher
  ON cash_receipt_lines (voucher_id, line_no);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pay_id TEXT NOT NULL UNIQUE,
  po_id TEXT NOT NULL,
  receipt_id TEXT,
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'bank',
  status TEXT NOT NULL DEFAULT 'posted',
  paid_at TEXT NOT NULL,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_po
  ON supplier_payments (po_id, paid_at DESC);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'inventory_lot',
  name TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'ชิ้น',
  value_thb REAL NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT 'warehouse',
  po_id TEXT,
  order_id TEXT,
  receipt_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_status
  ON assets (status, created_at DESC);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id TEXT NOT NULL UNIQUE,
  against TEXT NOT NULL DEFAULT 'factory',
  po_id TEXT,
  order_id TEXT,
  receipt_id TEXT,
  issue_id TEXT,
  qty INTEGER NOT NULL DEFAULT 0,
  amount_thb REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_status
  ON claims (status, created_at DESC);

CREATE TABLE IF NOT EXISTS issue_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'ops',
  company TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  order_id TEXT,
  po_id TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_issue_tickets_status
  ON issue_tickets (status, created_at DESC);
