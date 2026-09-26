-- Legal hold for customer / accounting documents (WORM companion).
-- Append-only history: releasing a hold updates released_* and does not delete the row.

CREATE TABLE IF NOT EXISTS object_legal_holds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_key TEXT NOT NULL,
  bucket TEXT,
  reason TEXT NOT NULL,
  case_ref TEXT,
  held_by_email TEXT NOT NULL,
  held_by_name TEXT,
  held_at TEXT NOT NULL,
  released_by_email TEXT,
  released_by_name TEXT,
  released_at TEXT,
  release_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_object_legal_holds_key_active
  ON object_legal_holds (object_key, released_at);

CREATE INDEX IF NOT EXISTS idx_object_legal_holds_held_at
  ON object_legal_holds (held_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_object_legal_holds_one_active
  ON object_legal_holds (object_key)
  WHERE released_at IS NULL;
