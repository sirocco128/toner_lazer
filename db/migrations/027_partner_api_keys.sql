-- Machine-to-machine partner API keys (hashed secrets, scoped, revocable)

CREATE TABLE IF NOT EXISTS partner_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  revoked_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_api_keys_enabled
  ON partner_api_keys (enabled, revoked_at);
