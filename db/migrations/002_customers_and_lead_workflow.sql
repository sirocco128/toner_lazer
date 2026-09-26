-- Customers CRM + quote sales workflow fields

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  contact_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  quote_count INTEGER NOT NULL DEFAULT 0,
  last_quote_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_nocase
  ON customers (email COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_customers_company
  ON customers (company COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_customers_updated_at
  ON customers (updated_at DESC);

ALTER TABLE quote_requests ADD COLUMN customer_id INTEGER;
ALTER TABLE quote_requests ADD COLUMN sales_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_quote_requests_customer_id
  ON quote_requests (customer_id);
