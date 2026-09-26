-- Persist the VAT branch chosen on the public quote form.

ALTER TABLE quote_requests ADD COLUMN billing_branch TEXT;
