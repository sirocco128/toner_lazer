# WMS operations notes

คู่กับ: [SOP-CYCLE.md](./SOP-CYCLE.md) · ออกแบบ Cross-Dock / ASN: [WMS-CROSS-DOCK-FLOW.md](./WMS-CROSS-DOCK-FLOW.md)

## Local cutover checklist

1. `npm run db:migrate` — SQLite `029_wms_core.sql` + `030_asn_cross_dock.sql`
2. `node scripts/apply-wms-mysql.mjs` — create MySQL `wms_*` tables (รวม `BIN-XDOCK`)
3. `node scripts/sync-wms-mysql.mjs` — push SQLite balances + mirror `sg_sku.on_hand_qty`
4. Set `WMS_STORE=mysql` and `SMARTGIFT_MYSQL_ENABLED=true` in `.env.local`

Ops truth for mutations remains the SQLite ops DB; with `WMS_STORE=mysql` each mutation also mirrors balances into MySQL and updates matching `sg_sku` rows.

## Cross-dock / ASN (MTO)

- Factory PO: `receive_mode` (default `cross_dock`), `asn_eta`, `asn_qty`, `asn_container`
- Receive warehouse → `BIN-XDOCK` when cross-dock; stock mode → `BIN-DEFAULT`
- Ops queues on `/ops/stock`: In-transit · Cross-dock · พร้อมแพ็ก
- Ship Confirm on order detail → `out_for_delivery` (cuts reservation)
- Packing slip: `/ops/orders/{orderId}/pack`

รายละเอียด: [WMS-CROSS-DOCK-FLOW.md](./WMS-CROSS-DOCK-FLOW.md)

## Product key ↔ SKU master

Inbound `productKey` should prefer `sg_sku.product_id` (e.g. `B00001`).  
Mirror also matches `catalog_slug` and `ori_product_code` (case-insensitive).

## Partner API

`GET /api/partner/v1/promotions` and `/retail` include `onHandQty` (physical on-hand from `sg_sku`).

## บัตรคุมสินค้า (Stock Card)

หน้าพิมพ์แบบบัญชีคุมสินค้าคงเหลือ: `/ops/stock/{productKey}/card`

คอลัมน์: วันเดือนปี · เลขที่เอกสาร · รายการ · รับเข้า · จ่ายออก · คงเหลือ  
กรองช่วงวันที่ (ค่าเริ่มต้น = เดือนปัจจุบัน ตาม Asia/Bangkok) และที่เก็บได้  
หัวเอกสารใช้ชื่อนิติบุคคล + เลขผู้เสียภาษีจาก `lib/company.ts`

## Deferred (not in this cut)

| Item | Status |
|------|--------|
| NextERP inventory write-back | Out of scope — no adapter; WMS does not push to NextERP |
| Barcode / scanner hardware app | Out of scope — Ops UI is keyboard/form only |
| Public `/products` partner browse `onHandQty` | Not added (gift-set offers ≠ SKU warehouse units) |
