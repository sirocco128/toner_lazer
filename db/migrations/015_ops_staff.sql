-- Staff accounts for the ops console (RBAC). Passwords are salted hashes.

CREATE TABLE IF NOT EXISTS ops_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  extra_grants TEXT NOT NULL DEFAULT '[]',
  extra_denies TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_ops_staff_active_role
  ON ops_staff (active, role);

CREATE INDEX IF NOT EXISTS idx_ops_staff_email
  ON ops_staff (email);
