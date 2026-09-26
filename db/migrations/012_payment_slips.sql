-- Payment transfer slips + cash-receipt public notify token

ALTER TABLE cash_receipts ADD COLUMN access_token TEXT;

CREATE TABLE IF NOT EXISTS payment_slips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slip_id TEXT NOT NULL UNIQUE,
  payment_id TEXT,
  voucher_id TEXT,
  file_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  original_name TEXT,
  check_status TEXT NOT NULL DEFAULT 'pending',
  expected_amount REAL NOT NULL,
  extracted_amount REAL,
  extracted_payee TEXT,
  extracted_promptpay TEXT,
  extracted_time TEXT,
  extracted_ref TEXT,
  notes TEXT,
  model TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_slips_payment
  ON payment_slips (payment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_slips_voucher
  ON payment_slips (voucher_id, created_at DESC);
