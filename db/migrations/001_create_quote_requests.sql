-- Quote requests (35 columns) + rate limits
-- Applied by scripts/migrate.mjs (PRAGMA set there)

CREATE TABLE IF NOT EXISTS quote_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  submitted_at TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  budget_per_set REAL,
  needed_date TEXT,
  province TEXT,
  product_interest TEXT,
  product_slug TEXT,
  decoration_method TEXT NOT NULL,
  detail TEXT,
  consent_at TEXT NOT NULL,
  landing_path TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  lead_status TEXT NOT NULL DEFAULT 'new',
  webhook_status TEXT NOT NULL DEFAULT 'pending',
  webhook_attempt_count INTEGER NOT NULL DEFAULT 0,
  webhook_error TEXT,
  webhook_delivered_at TEXT,
  webhook_last_attempt_at TEXT,
  webhook_next_attempt_at TEXT,
  raw_payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at
  ON quote_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_requests_lead_status_created_at
  ON quote_requests (lead_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_requests_company
  ON quote_requests (company);

CREATE INDEX IF NOT EXISTS idx_quote_requests_webhook_retry
  ON quote_requests (webhook_status, webhook_next_attempt_at, webhook_attempt_count);

CREATE TABLE IF NOT EXISTS quote_rate_limits (
  key_hash TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (key_hash, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_quote_rate_limits_updated_at
  ON quote_rate_limits (updated_at);
