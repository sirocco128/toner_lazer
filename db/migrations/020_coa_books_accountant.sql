-- Complete Thai SME chart of accounts + journal books for management accounts.

ALTER TABLE journal_entries ADD COLUMN book_type TEXT NOT NULL DEFAULT 'general';

ALTER TABLE supplier_payments ADD COLUMN payable_kind TEXT NOT NULL DEFAULT 'factory';

ALTER TABLE ledger_accounts ADD COLUMN normal_balance TEXT NOT NULL DEFAULT 'debit';
ALTER TABLE ledger_accounts ADD COLUMN is_header INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ledger_accounts ADD COLUMN is_postable INTEGER NOT NULL DEFAULT 1;

UPDATE ledger_accounts SET normal_balance = 'credit'
  WHERE type IN ('liability', 'equity', 'revenue');

UPDATE journal_entries SET book_type = 'cash_in' WHERE source_key LIKE 'cash:%';
UPDATE journal_entries SET book_type = 'cash_out' WHERE source_key LIKE 'spay:%';
UPDATE journal_entries SET book_type = 'sales' WHERE source_key LIKE 'revenue:%';
UPDATE journal_entries SET book_type = 'purchase'
  WHERE source_key LIKE 'cogs:%'
     OR source_key LIKE 'git:%'
     OR source_key LIKE 'inv:%';

INSERT OR IGNORE INTO ledger_accounts
  (code, name_th, name_en, type, sort_order, normal_balance, is_header, is_postable)
VALUES
  ('1000', 'สินทรัพย์', 'Assets', 'asset', 1, 'debit', 1, 0),
  ('1100', 'สินทรัพย์หมุนเวียน', 'Current assets', 'asset', 5, 'debit', 1, 0),
  ('1140', 'สินค้าคงเหลือ', 'Merchandise inventory', 'asset', 32, 'debit', 0, 1),
  ('1150', 'ภาษีซื้อ', 'Input VAT', 'asset', 34, 'debit', 0, 1),
  ('1190', 'สินทรัพย์หมุนเวียนอื่น', 'Other current assets', 'asset', 38, 'debit', 0, 1),
  ('2000', 'หนี้สิน', 'Liabilities', 'liability', 39, 'credit', 1, 0),
  ('2100', 'หนี้สินหมุนเวียน', 'Current liabilities', 'liability', 39, 'credit', 1, 0),
  ('3000', 'ส่วนของเจ้าของ', 'Equity', 'equity', 71, 'credit', 1, 0),
  ('3100', 'ทุนจดทะเบียน', 'Share capital', 'equity', 72, 'credit', 0, 1),
  ('3200', 'กำไรสะสม', 'Retained earnings', 'equity', 74, 'credit', 0, 1),
  ('4000', 'รายได้', 'Revenue', 'revenue', 79, 'credit', 1, 0),
  ('4200', 'รายได้อื่น', 'Other income', 'revenue', 82, 'credit', 0, 1),
  ('4300', 'กำไรจากอัตราแลกเปลี่ยน', 'Foreign exchange gain', 'revenue', 84, 'credit', 0, 1),
  ('5000', 'ต้นทุนขาย', 'Cost of goods sold', 'cogs', 89, 'debit', 1, 0),
  ('5600', 'ขาดทุนจากอัตราแลกเปลี่ยน', 'Foreign exchange loss', 'expense', 132, 'debit', 0, 1),
  ('5700', 'ค่าใช้จ่ายสำนักงาน', 'Office / admin expense', 'expense', 134, 'debit', 0, 1),
  ('5800', 'ค่าเสื่อมราคา', 'Depreciation', 'expense', 136, 'debit', 0, 1);

UPDATE ledger_accounts SET name_th = 'เงินสด / พร้อมเพย์', name_en = 'Cash / PromptPay',
  type = 'asset', normal_balance = 'debit', is_postable = 1, is_header = 0 WHERE code = '1110';
UPDATE ledger_accounts SET name_th = 'ลูกหนี้การค้า', name_en = 'Accounts receivable',
  type = 'asset', normal_balance = 'debit', is_postable = 1, is_header = 0 WHERE code = '1120';
UPDATE ledger_accounts SET name_th = 'สินค้าระหว่างทาง', name_en = 'Goods in transit',
  type = 'asset', normal_balance = 'debit', is_postable = 1, is_header = 0 WHERE code = '1130';
UPDATE ledger_accounts SET name_th = 'เงินมัดจำรับล่วงหน้า', name_en = 'Unearned deposit',
  type = 'liability', normal_balance = 'credit', is_postable = 1, is_header = 0 WHERE code = '2110';
UPDATE ledger_accounts SET name_th = 'ภาษีขายรอนำส่ง', name_en = 'Output VAT payable',
  type = 'liability', normal_balance = 'credit', is_postable = 1, is_header = 0 WHERE code = '2120';
UPDATE ledger_accounts SET name_th = 'เจ้าหนี้โรงงาน', name_en = 'Factory payable',
  type = 'liability', normal_balance = 'credit', is_postable = 1, is_header = 0 WHERE code = '2130';
UPDATE ledger_accounts SET name_th = 'เจ้าหนี้ขนส่งและนำเข้า', name_en = 'Freight / import payable',
  type = 'liability', normal_balance = 'credit', is_postable = 1, is_header = 0 WHERE code = '2140';
UPDATE ledger_accounts SET name_th = 'รายได้ขายสินค้า', name_en = 'Sales revenue',
  type = 'revenue', normal_balance = 'credit', is_postable = 1, is_header = 0 WHERE code = '4100';
UPDATE ledger_accounts SET name_th = 'ต้นทุนสินค้าโรงงาน', name_en = 'Factory COGS',
  type = 'cogs', normal_balance = 'debit', is_postable = 1, is_header = 0 WHERE code = '5100';
UPDATE ledger_accounts SET name_th = 'ค่าขนส่งจีน–ไทย', name_en = 'CN–TH freight',
  type = 'cogs', normal_balance = 'debit', is_postable = 1, is_header = 0 WHERE code = '5200';
UPDATE ledger_accounts SET name_th = 'ค่าภาษีนำเข้าและพิธีการ', name_en = 'Import duty / customs',
  type = 'cogs', normal_balance = 'debit', is_postable = 1, is_header = 0 WHERE code = '5300';
UPDATE ledger_accounts SET name_th = 'ค่าจัดส่งถึงลูกค้า', name_en = 'Last-mile delivery',
  type = 'expense', normal_balance = 'debit', is_postable = 1, is_header = 0 WHERE code = '5400';
UPDATE ledger_accounts SET name_th = 'ค่าแพ็กในไทย', name_en = 'Local packing',
  type = 'expense', normal_balance = 'debit', is_postable = 1, is_header = 0 WHERE code = '5500';

CREATE INDEX IF NOT EXISTS idx_journal_entries_book
  ON journal_entries (book_type, entry_date DESC);
