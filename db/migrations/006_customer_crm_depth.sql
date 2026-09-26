-- Customer as company card: LINE, tax-invoice defaults, grouping, ship-to vs billing

ALTER TABLE customers ADD COLUMN line_id TEXT;
ALTER TABLE customers ADD COLUMN tax_id TEXT;
ALTER TABLE customers ADD COLUMN billing_name TEXT;
ALTER TABLE customers ADD COLUMN billing_address TEXT;
ALTER TABLE customers ADD COLUMN billing_branch TEXT NOT NULL DEFAULT 'สำนักงานใหญ่';
ALTER TABLE customers ADD COLUMN customer_type TEXT NOT NULL DEFAULT 'company';
ALTER TABLE customers ADD COLUMN source TEXT NOT NULL DEFAULT 'web_rfq';
ALTER TABLE customers ADD COLUMN tags TEXT;
ALTER TABLE customers ADD COLUMN default_ship_province TEXT;
ALTER TABLE customers ADD COLUMN order_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN last_order_at TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_tax_id
  ON customers (tax_id);

CREATE INDEX IF NOT EXISTS idx_customers_type_source
  ON customers (customer_type, source);

ALTER TABLE orders ADD COLUMN ship_to_name TEXT;
ALTER TABLE orders ADD COLUMN ship_to_phone TEXT;
ALTER TABLE orders ADD COLUMN ship_to_address TEXT;
ALTER TABLE orders ADD COLUMN ship_to_province TEXT;
