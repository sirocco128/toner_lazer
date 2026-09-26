# ER Diagrams — Premium Gift Set Web

แหล่งความจริง: `db/migrations/*.sql`, `db/mysql/sg_sku_master.sql`, `cms/src/api/**`  
ความสัมพันธ์ส่วนใหญ่เป็น logical (application-enforced) — SQLite อาจไม่มี FK ครบทุกตาราง

ใน Ops Work Manual บล็อก `mermaid` จะเรนเดอร์เป็นแผนภาพ SVG อัตโนมัติ (ธีม forest/brass)

---

## ER1. Sales / CRM / Orders / Payments (SQLite)

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e4efe9","primaryTextColor":"#14352a","primaryBorderColor":"#1e4a3a","lineColor":"#9a7b3c","secondaryColor":"#f0ebe3","tertiaryColor":"#d7e6de","background":"#f7f4ef","fontFamily":"Segoe UI, Sarabun, sans-serif","fontSize":"14px"}}}%%
erDiagram
  customers ||--o{ customer_contacts : has
  customers ||--o{ quote_requests : has
  customers ||--o{ orders : has
  customers ||--o{ customer_merges : merge_target
  quote_requests ||--o{ quote_sales_timeline : history
  quote_requests |o--o| orders : may_become
  orders ||--o{ payments : has
  orders ||--o{ billing_documents : has
  orders ||--o{ order_events : history
  payments ||--o{ payment_slips : uploads
  cash_receipts ||--o{ cash_receipt_lines : lines
  cash_receipts }o--|| orders : optional
  contact_inquiries }o--o| customers : optional

  customers {
    text id PK
    text company_name
    text tax_id
    text customer_type
    int quote_count
    int order_count
  }
  customer_contacts {
    text id PK
    text customer_id FK
    text name
    text email
    text phone
    text line_user_id
    int is_primary
  }
  quote_requests {
    text id PK
    text customer_id FK
    text status
    text product_summary
    int quantity
    text access_token
    text webhook_state
  }
  orders {
    text id PK
    text customer_id FK
    text quote_request_id FK
    text payment_status
    text fulfillment_status
    real total_incl_vat
    real deposit_amount
    text access_token
  }
  payments {
    text id PK
    text order_id FK
    text kind
    real amount
    text status
  }
  payment_slips {
    text id PK
    text payment_id FK
    text object_key
    real expected_amount
    real extracted_amount
    text check_status
  }
  billing_documents {
    text id PK
    text order_id FK
    text doc_type
    text doc_number
  }
  cash_receipts {
    text id PK
    text access_token
    text approval_status
  }
```

---

## ER2. Factory / Warehouse / Claims (SQLite)

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e4efe9","primaryTextColor":"#14352a","primaryBorderColor":"#1e4a3a","lineColor":"#9a7b3c","secondaryColor":"#f0ebe3","tertiaryColor":"#d7e6de","background":"#f7f4ef","fontFamily":"Segoe UI, Sarabun, sans-serif","fontSize":"14px"}}}%%
erDiagram
  factories ||--o{ factory_pos : supplies
  orders ||--o{ factory_pos : procures
  factory_pos ||--o{ goods_receipts : receives
  factory_pos ||--o{ supplier_payments : pays
  goods_receipts ||--o{ assets : may_create
  goods_receipts ||--o{ claims : may_open
  issue_tickets ||--o| claims : may_escalate

  factories {
    text id PK
    text name
    text country
    text currency
    text payment_terms
  }
  factory_pos {
    text id PK
    text order_id FK
    text factory_id FK
    text status
    real cost_cny
    real fx_rate
    text tracking_no
    text destination
  }
  goods_receipts {
    text id PK
    text factory_po_id FK
    int qty_ordered
    int qty_received
    int qty_damaged
    int qty_shortage
    text qc_notes
  }
  supplier_payments {
    text id PK
    text factory_po_id FK
    text kind
    real amount
  }
  assets {
    text id PK
    text lot_code
    text warehouse
    int quantity
  }
  claims {
    text id PK
    text against
    text status
    real amount
  }
  issue_tickets {
    text id PK
    text source
    text status
    text category
  }
```

---

## ER3. Finance / Staff / Schedule / Compliance (SQLite)

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e4efe9","primaryTextColor":"#14352a","primaryBorderColor":"#1e4a3a","lineColor":"#9a7b3c","secondaryColor":"#f0ebe3","tertiaryColor":"#d7e6de","background":"#f7f4ef","fontFamily":"Segoe UI, Sarabun, sans-serif","fontSize":"14px"}}}%%
erDiagram
  ledger_accounts ||--o{ journal_lines : posted_to
  journal_entries ||--o{ journal_lines : contains
  journal_entries }o--o| orders : optional
  journal_entries }o--o| factory_pos : optional
  ops_staff ||--o{ schedule_events : owns
  schedule_events ||--o{ schedule_attendees : has
  ops_staff ||--o{ schedule_availability : weekly
  ops_staff ||--o{ ops_audit_log : acts
  object_legal_holds }o--|| ops_staff : held_by

  ledger_accounts {
    text code PK
    text name
    text account_type
    text normal_balance
  }
  journal_entries {
    text id PK
    text source_key
    text memo
    text posted_at
  }
  journal_lines {
    text id PK
    text entry_id FK
    text account_code FK
    real debit
    real credit
  }
  ops_staff {
    text id PK
    text email
    text role
    text department
    text booking_slug
    text password_hash
  }
  schedule_events {
    text id PK
    text title
    text starts_at
    text status
  }
  object_legal_holds {
    text id PK
    text object_type
    text object_id
    text action
    text active
  }
```

---

## ER4. Commercial Catalog (MySQL SmartGift)

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e4efe9","primaryTextColor":"#14352a","primaryBorderColor":"#1e4a3a","lineColor":"#9a7b3c","secondaryColor":"#f0ebe3","tertiaryColor":"#d7e6de","background":"#f7f4ef","fontFamily":"Segoe UI, Sarabun, sans-serif","fontSize":"14px"}}}%%
erDiagram
  sg_ori_products ||--o{ sg_sku : derives
  sg_sku ||--o{ sg_sku_serial : stock
  sg_sku ||--o{ sg_sku_file : files
  sg_sku ||--o{ sg_sku_tag : tags
  sg_sku ||--o{ sg_sku_bundle_item : parent
  sg_sku ||--o{ sg_sku_bundle_item : component
  sg_sku_group ||--o{ sg_sku_group_item : members
  sg_sku ||--o{ sg_sku_group_item : in_group
  master_basic_colors ||--o{ sg_sku : color
  sg_offer ||--o{ sg_offer_item : items
  sg_offer ||--o{ sg_offer_price : tiers

  sg_ori_products {
    varchar ori_id PK
    varchar factory_name
    varchar source_url
  }
  sg_sku {
    varchar sku_id PK
    varchar ori_id FK
    char class
    varchar name_th
    decimal landed_cost
    decimal sell_price
  }
  sg_sku_bundle_item {
    varchar parent_sku FK
    varchar component_sku FK
    int qty
  }
  sg_offer {
    varchar offer_id PK
    varchar title
  }
```

**SKU class:** A สต็อก · B สั่งผลิต · C เคลียร์/ของเสีย · D fill-in

---

## ER5. Strapi CMS (PostgreSQL)

```mermaid
%%{init: {"theme":"base","themeVariables":{"primaryColor":"#e4efe9","primaryTextColor":"#14352a","primaryBorderColor":"#1e4a3a","lineColor":"#9a7b3c","secondaryColor":"#f0ebe3","tertiaryColor":"#d7e6de","background":"#f7f4ef","fontFamily":"Segoe UI, Sarabun, sans-serif","fontSize":"14px"}}}%%
erDiagram
  gift_set_category ||--o{ product : contains
  product ||--o| seo : has
  article ||--o| seo : has
  portfolio ||--o| seo : has

  gift_set_category {
    int id PK
    string slug
    string name
  }
  product {
    int id PK
    string slug
    string title
    json moq_price
  }
  article {
    int id PK
    string slug
    string status
  }
  portfolio {
    int id PK
    string slug
  }
  faq {
    int id PK
    int sort_order
  }
  seo {
    string meta_title
    string meta_description
    boolean no_index
  }
```

---

## แผนที่ฐานข้อมูลรวม

| ฐานข้อมูล | ใช้กับ | ตัวอย่างตาราง |
|-----------|--------|----------------|
| SQLite | Ops / RFQ / Orders / Finance | `customers`, `orders`, `factory_pos` |
| MySQL SmartGift | SKU / Offer / Article overlay | `sg_sku`, `sg_offer` |
| PostgreSQL | Strapi content | Product, Article, Portfolio |
| MinIO | ไฟล์/สลิป/แคตตาล็อก | object keys ในตารางไฟล์ |
