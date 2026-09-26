-- Factory PO (China) + double-entry ledger for management accounts

CREATE TABLE IF NOT EXISTS ledger_accounts (
  code TEXT PRIMARY KEY NOT NULL,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO ledger_accounts (code, name_th, name_en, type, sort_order) VALUES
  ('1110', 'เงินสด / พร้อมเพย์', 'Cash / PromptPay', 'asset', 10),
  ('1120', 'ลูกหนี้การค้า', 'Accounts receivable', 'asset', 20),
  ('1130', 'สินค้าระหว่างทาง', 'Goods in transit', 'asset', 30),
  ('2110', 'เงินมัดจำรับล่วงหน้า', 'Unearned deposit', 'liability', 40),
  ('2120', 'ภาษีมูลค่าเพิ่มรอนำส่ง', 'Output VAT', 'liability', 50),
  ('2130', 'เจ้าหนี้โรงงาน', 'Factory payable', 'liability', 60),
  ('2140', 'เจ้าหนี้ขนส่งและนำเข้า', 'Freight / import payable', 'liability', 70),
  ('4100', 'รายได้ขายสินค้า', 'Sales revenue', 'revenue', 80),
  ('5100', 'ต้นทุนสินค้าโรงงาน', 'Factory COGS', 'cogs', 90),
  ('5200', 'ค่าขนส่งจีน–ไทย', 'CN–TH freight', 'cogs', 100),
  ('5300', 'ค่าภาษีนำเข้าและพิธีการ', 'Import duty / customs', 'cogs', 110),
  ('5400', 'ค่าจัดส่งถึงลูกค้า', 'Last-mile delivery', 'expense', 120),
  ('5500', 'ค่าแพ็กในไทย', 'Local packing', 'expense', 130);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT NOT NULL UNIQUE,
  source_key TEXT NOT NULL UNIQUE,
  entry_date TEXT NOT NULL,
  memo TEXT NOT NULL,
  order_id TEXT,
  po_id TEXT,
  posted_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date
  ON journal_entries (entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_order
  ON journal_entries (order_id);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  account_code TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  memo TEXT,
  FOREIGN KEY (entry_id) REFERENCES journal_entries (entry_id),
  FOREIGN KEY (account_code) REFERENCES ledger_accounts (code)
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry
  ON journal_lines (entry_id, line_no);

CREATE TABLE IF NOT EXISTS factory_pos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  factory_name TEXT NOT NULL,
  factory_contact TEXT,
  factory_platform TEXT NOT NULL DEFAULT 'other',
  source_offer_id TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  color TEXT,
  material TEXT,
  decoration_method TEXT,
  logo_position TEXT,
  logo_notes TEXT,
  packaging_notes TEXT,
  qc_notes TEXT,
  fx_cny_thb REAL NOT NULL DEFAULT 5,
  factory_unit_cny REAL NOT NULL DEFAULT 0,
  factory_amount_cny REAL NOT NULL DEFAULT 0,
  factory_thb REAL NOT NULL DEFAULT 0,
  inland_thb REAL NOT NULL DEFAULT 0,
  freight_thb REAL NOT NULL DEFAULT 0,
  import_duty_thb REAL NOT NULL DEFAULT 0,
  customs_fee_thb REAL NOT NULL DEFAULT 0,
  packing_thb REAL NOT NULL DEFAULT 0,
  last_mile_thb REAL NOT NULL DEFAULT 0,
  landed_total_thb REAL NOT NULL DEFAULT 0,
  freight_mode TEXT,
  ship_to_name TEXT,
  ship_to_phone TEXT,
  ship_to_address TEXT,
  ship_to_province TEXT,
  tracking_cn TEXT,
  tracking_th TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (order_id)
);

CREATE INDEX IF NOT EXISTS idx_factory_pos_order
  ON factory_pos (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_factory_pos_status
  ON factory_pos (status, created_at DESC);
