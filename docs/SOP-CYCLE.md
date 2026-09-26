# SOP ทั้งวงจร — สั่งผลิตสกรีนโลโก้จากจีน จัดส่งไทย

สินค้าที่ลูกค้าขอใบเสนอราคาก่อน แล้วค่อยสั่งผลิตจากจีน สกรีนโลโก้ใส่ได้ **ไม่ใช่ของพร้อมส่ง** และยังไม่ชำระเงินบนเว็บจนกว่าเซลล์เปิดออเดอร์

เอกสารนี้เป็นคู่มือปฏิบัติการภายใน คู่กับ [OPS-CONSOLE.md](./OPS-CONSOLE.md)

คู่มือภาพหน้าจอแบบ SPA (ต้องมีโทเค็น): [/sop](http://localhost:3000/sop)

ลงมือทำทีละขั้น: [SOP-CHECKLIST.md](./SOP-CHECKLIST.md)

---

## 1. มุมลูกค้า (3 ขั้น)

ราคาบนเว็บเป็นช่วงโดยประมาณ ไม่ใช่ใบเสนอราคา

```mermaid
flowchart LR
  %% มุมลูกค้า
  start([เริ่ม]) --> pick["1. เลือกสินค้า"]
  pick --> ask["2. ส่งคำขอใบเสนอราคา"]
  ask --> make["3. อนุมัติแบบแล้วผลิต"]
  make --> done([รับของในไทย])
```

**อ่านยังไง:** ลูกค้าไม่ต้องรู้โรงงาน 1688 ต้นทุน หรือบัญชี — เห็นแค่เลือก ส่งคำขอ แล้วรออนุมัติแบบก่อนผลิต

| ขั้น | หน้า | หมายเหตุ |
|---|---|---|
| เลือกสินค้า | `/` `/products` `/giftset/[category]` | ช่วงราคาโดยประมาณ + สกรีนโลโก้ได้ |
| ส่งคำขอ | `/contact` LINE | ยังไม่ชำระเงิน ยังไม่ใช่ยืนยันสั่งซื้อ |
| อนุมัติแบบแล้วผลิต | เซลล์ติดต่อนอกเว็บ แล้วเปิดออเดอร์ | ตัวอย่างในเว็บไม่ใช่แบบผลิต |

---

## 2. วงจรหลักทั้งเส้น

```mermaid
flowchart TD
  %% SOP ทั้งวงจร — ขอใบเสนอราคาถึงส่งมอบไทย
  start([เริ่ม]) --> browse["เลือกสินค้า ดูช่วงราคาโดยประมาณ"]
  browse --> spec["กำหนดจำนวน สี วิธีสกรีน แพ็ก"]
  spec --> mock["ดูตัวอย่างโลโก้ในเว็บ"]
  mock --> rfq["ส่งคำขอใบเสนอราคา"]
  rfq --> lead[(บันทึกคำขอ + ลูกค้า)]
  lead --> contact["เซลล์ติดต่อ LINE / โทร"]
  contact --> quoted["ส่งใบเสนอราคา"]
  quoted --> approve{"ลูกค้าอนุมัติแบบและราคา?"}
  approve -->|ไม่| lost["สถานะ ไม่สำเร็จ"]
  approve -->|ใช่| order["เปิดออเดอร์ + QR มัดจำ"]
  order --> payDep["ลูกค้าโอนมัดจำ + แนบสลิป"]
  payDep --> slipOk{"บัญชีอนุมัติยอด?"}
  slipOk -->|ไม่| payDep
  slipOk -->|ใช่| factory["เปิดใบสั่งโรงงานจีน"]
  factory --> produce["โรงงานยืนยัน ผลิต QC"]
  produce --> freight["ขนส่งจีนเข้าไทย"]
  freight --> dest{"ปลายทาง?"}
  dest -->|เข้าคลัง| warehouse["รับเข้าคลังไทย"]
  dest -->|ส่งตรง| shipTo["รับแล้วส่งตรงลูกค้า"]
  warehouse --> remain["ออกใบแจ้งหนี้ส่วนที่เหลือ"]
  shipTo --> remain
  remain --> payBal["ชำระส่วนที่เหลือ บัญชีอนุมัติ"]
  payBal --> tax["ออกใบกำกับภาษี"]
  tax --> deliver["จัดส่งถึงลูกค้า"]
  deliver --> done([จบวงจร])
  lost --> stop([จบ — ไม่ขาย])
```

**อ่านยังไง:** ไหลจากบนลงล่างตามงานจริง แยกเส้นเมื่อลูกค้าไม่ซื้อ และเมื่อของเข้าคลังไทยหรือส่งตรงลูกค้า

**ประตูล็อกในระบบ**

- ยังไม่มีมัดจำ → สั่งผลิตไม่ได้
- ยังชำระไม่ครบ → ส่งถึงลูกค้าไม่ได้
- ใบกำกับภาษีออกเมื่อชำระครบ **และ** ของอยู่ที่คลัง / กำลังจัดส่ง / ส่งแล้ว

---

## 3. ใครทำอะไร

| บทบาท | ทำ | ไม่ทำ |
|---|---|---|
| ลูกค้า | เลือกสินค้า ส่งคำขอ อนุมัติแบบ โอนเงิน แนบสลิป ติดตามออเดอร์ แจ้งปัญหา | ไม่เห็นต้นทุนโรงงาน / 1688 |
| เซลล์ | ติดต่อ ร่างราคา เปิดออเดอร์ รับสลิปเข้าระบบ | ไม่เห็นต้นทุนโรงงาน กำไรขั้นต้น ไม่เปิดใบสั่งโรงงาน |
| ผู้ดูแล | ใบสั่งโรงงาน จ่ายโรงงาน งบผู้บริหาร จัดการผู้ใช้ | — |
| บัญชี | อนุมัติหรือปฏิเสธสลิปที่ `/ops/approvals` | ไม่ยืนยันเงินจาก OCR อัตโนมัติ |
| คลัง | รับของตาม PO ลงสต็อก/ล็อต · จองออเดอร์ · ตัดตอนส่ง · ปรับ/โอน/ตรวจนับ · เปิดเคลมของเสีย | จ่ายโรงงานเกินยอดที่รับไม่ได้ · ไม่ตัดสต็อกติดลบ |

```mermaid
flowchart LR
  %% ช่องทางตามบทบาท
  subgraph buyer [ลูกค้า]
    b1["แคตตาล็อก / แบบฟอร์ม"]
    b2["หน้าออเดอร์ / ลิงก์ชำระ"]
  end
  subgraph sales [เซลล์]
    s1["ใบเสนอราคา"]
    s2["เปิดออเดอร์"]
  end
  subgraph admin [ผู้ดูแล]
    a1["ใบสั่งโรงงาน"]
    a2["รับเข้า / จ่ายโรงงาน"]
  end
  subgraph acct [บัญชี]
    c1["อนุมัติสลิป"]
    c2["ใบกำกับภาษี"]
  end
  b1 --> s1 --> s2 --> b2 --> c1
  s2 --> a1 --> a2
  c1 --> c2
```

---

## 4. ลำดับข้อความ — ขอใบเสนอราคา

บันทึกคำขอก่อนทุกอย่าง ถ้า webhook ล้มเหลวต้องไม่ทำคำขอหาย

```mermaid
sequenceDiagram
  autonumber
  actor Customer as ลูกค้า
  participant Web as เว็บ
  participant DB as ฐานข้อมูล
  participant Hook as Webhook
  actor Sales as เซลล์

  Customer->>Web: กรอกแบบฟอร์มขอใบเสนอราคา
  Web->>DB: บันทึกคำขอ + upsert ลูกค้า
  DB-->>Web: รหัสคำขอ
  Web-->>Customer: ได้รับคำขอแล้ว ยังไม่ชำระเงิน
  Web-)Hook: ส่งต่อถ้าตั้งค่าไว้
  Note over Web,Hook: ล้มเหลวแล้วลองใหม่ คำขอไม่หาย
  Sales->>Web: เปิดรายการที่ Ops
  Sales->>Customer: ติดต่อ LINE หรือโทร
  Sales->>Web: สถานะ ส่งใบเสนอราคาแล้ว
```

**อ่านยังไง:** ลูกค้าได้รหัสคำขอทันที เซลล์ทำงานจาก Ops หลังบันทึกสำเร็จ

หน้า: `/contact` → `/ops/quotes` → `/ops/quotes/[requestId]`

สถานะคำขอ: ใหม่ → ติดต่อแล้ว → ส่งใบเสนอราคาแล้ว → ปิดการขาย / ไม่สำเร็จ / เก็บถาวร

---

## 5. ลำดับข้อความ — มัดจำถึงใบกำกับภาษี

กติกา: VAT 7% · มัดจำเต็มจำนวนถ้าบิลรวม VAT ไม่เกิน 10,000 บาท ไม่เช่นนั้น 50% · QR พร้อมเพย์ · ที่อยู่ออกบิลมาจากบัตรภาษีลูกค้า ไม่ใช่จังหวัดจัดส่ง

```mermaid
sequenceDiagram
  autonumber
  actor Customer as ลูกค้า
  participant Web as เว็บ
  actor Sales as เซลล์
  actor Acct as บัญชี

  Sales->>Web: เปิดออเดอร์จากใบที่อนุมัติ
  Web-->>Customer: QR มัดจำ + ใบแจ้งหนี้มัดจำ
  Customer->>Web: โอนและแนบสลิป
  Web->>Web: อ่านสลิปเทียบยอดและบัญชี
  Web->>Acct: คิวรอบัญชีอนุมัติยอด
  alt อนุมัติ
    Acct->>Web: รับเงิน มัดจำเข้า
    Web-->>Sales: ปลดล็อกสั่งผลิต
  else ปฏิเสธ
    Acct-->>Customer: เหตุผล ให้โอนใหม่
  end
  Note over Web: ของถึงคลังหรือส่งตรง
  Web-->>Customer: ใบแจ้งหนี้ส่วนที่เหลือ
  Customer->>Web: โอนส่วนที่เหลือ + สลิป
  Acct->>Web: อนุมัติยอดครบ
  Web-->>Customer: ใบกำกับภาษี + ใบเสร็จ
```

**อ่านยังไง:** OCR ช่วยเทียบสลิป แต่บัญชีกดรับเงินเอง ใบกำกับไม่ออกจนกว่าชำระครบและของถึงขั้นคลังหรือจัดส่ง

หน้า: `/ops/orders` `/pay/[voucherId]` `/ops/approvals` `/ops/receipts`

```mermaid
flowchart TD
  %% SOP รับชำระ
  open["เปิดออเดอร์"] --> invoiceDep["ใบแจ้งหนี้มัดจำ + QR"]
  invoiceDep --> pay["ลูกค้าโอน + แนบสลิป"]
  pay --> ocr["อ่านสลิปเทียบยอด"]
  ocr --> queue["คิวรอบัญชี"]
  queue --> decide{"อนุมัติ?"}
  decide -->|ปฏิเสธ| reason["บันทึกเหตุผล"]
  reason --> pay
  decide -->|อนุมัติ| booked["ลงบัญชีรับเงิน"]
  booked --> gate{"ถึงยอดมัดจำ?"}
  gate -->|ยัง| wait["ยังสั่งผลิตไม่ได้"]
  gate -->|ครบ| produceOk["ปลดล็อกสั่งผลิต"]
  produceOk --> arrive{"ของถึงคลังหรือส่งตรง?"}
  arrive -->|ยัง| waitGoods["รอของ"]
  waitGoods --> arrive
  arrive -->|ถึง| invBal["ใบแจ้งหนี้ส่วนที่เหลือ"]
  invBal --> pay2["โอนส่วนที่เหลือ"]
  pay2 --> queue2["บัญชีอนุมัติ"]
  queue2 --> paid{"ชำระครบและของถึงขั้นส่งมอบ?"}
  paid -->|ยัง| waitTax["ยังไม่ออกใบกำกับ"]
  paid -->|ใช่| tax["ใบกำกับภาษี + ใบเสร็จ"]
  tax --> done([ปิดวงจรเงิน])
```

เอกสารที่ออกตามจังหวะ

| เอกสาร | เมื่อไหร่ |
|---|---|
| ใบแจ้งหนี้มัดจำ | เปิดออเดอร์ |
| ใบเสร็จรับเงินมัดจำ | บัญชีอนุมัติมัดจำ |
| ใบแจ้งหนี้ส่วนที่เหลือ | ของเข้าคลัง หรือส่งตรงลูกค้า |
| ใบกำกับภาษี + ใบเสร็จ | ชำระครบ และของถึงคลัง / กำลังส่ง / ส่งแล้ว |

สถานะสลิปแต่ละงวด: รอชำระ → รอบัญชีอนุมัติยอด → รับชำระแล้ว / บัญชีปฏิเสธ / หมดอายุ

---

## 6. ลำดับข้อความ — โรงงาน รับของ จ่ายโรงงาน

ใบสั่งโรงงานเป็นงานผู้ดูแล เซลล์ไม่เห็นต้นทุนโรงงาน

```mermaid
sequenceDiagram
  autonumber
  actor Admin as ผู้ดูแล
  participant Ops as Ops
  participant Factory as โรงงานจีน
  actor Wh as คลังไทย

  Admin->>Ops: ร่างใบสั่ง สเปคโลโก้ + ต้นทุน
  Ops->>Factory: ส่งใบสั่ง
  Factory-->>Ops: ยืนยัน — ลงบัญชีต้นทุน
  Factory->>Factory: ผลิต QC
  Factory->>Ops: ออกจากจีน
  Factory->>Wh: ถึงไทย
  alt เข้าคลังไทย
    Wh->>Ops: รับเข้า ลงล็อตสินค้า
  else ส่งตรงลูกค้า
    Wh->>Ops: รับแล้วข้ามคลัง
  end
  opt ของเสียตอนรับ
    Ops->>Ops: เปิดเคลมโรงงานอัตโนมัติ
  end
  Admin->>Ops: จ่ายโรงงานไม่เกินยอดที่รับ
```

**อ่านยังไง:** จ่ายโรงงานตามของที่รับจริง ไม่จ่ายตามยอดสั่งล่วงหน้าทั้งก้อนถ้ายังรับไม่ครบ

```mermaid
flowchart TD
  %% SOP ใบสั่งโรงงาน
  poDraft["ร่างใบสั่งโรงงาน"] --> sentPo["ส่งโรงงาน"]
  sentPo --> confirmed["โรงงานยืนยัน ลงบัญชีต้นทุน"]
  confirmed --> producing["กำลังผลิต"]
  producing --> shipped["ออกจากจีน"]
  shipped --> inbound["รอเข้าประเทศ"]
  inbound --> receive["รับสินค้าตาม PO"]
  receive --> dest{"เข้าคลังไทย?"}
  dest -->|ใช่| lot["ลงทะเบียนล็อตสินค้า"]
  dest -->|ไม่ ส่งตรง| skipWh["ข้ามคลัง ไปจัดส่ง"]
  receive --> dmg{"มีของเสีย?"}
  dmg -->|มี| claim["เปิดเคลมโรงงานอัตโนมัติ"]
  dmg -->|ไม่มี| payCap["จ่ายโรงงานได้ไม่เกินยอดที่รับ"]
  lot --> payCap
  skipWh --> payCap
  claim --> payCap
  payCap --> close([ปิดวงจรโรงงาน])
```

หน้า: `/ops/factory-po` `/ops/inbound` `/ops/pay-factory` `/ops/assets` `/ops/claims`

---

## 7. สถานะในระบบ

### คำขอใบเสนอราคา

```mermaid
stateDiagram-v2
  [*] --> new
  new --> contacted
  contacted --> quoted
  quoted --> won
  quoted --> lost
  contacted --> lost
  won --> archived
  lost --> archived
  new: ใหม่
  contacted: ติดต่อแล้ว
  quoted: ส่งใบเสนอราคาแล้ว
  won: ปิดการขาย
  lost: ไม่สำเร็จ
  archived: เก็บถาวร
```

เปิดออเดอร์ได้จากคำขอที่สถานะส่งใบเสนอราคาแล้ว หรือปิดการขาย

### การชำระเงินของออเดอร์

```mermaid
stateDiagram-v2
  [*] --> deposit_due
  deposit_due --> deposit_paid
  deposit_paid --> balance_due
  deposit_paid --> paid
  balance_due --> paid
  deposit_due: รอชำระมัดจำ
  deposit_paid: ชำระมัดจำแล้ว
  balance_due: รอชำระส่วนที่เหลือ
  paid: ชำระครบแล้ว
```

ถ้าบิลรวม VAT ไม่เกิน 10,000 บาท มัดจำ = เต็มจำนวน จะข้ามไปชำระครบหลังอนุมัติงวดเดียว

### สินค้าในออเดอร์

```mermaid
stateDiagram-v2
  [*] --> reserved
  reserved --> awaiting_production
  awaiting_production --> producing
  producing --> in_transit
  in_transit --> inbound
  inbound --> warehouse
  warehouse --> out_for_delivery
  out_for_delivery --> delivered
  inbound --> out_for_delivery: ส่งตรงลูกค้า
  reserved --> cancelled
  awaiting_production --> cancelled
  reserved: จองสินค้าแล้ว
  awaiting_production: รอสั่งผลิต
  producing: กำลังผลิต
  in_transit: กำลังขนส่งจากจีน
  inbound: รอเข้าประเทศ
  warehouse: เข้าคลังสินค้าแล้ว
  out_for_delivery: กำลังจัดส่งถึงลูกค้า
  delivered: ส่งถึงลูกค้าแล้ว
  cancelled: ยกเลิก
```

### ใบสั่งโรงงาน

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> sent
  sent --> confirmed
  confirmed --> producing
  producing --> shipped
  shipped --> inbound
  inbound --> received
  draft --> cancelled
  sent --> cancelled
  draft: ร่าง
  sent: ส่งโรงงานแล้ว
  confirmed: โรงงานยืนยันแล้ว
  producing: กำลังผลิต
  shipped: ออกจากจีนแล้ว
  inbound: รอเข้าประเทศ
  received: รับเข้าคลังไทยแล้ว
  cancelled: ยกเลิก
```

---

## 8. จุดรับเรื่องหลังขาย

| เรื่อง | หน้า | ผล |
|---|---|---|
| คุณภาพ สกรีน ของไม่ครบ จัดส่ง | `/issues` และ `/ops/issues` | เปิดตั๋ว ไม่มีการชำระเงินในหน้านี้ |
| ของเสียตอนรับตาม PO | `/ops/inbound` | เปิดเคลมโรงงานอัตโนมัติ |
| เคลมโรงงาน ลูกค้า ขนส่ง | `/ops/claims` | ติดตามสถานะเคลม |

---

## 9. หน้า Ops ที่ใช้ตามขั้น

| ขั้น SOP | URL |
|---|---|
| คำขอใบเสนอราคา | `/ops/quotes` |
| ลูกค้า / บัตรภาษี | `/ops/customers` |
| ออเดอร์ รับชำระ | `/ops/orders` |
| อนุมัติสลิป | `/ops/approvals` |
| ใบรับเงิน / QR | `/ops/cycle` `/ops/receipts` `/ops/qr-pay` |
| ใบสั่งโรงงาน | `/ops/factory-po` |
| รับสินค้าเข้า | `/ops/inbound` |
| คลัง / คงเหลือ | `/ops/stock` |
| เคลื่อนไหวสต็อก | `/ops/stock/movements` |
| ปรับ / โอนสต็อก | `/ops/stock/adjust` |
| ตรวจนับสต็อก | `/ops/stock/counts` |
| จ่ายโรงงาน | `/ops/pay-factory` |
| งบผู้บริหาร | `/ops/finance` |
| แคตตาล็อกสาธารณะ | Strapi จากเมนู Ops |

### คลังสินค้า (WMS)

แหล่งความจริงรอบแรกอยู่ที่ **SQLite** (`wms_balances` / `wms_movements` / `wms_reservations`) หลังรับเข้าคลัง:

1. กรอก **product key** (หรือใช้ `sourceOfferId` จาก PO) + ที่เก็บ (`BIN-DEFAULT` / `BIN-QC`)
2. ระบบเพิ่ม `qty_on_hand` และจองสต็อกให้ออเดอร์อัตโนมัติเมื่อของพอ
3. ของเสียเข้า location QC แยกจากชั้นวางขาย
4. เมื่อสถานะออเดอร์เป็น `out_for_delivery` / `delivered` → ตัด on-hand และ consume reservation
5. ยกเลิกใบรับ (void) ได้ถ้ายังไม่จ่ายโรงงานเกินยอดรับใหม่ — กลับสต็อก + ledger

MySQL: apply `db/mysql/wms_core.sql` (`node scripts/apply-wms-mysql.mjs`) แล้ว `node scripts/sync-wms-mysql.mjs` และตั้ง `WMS_STORE=mysql` — รายละเอียดใน [WMS.md](./WMS.md)

---

## 10. สิ่งที่ห้ามบนหน้าลูกค้า

- ราคาโรงงานหยวน ขั้นบันไดราคา ต้นทุนขนส่งในจีน
- ส่วนต่างกำไร ชั้นสมาชิก รหัสข้อเสนอ 1688
- ข้อความว่ามีสินค้าพร้อมส่ง
- ชำระเงินก่อนมีใบเสนอราคาที่เซลล์อนุมัติ
