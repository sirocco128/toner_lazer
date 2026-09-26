-- Factory quotes may be in CNY (1688) or USD (Alibaba / dollar invoices).
-- fx_cny_thb remains the working THB rate for whichever factory_currency is selected.

ALTER TABLE factory_pos ADD COLUMN factory_currency TEXT NOT NULL DEFAULT 'CNY';
