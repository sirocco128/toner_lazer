-- Append-only sales timeline per RFQ (status changes + sales notes).
-- Latest snapshot remains on quote_requests.sales_notes for list/assistant views.

CREATE TABLE IF NOT EXISTS quote_sales_timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  actor_email TEXT,
  actor_name TEXT,
  actor_role TEXT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_quote_sales_timeline_request_created
  ON quote_sales_timeline (request_id, created_at DESC, id DESC);

-- Seed history from the current sales_notes snapshot so old RFQs are not blank.
INSERT INTO quote_sales_timeline (
  request_id, created_at, actor_email, actor_name, actor_role,
  from_status, to_status, note
)
SELECT
  request_id,
  COALESCE(updated_at, created_at),
  NULL,
  NULL,
  NULL,
  NULL,
  lead_status,
  sales_notes
FROM quote_requests
WHERE sales_notes IS NOT NULL AND TRIM(sales_notes) != '';
