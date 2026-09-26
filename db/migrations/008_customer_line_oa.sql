-- LINE Official Account link (ops only; gated by LINE_OA_ENABLED)

ALTER TABLE customer_contacts ADD COLUMN line_user_id TEXT;
ALTER TABLE customer_contacts ADD COLUMN line_display_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contacts_line_user
  ON customer_contacts (line_user_id);

CREATE TABLE IF NOT EXISTS line_link_tokens (
  token TEXT PRIMARY KEY NOT NULL,
  contact_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES customer_contacts (id)
);

CREATE INDEX IF NOT EXISTS idx_line_link_tokens_contact
  ON line_link_tokens (contact_id, expires_at);
