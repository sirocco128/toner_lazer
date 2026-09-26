-- Ops audit trail (roles live in the session cookie, not this table)

CREATE TABLE IF NOT EXISTS ops_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  actor_email TEXT,
  actor_name TEXT,
  role TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  resource_type TEXT,
  resource_id TEXT,
  tool_name TEXT,
  prompt TEXT,
  detail TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_created_at
  ON ops_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_action_created_at
  ON ops_audit_log (action, created_at DESC);
