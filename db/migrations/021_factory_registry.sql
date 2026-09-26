-- Factory vendor master (who we order from). Distinct from ori product codes
-- and from commercial SKU A/B/C/D. Linked to factory_pos and (in MySQL) sg_ori_products.

CREATE TABLE IF NOT EXISTS factories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  factory_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_cn TEXT,
  legal_name TEXT,
  platform TEXT NOT NULL DEFAULT 'other',
  shop_url TEXT,
  shop_id TEXT,
  origin TEXT,
  city TEXT,
  address TEXT,
  contact_name TEXT,
  wechat TEXT,
  phone TEXT,
  email TEXT,
  default_currency TEXT NOT NULL DEFAULT 'CNY',
  payment_terms TEXT,
  bank_name TEXT,
  bank_account TEXT,
  alipay TEXT,
  moq_notes TEXT,
  lead_days INTEGER,
  qc_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_factories_status_name
  ON factories (status, name);

CREATE INDEX IF NOT EXISTS idx_factories_code
  ON factories (factory_code);

ALTER TABLE factory_pos ADD COLUMN factory_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_factory_pos_factory
  ON factory_pos (factory_id);
