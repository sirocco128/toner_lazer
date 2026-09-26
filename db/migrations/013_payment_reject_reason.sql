-- Accounting can reject a submitted slip with a required reason.
-- Customer may re-upload; paid amount is unchanged until approve.

ALTER TABLE payments ADD COLUMN reject_reason TEXT;
ALTER TABLE cash_receipts ADD COLUMN reject_reason TEXT;
