-- Multiple contacts per company + merge. Email uniqueness moves to contacts.

ALTER TABLE customers ADD COLUMN merged_into_id INTEGER;

DROP INDEX IF EXISTS idx_customers_email_nocase;

CREATE INDEX IF NOT EXISTS idx_customers_email_lookup
  ON customers (email COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS customer_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  line_id TEXT,
  role_title TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  is_billing INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contacts_email_nocase
  ON customer_contacts (email COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer
  ON customer_contacts (customer_id, is_primary DESC);

INSERT INTO customer_contacts (
  customer_id, name, email, phone, line_id, role_title,
  is_primary, is_billing, status, notes, created_at, updated_at
)
SELECT
  id,
  contact_name,
  email,
  phone,
  line_id,
  NULL,
  1,
  1,
  'active',
  NULL,
  created_at,
  updated_at
FROM customers
WHERE merged_into_id IS NULL
  AND email IS NOT NULL
  AND trim(email) != ''
  AND NOT EXISTS (
    SELECT 1 FROM customer_contacts c WHERE c.email = customers.email COLLATE NOCASE
  );

CREATE TABLE IF NOT EXISTS customer_merges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  actor_email TEXT,
  created_at TEXT NOT NULL
);
