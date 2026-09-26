-- History of Terabis knowledge updates triggered from Ops (/ops/knowledge-sync)

CREATE TABLE IF NOT EXISTS ops_knowledge_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  actor_email TEXT,
  actor_name TEXT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  changed_count INTEGER NOT NULL DEFAULT 0,
  written_json TEXT,
  changes_json TEXT,
  catalog_json TEXT,
  summary TEXT,
  source TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ops_knowledge_sync_log_created
  ON ops_knowledge_sync_log (created_at DESC);
