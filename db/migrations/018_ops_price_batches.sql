-- Saved pricing configs + import preview batches (factory xlsx → web sell ladder)

CREATE TABLE IF NOT EXISTS ops_price_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_ops_price_configs_updated
  ON ops_price_configs (updated_at DESC);

CREATE TABLE IF NOT EXISTS ops_price_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id INTEGER,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'preview',
  row_count INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  applied_at TEXT,
  applied_by TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  FOREIGN KEY (config_id) REFERENCES ops_price_configs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_price_batches_created
  ON ops_price_batches (created_at DESC);
