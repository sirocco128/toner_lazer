# Workflow Diagrams — Premium Gift Set Web

เอกสารนี้ขยายจาก [../SOP-CYCLE.md](../SOP-CYCLE.md) สำหรับชุดคู่มือ `docs/manual`

---

## W1. มุมลูกค้า (3 ขั้น)

```mermaid
flowchart LR
  start([เริ่ม]) --> pick["1. เลือกสินค้า"]
  pick --> ask["2. ส่งคำขอใบเสนอราคา"]
  ask --> make["3. อนุมัติแบบแล้วผลิต"]
  make --> done([รับของในไทย])
```

| ขั้น | หน้า | หมายเหตุ |
|------|------|----------|
| เลือกสินค้า | `/` `/products` `/giftset/[category]` | ราคาเป็นช่วงโดยประมาณ |
| ส่งคำขอ | `/contact` LINE | ยังไม่ชำระเงิน |
| อนุมัติแบบ | นอกเว็บ + เปิดออเดอร์ Ops | ตัวอย่างในเว็บ ≠ แบบผลิต |

---

## W2. วงจรหลักทั้งเส้น (RFQ → ส่งมอบ)

```mermaid
flowchart TD
  start([เริ่ม]) --> browse["เลือกสินค้า ดูช่วงราคา"]
  browse --> spec["กำหนดจำนวน สี สกรีน แพ็ก"]
  spec --> mock["ดูตัวอย่างโลโก้"]
  mock --> rfq["ส่งคำขอใบเสนอราคา"]
  rfq --> lead[(บันทึกคำขอ + ลูกค้า)]
  lead --> contact["เซลล์ติดต่อ LINE / โทร"]
  contact --> quoted["ส่งใบเสนอราคา"]
  quoted --> approve{"ลูกค้าอนุมัติ?"}
  approve -->|ไม่| lost["สถานะ ไม่สำเร็จ"]
  approve -->|ใช่| order["เปิดออเดอร์ + QR มัดจำ"]
  order --> payDep["โอนมัดจำ + แนบสลิป"]
  payDep --> slipOk{"บัญชีอนุมัติยอด?"}
  slipOk -->|ไม่| payDep
  slipOk -->|ใช่| factory["เปิดใบสั่งโรงงานจีน"]
  factory --> produce["ผลิต QC"]
  produce --> freight["ขนส่งจีน→ไทย"]
  freight --> dest{"ปลายทาง?"}
  dest -->|คลัง| warehouse["รับเข้าคลัง"]
  dest -->|ตรง| shipTo["ส่งตรงลูกค้า"]
  warehouse --> remain["ใบแจ้งหนี้ส่วนที่เหลือ"]
  shipTo --> remain
  remain --> payBal["ชำระส่วนที่เหลือ"]
  payBal --> tax["ใบกำกับภาษี"]
  tax --> deliver["จัดส่งถึงลูกค้า"]
  deliver --> done([จบวงจร])
  lost --> stop([จบ — ไม่ขาย])
```

**ประตูล็อก**

- ยังไม่มีมัดจำ → สั่งผลิตไม่ได้
- ยังชำระไม่ครบ → ส่งถึงลูกค้าไม่ได้
- ใบกำกับออกเมื่อชำระครบ **และ** ของอยู่คลัง / กำลังส่ง / ส่งแล้ว

---

## W3. บทบาท × ช่องทาง

```mermaid
flowchart LR
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

## W4. Sequence — ส่งคำขอใบเสนอราคา

```mermaid
sequenceDiagram
  autonumber
  actor Customer as ลูกค้า
  participant Web as เว็บ
  participant DB as SQLite
  participant Hook as Webhook
  actor Sales as เซลล์

  Customer->>Web: กรอกแบบฟอร์ม RFQ
  Web->>DB: บันทึกคำขอ + upsert ลูกค้า
  DB-->>Web: รหัสคำขอ
  Web-->>Customer: ได้รับแล้ว ยังไม่ชำระเงิน
  Web-)Hook: ส่งต่อ (retry / DLQ)
  Sales->>Web: เปิด /ops/quotes
  Sales->>Customer: LINE / โทร
  Sales->>Web: สถานะ ส่งใบเสนอราคาแล้ว
```

หน้า: `/contact` → `/ops/quotes` → `/ops/quotes/[requestId]`

---

## W5. Sequence — มัดจำถึงใบกำกับ

```mermaid
sequenceDiagram
  autonumber
  actor Customer as ลูกค้า
  participant Web as เว็บ
  actor Sales as เซลล์
  actor Acct as บัญชี

  Sales->>Web: เปิดออเดอร์จาก RFQ ที่อนุมัติ
  Web-->>Customer: QR มัดจำ + ใบแจ้งหนี้มัดจำ
  Customer->>Web: โอน + แนบสลิป
  Web->>Web: OCR เทียบยอด/บัญชี
  Web->>Acct: คิว /ops/approvals
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
  Web-->>Customer: ใบกำกับ + ใบเสร็จ
```

กติกา: VAT 7% · มัดจำเต็มจำนวนถ้ายอดรวม VAT ≤ 10,000 บาท ไม่เช่นนั้น 50%

---

## W6. Flowchart — รับชำระ

```mermaid
flowchart TD
  open["เปิดออเดอร์"] --> invoiceDep["ใบแจ้งหนี้มัดจำ + QR"]
  invoiceDep --> pay["โอน + แนบสลิป"]
  pay --> ocr["OCR เทียบยอด"]
  ocr --> queue["คิวรอบัญชี"]
  queue --> decide{"อนุมัติ?"}
  decide -->|ปฏิเสธ| reason["บันทึกเหตุผล"]
  reason --> pay
  decide -->|อนุมัติ| booked["ลงบัญชีรับเงิน"]
  booked --> gate{"ถึงยอดมัดจำ?"}
  gate -->|ยัง| wait["ยังสั่งผลิตไม่ได้"]
  gate -->|ครบ| produceOk["ปลดล็อกสั่งผลิต"]
  produceOk --> arrive{"ของถึงคลัง/ส่งตรง?"}
  arrive -->|ยัง| waitGoods["รอของ"]
  waitGoods --> arrive
  arrive -->|ถึง| invBal["ใบแจ้งหนี้ส่วนที่เหลือ"]
  invBal --> pay2["โอนส่วนที่เหลือ"]
  pay2 --> queue2["บัญชีอนุมัติ"]
  queue2 --> paid{"ชำระครบ + ของถึงขั้นส่ง?"}
  paid -->|ยัง| waitTax["ยังไม่ออกใบกำกับ"]
  paid -->|ใช่| tax["ใบกำกับ + ใบเสร็จ"]
```

---

## W7. Sequence — โรงงาน / รับของ / จ่าย

```mermaid
sequenceDiagram
  autonumber
  actor Admin as ผู้ดูแล
  participant Ops as Ops
  participant Factory as โรงงานจีน
  actor Wh as คลังไทย

  Admin->>Ops: ร่างใบสั่ง + สเปคโลโก้ + ต้นทุน
  Ops->>Factory: ส่งใบสั่ง
  Factory-->>Ops: ยืนยัน — ลงบัญชีต้นทุน
  Factory->>Factory: ผลิต QC
  Factory->>Wh: ถึงไทย
  alt เข้าคลัง
    Wh->>Ops: รับเข้า ลงล็อต
  else ส่งตรง
    Wh->>Ops: รับแล้วข้ามคลัง
  end
  opt ของเสีย
    Ops->>Ops: เปิดเคลมโรงงานอัตโนมัติ
  end
  Admin->>Ops: จ่ายโรงงาน ≤ ยอดที่รับ
```

---

## W8. State — คำขอใบเสนอราคา

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

เปิดออเดอร์ได้จากสถานะ `quoted` หรือ `won`

---

## W9. State — การชำระเงินออเดอร์

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

---

## W10. State — สินค้าในออเดอร์ (fulfillment)

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
  inbound --> out_for_delivery: ส่งตรง
  reserved --> cancelled
  awaiting_production --> cancelled
```

---

## W11. State — ใบสั่งโรงงาน

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
```

---

## W12. สถาปัตยกรรมระบบ (component)

```mermaid
flowchart TB
  subgraph public [Public]
    Web[Next.js Storefront]
  end
  subgraph ops [Ops]
    Console[Ops Console]
  end
  subgraph data [Data]
    SQLite[(SQLite Ops)]
    MySQL[(MySQL SmartGift)]
    PG[(Postgres Strapi)]
    MinIO[(MinIO)]
  end
  subgraph ext [External]
    Strapi[Strapi CMS]
    LINE[LINE OA]
    AI[OpenRouter/Gemini]
    Ali[1688/Alibaba]
    SMTP[Gmail SMTP]
    TAIP[TranTech AI Widget]
  end
  Web --> SQLite
  Web --> MySQL
  Web --> Strapi
  Console --> SQLite
  Console --> MySQL
  Web --> MinIO
  Console --> MinIO
  Strapi --> PG
  Web --> LINE
  Web --> AI
  Console --> Ali
  Web --> SMTP
  Web --> TAIP
```

---

## W13. จุดหลังขาย

| เรื่อง | หน้า | ผล |
|-------|------|-----|
| คุณภาพ / สกรีน / ของไม่ครบ / จัดส่ง | `/issues` `/ops/issues` | เปิดตั๋ว (ไม่มีการชำระในหน้านี้) |
| ของเสียตอนรับ PO | `/ops/inbound` | เคลมโรงงานอัตโนมัติ |
| เคลมโรงงาน/ลูกค้า/ขนส่ง | `/ops/claims` | ติดตามเคลม |
