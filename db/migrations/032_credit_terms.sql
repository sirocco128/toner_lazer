-- Credit terms for government / corporate buyers: no deposit, invoice on
-- delivery, payment due N days later. Customers carry a default.

ALTER TABLE orders ADD COLUMN credit_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN due_date TEXT;
ALTER TABLE customers ADD COLUMN credit_days INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders (due_date);
