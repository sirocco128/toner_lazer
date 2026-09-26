# UX Polish — v1.1.x

งานปิดช่องว่าง REQUIRED FUTURE UX จาก runbook §11 (ไม่รวมรูปแบรนด์จริงที่รอ Sprint 2 intake)

## ที่ทำแล้ว

| รายการ | รายละเอียด |
|--------|------------|
| Active navigation | `NavLink` + `aria-current="page"` (desktop/mobile) |
| Sticky mobile CTA | `MobileStickyCta` — ขอใบเสนอราคา + LINE; ซ่อนที่ `/contact` `/privacy` `/terms`; `pb-mobile-cta` กันทับเนื้อหา |
| Empty states | สินค้า / ผลงาน / บทความ ใช้ `EmptyState` + CTA |
| Loading / Error | `app/loading.tsx`, `app/error.tsx` |
| Breadcrumbs | หน้า products, portfolio, blog, contact |
| Form recovery | บันทึก draft ใน `localStorage`, echo ค่าเมื่อ validation/network error |
| RFQ success | Request ID + ขั้นตอนถัดไป + โทร/LINE/เลือกสินค้า |
| Basket → RFQ | `/contact?note&basketId&product…` prefill; เคลียร์ตะกร้าหลังส่งสำเร็จเมื่อเปิด P2 flag |
| Reduced motion | คงไว้ใน `globals.css` |
| Messaging clarity | สำนวนผู้ซื้อเป็นหลัก (`lib/ux-copy.ts`) — ตัดศัพท์ภายใน (P2/RFQ/MOQ/SKU/Proof) จากหน้าผู้ใช้; ขั้นตอนชัดบน Home/Premium/Customize; ป้ายราคาโดยประมาณ + ไม่ชำระเงินบนเว็บ |
| Breadcrumbs (ครบ) | products, portfolio, blog, contact, premium-giftset, customize, giftset category, blog article |
| Price disclaimer (ครบ) | Home featured, products list/detail, giftset category |
| UX copy tests | `tests/ux-copy.test.ts` — ตรวจสอบไม่มี jargon ในข้อความผู้ซื้อ |

## ยังรอข้อมูลจริง (ไม่ใช่โค้ด)

- รูป hero/product/portfolio จริง
- ชื่อแบรนด์ / เบอร์ / Legal ที่อนุมัติ
- ดู `docs/SPRINT2-CONTENT-INTAKE.md`

## เปิด P2 basket UI

```bash
NEXT_PUBLIC_ENABLE_P2_QUOTE_TOOLS=true
```
