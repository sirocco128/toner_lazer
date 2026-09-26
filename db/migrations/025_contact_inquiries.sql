-- Public contact / inquiry / complaint form (not RFQ)

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inquiry_id TEXT NOT NULL UNIQUE,
  submitted_at TEXT NOT NULL,
  topic TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  callback_channel TEXT NOT NULL,
  message TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  mail_status TEXT NOT NULL DEFAULT 'pending',
  mail_error TEXT,
  mail_sent_at TEXT,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  landing_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created_at
  ON contact_inquiries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status_created_at
  ON contact_inquiries (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_topic
  ON contact_inquiries (topic);
