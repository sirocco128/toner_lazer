# บันทึกข้อมูลการสร้างโปรแกรม — Premium Gift Set Web

| รายการ | ข้อมูล |
|--------|--------|
| ชื่อโครงการ | Premium Gift Set Web (Terabis / SmartGift B2B) |
| ประเภท | โครงการต่อเนื่อง (พัฒนาจาก starter v1.1 → Ops/CRM/Finance/Procurement) |
| หน่วยงานรับผิดชอบ | Terabis / SmartGift product team |
| ผู้ติดต่อ | <!-- placeholder: contact-name --> · <!-- placeholder: contact-email --> |
| สถานะเอกสาร | ร่าง / พร้อมใช้งานภายใน |
| วันที่บันทึก | 2026-09-06 |
| เวอร์ชันระบบอ้างอิง | Next.js 15.5 App Router · Node 22+ |

## 1. หลักการและเหตุผล

แพลตฟอร์ม B2B สำหรับของขวัญองค์กรและสินค้าพรีเมียมที่สั่งผลิตจากจีน (สกรีนโลโก้ได้) ราคาบนเว็บเป็นช่วงโดยประมาณ — วงจรจริงเริ่มจากคำขอใบเสนอราคา (RFQ) แล้วเซลล์เปิดออเดอร์ก่อนชำระเงิน

## 2. วัตถุประสงค์

1. เว็บสาธารณะสำหรับแคตตาล็อก SEO / RFQ / ติดตามออเดอร์
2. Ops console สำหรับ CRM, ออเดอร์, อนุมัติสลิป, ใบสั่งโรงงาน, รับเข้า, บัญชี
3. CMS (Strapi) + MySQL catalog สำหรับเนื้อหาและ SKU เชิงพาณิชย์

## 3. ขอบเขตระบบ

| รวมในขอบเขต | นอกขอบเขต |
|-------------|-----------|
| Storefront, RFQ, quote basket, order token, PromptPay/slip | ชำระบัตรเครดิต / payment gateway อัตโนมัติ |
| Ops: quotes, customers, orders, factory PO, inbound, finance | NextERP write-back เต็มระบบ |
| Strapi CMS, MinIO, LINE bind, AI assistants | Marketplace Shopee/Lazada order intake |

## 4. สแต็กเทคโนโลยี

| ชั้น | เทคโนโลยี |
|------|-----------|
| Frontend / BFF | Next.js 15, React 19, TypeScript, Tailwind, Server Actions |
| Ops DB | SQLite (`db/migrations` 001–026) |
| Catalog | MySQL SmartGift (`sg_sku*`, offers) |
| CMS | Strapi 5 + PostgreSQL |
| Storage | MinIO / S3 |
| AI | OpenRouter / Gemini (assistant, OCR slip, mockup, catalog image search) |
| Deploy | Docker, Portainer/NAS, GitLab CI, Cloudflare Tunnel (optional) |

## 5. กลุ่มผู้ใช้เป้าหมาย

- ลูกค้าจัดซื้อองค์กร (ไม่ login — ใช้ลิงก์ token)
- เซลล์ / บัญชี / ผู้ดูแล / ผู้ดูอย่างเดียว (Ops RBAC)
- บรรณาธิการ CMS (Strapi แยก auth)

## 6. ผลผลิต / ผลลัพธ์

| Output | Outcome |
|--------|---------|
| เว็บ + Ops + CMS ที่ deploy ได้ | ลดงานนอกระบบในวงจร RFQ→ผลิต→ส่งมอบ |
| SOP + คู่มือ + ER/Workflow | อบรมพนักงานและ audit ได้ |

## 7. ที่เก็บโค้ด / เอกสาร

- โค้ด: `D:\mcp_alibaba\premium-giftset-web`
- คู่มือชุดนี้: `docs/manual/`
- SOP: `docs/SOP-CYCLE.md`

## 8. ความเชื่อมโยงระบบอื่น

- Alibaba/1688 (ต้นทุน / รูปแหล่ง)
- TranTech AI Platform widget (SmartGift desk)
- Gmail SMTP, LINE OA, RD VAT lookup, MinIO, ClamAV (optional)
