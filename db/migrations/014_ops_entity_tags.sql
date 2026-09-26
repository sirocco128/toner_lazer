-- Shared tags for customers, orders (บิลออเดอร์), and cash receipts (ใบรับเงิน)

ALTER TABLE orders ADD COLUMN tags TEXT;
ALTER TABLE cash_receipts ADD COLUMN tags TEXT;

CREATE TABLE IF NOT EXISTS ops_tag_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tag, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_ops_tag_links_entity
  ON ops_tag_links (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_ops_tag_links_tag
  ON ops_tag_links (tag);
