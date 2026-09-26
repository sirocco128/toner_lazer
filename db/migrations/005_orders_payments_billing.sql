-- Thai B2B revenue cycle: orders, PromptPay payments, VAT documents
-- ใบแจ้งหนี้ / ใบเสร็จรับเงินมัดจำ / ใบกำกับภาษี

CREATE TABLE IF NOT EXISTS document_sequences (
  kind TEXT NOT NULL,
  period TEXT NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, period)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  quote_request_id TEXT UNIQUE,
  customer_id INTEGER,
  company TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  billing_name TEXT NOT NULL,
  billing_tax_id TEXT,
  billing_address TEXT,
  billing_branch TEXT NOT NULL DEFAULT 'สำนักงานใหญ่',
  product_summary TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  currency TEXT NOT NULL DEFAULT 'THB',
  vat_rate REAL NOT NULL DEFAULT 7,
  vat_mode TEXT NOT NULL DEFAULT 'exclusive',
  subtotal_ex_vat REAL NOT NULL,
  vat_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  deposit_mode TEXT NOT NULL,
  deposit_percent REAL NOT NULL,
  deposit_amount REAL NOT NULL,
  remaining_amount REAL NOT NULL,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL DEFAULT 'reserved',
  access_token TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_email
  ON orders (email COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON orders (customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders (payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment
  ON orders (fulfillment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'promptpay_qr',
  status TEXT NOT NULL DEFAULT 'pending',
  qr_payload TEXT,
  customer_reference TEXT,
  confirmed_at TEXT,
  confirmed_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (order_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id
  ON payments (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments (status, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  subtotal_ex_vat REAL NOT NULL,
  vat_amount REAL NOT NULL,
  grand_total REAL NOT NULL,
  amount_text TEXT NOT NULL,
  line_description TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  voided_at TEXT,
  buyer_name TEXT NOT NULL,
  buyer_tax_id TEXT,
  buyer_address TEXT,
  buyer_branch TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (order_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_documents_order_id
  ON billing_documents (order_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  actor TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id
  ON order_events (order_id, created_at ASC);
