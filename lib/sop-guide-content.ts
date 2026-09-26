/**
 * SOP guide catalog — workflows + every Ops menu staff must know.
 * Screenshot files live at /sop/screenshots/{screenshot}
 */

export type SopStep = {
  id: string;
  title: string;
  opsPath: string;
  /** Who uses this screen in day-to-day work */
  role: string;
  purpose: string;
  howTo: string[];
  donts: string[];
  screenshot: string;
  /** Public storefront path (optional) when staff must coach the customer */
  customerPath?: string;
};

export type SopWorkflow = {
  id: string;
  title: string;
  summary: string;
  steps: SopStep[];
};

export const SOP_GUIDE_WORKFLOWS: SopWorkflow[] = [
  {
    id: "start",
    title: "เริ่มต้นและภาพรวม",
    summary: "เข้าสู่ระบบ ดูงานวันนี้ และใช้บอร์ดสถานะก่อนเริ่มขายหรือผลิต",
    steps: [
      {
        id: "ops-login",
        title: "เข้าสู่ระบบ Ops",
        opsPath: "/ops/login",
        role: "พนักงานทุกบทบาท",
        purpose:
          "ยืนยันตัวตนพนักงานก่อนเข้าคอนโซล Smart Gift — แยกจากเว็บลูกค้าและ Strapi",
        howTo: [
          "เปิด /ops/login",
          "กรอกอีเมลหรือชื่อผู้ใช้ + รหัสผ่าน แล้วกดเข้าสู่ระบบ",
          "หรือใช้ปุ่ม Google Sign-In ถ้าบัญชี Google ถูกผูกในรายชื่อพนักงานแล้ว",
          "หลังเข้าสำเร็จระบบตั้งคุกกี้ ops_session (อายุ 12 ชั่วโมง)",
        ],
        donts: [
          "อย่าแชร์รหัสผ่าน Ops กับลูกค้าหรือบุคคลนอกทีม",
          "อย่าใช้บัญชี admin ร่วมกันเมื่อมีบัญชีรายบุคคลใน /ops/users",
        ],
        screenshot: "ops-login.png",
      },
      {
        id: "ops-overview",
        title: "ภาพรวมคอนโซล",
        opsPath: "/ops",
        role: "พนักงานทุกบทบาท",
        purpose:
          "หน้าแรกหลังล็อกอิน — มองสรุปงานค้างและทางลัดเข้าเมนูหลักตามสิทธิ์",
        howTo: [
          "เปิด /ops หลังล็อกอิน",
          "อ่านการ์ดสรุป / ลิงก์ด่วนที่เกี่ยวกับงานวันนี้",
          "ใช้แถบเมนูซ้ายหรือบนเพื่อไปยังใบเสนอราคา ออเดอร์ หรือวงจรปฏิบัติการ",
        ],
        donts: [
          "อย่าเริ่มสั่งโรงงานจากหน้านี้โดยไม่ตรวจมัดจำก่อน",
        ],
        screenshot: "ops-overview.png",
      },
      {
        id: "ops-board",
        title: "บอร์ดงาน",
        opsPath: "/ops/board",
        role: "เซลล์ / ผู้ดูแล",
        purpose:
          "มองงานเป็นคอลัมน์สถานะ — ติดตามคำขอ ออเดอร์ และจุดค้างตามกติกาบอร์ด",
        howTo: [
          "เปิด /ops/board",
          "อ่านกติกาสถานะการ์ด (Board Status Rules) ก่อนย้ายงาน",
          "คลิกการ์ดเพื่อเปิดรายละเอียดคำขอหรือออเดอร์",
          "อัปเดตสถานะเฉพาะเมื่อเงื่อนไขในระบบครบ (เช่น มัดจำอนุมัติแล้ว)",
        ],
        donts: [
          "อย่าย้ายการ์ดข้ามสถานะโดยไม่ทำขั้นตอนเงิน/ผลิตจริง",
          "อย่าปิดงานบนบอร์ดถ้าเอกสารหรือการชำระยังค้าง",
        ],
        screenshot: "ops-board.png",
      },
    ],
  },
  {
    id: "sales",
    title: "ขายและลูกค้า",
    summary:
      "รับคำขอใบเสนอราคา ติดต่อลูกค้า นัดหมาย เปิดออเดอร์ และใช้เครื่องมือช่วยเซลล์",
    steps: [
      {
        id: "public-contact-rfq",
        title: "แบบฟอร์มขอใบเสนอราคา (ลูกค้า)",
        opsPath: "/contact",
        customerPath: "/contact",
        role: "ลูกค้า / เซลล์ช่วยกรอก",
        purpose:
          "บันทึกคำขอใบเสนอราคาก่อนชำระเงิน — ราคาบนเว็บเป็นช่วงโดยประมาณ ไม่ใช่ใบยืนยัน",
        howTo: [
          "ลูกค้าเลือกสินค้าแล้วกดขอใบเสนอราคา หรือเปิด /contact",
          "กรอกผู้ติดต่อ จำนวน วิธีสกรีน วันที่ต้องการ ที่อยู่",
          "ติ๊กยินยอมแล้วกดส่งคำขอ — ได้รหัสคำขอทันที",
          "ตรวจใน Ops ที่ /ops/quotes สถานะ ใหม่",
        ],
        donts: [
          "อย่าให้ลูกค้าโอนเงินนอกระบบเพื่อจองคิวก่อนมีใบเสนอราคาที่อนุมัติ",
          "อย่าบอกว่าราคาบนเว็บเป็นราคาสุดท้าย",
        ],
        screenshot: "public-contact-rfq.png",
      },
      {
        id: "ops-quotes",
        title: "ใบเสนอราคา (รายการ)",
        opsPath: "/ops/quotes",
        role: "เซลล์",
        purpose: "คิวคำขอทั้งหมด — กรองสถานะและเปิดรายละเอียดเพื่อติดต่อลูกค้า",
        howTo: [
          "เปิด /ops/quotes",
          "เลือกคำขอสถานะ ใหม่ หรือติดต่อแล้ว",
          "เปิดรายละเอียดเพื่อเปลี่ยนสถานะและบันทึกฝ่ายขาย",
        ],
        donts: [
          "อย่าลบหรือเก็บถาวรคำขอที่ยังไม่ได้ติดต่อ",
        ],
        screenshot: "ops-quotes.png",
      },
      {
        id: "ops-quote-detail",
        title: "รายละเอียดคำขอใบเสนอราคา",
        opsPath: "/ops/quotes",
        role: "เซลล์",
        purpose:
          "ติดต่อ LINE/โทร อัปเดตสถานะ ส่งใบเสนอราคา และเปิดออเดอร์เมื่อลูกค้าอนุมัติ",
        howTo: [
          "เปิดคำขอจากรายการ",
          "ยืนยันจำนวน สี วิธีสกรีน จุดส่ง วันที่ใช้งาน",
          "เปลี่ยนสถานะเป็น ติดต่อแล้ว → ส่งใบเสนอราคาแล้ว ตามลำดับ",
          "เมื่อลูกค้าอนุมัติแบบและราคา ใช้ฟอร์มเปิดใบสั่งซื้อ / วางบิลมัดจำ",
          "ถ้าไม่ซื้อ เปลี่ยนเป็น ไม่สำเร็จ แล้วหยุดใบนี้",
        ],
        donts: [
          "อย่าเปิดออเดอร์ก่อนลูกค้าอนุมัติแบบและราคา",
          "อย่าเปิดออเดอร์ถ้าบัตรภาษีลูกค้ายังไม่ครบ (ไปกรอกที่ลูกค้าก่อน)",
        ],
        screenshot: "ops-quote-detail.png",
      },
      {
        id: "ops-inquiries",
        title: "ข้อความติดต่อ",
        opsPath: "/ops/inquiries",
        role: "เซลล์",
        purpose:
          "กล่องข้อความติดต่อ / สอบถาม / ร้องเรียนจากเว็บสาธารณะ (ไม่ใช่ RFQ สินค้า)",
        howTo: [
          "เปิด /ops/inquiries",
          "อ่าน intent และรายละเอียด แล้วติดต่อกลับตามช่องทางที่ลูกค้าระบุ",
          "อัปเดตสถานะเมื่อตอบแล้ว",
        ],
        donts: [
          "อย่าสับสนข้อความติดต่อกับคำขอใบเสนอราคาใน /ops/quotes",
        ],
        screenshot: "ops-inquiries.png",
      },
      {
        id: "ops-schedule",
        title: "นัดหมาย",
        opsPath: "/ops/schedule",
        role: "เซลล์",
        purpose: "ปฏิทินนัดคุยงาน / ดูตัวอย่าง / ประชุมกับลูกค้า และลิงก์จองสาธารณะ",
        howTo: [
          "เปิด /ops/schedule ดูปฏิทินหรือไทม์ไลน์สัปดาห์",
          "สร้างนัดใหม่ที่ /ops/schedule/new",
          "ตั้งชั่วโมงว่างที่ /ops/schedule/availability",
          "ส่งลิงก์ /book/{slug} ให้ลูกค้าจองเองได้",
        ],
        donts: [
          "อย่านัดซ้อนทับชั่วโมงที่ปิดใน availability",
        ],
        screenshot: "ops-schedule.png",
      },
      {
        id: "ops-customers",
        title: "ลูกค้า",
        opsPath: "/ops/customers",
        role: "เซลล์ / ผู้ดูแล",
        purpose:
          "CRM เบา — บัตรภาษี ผู้ติดต่อ LINE ประวัติการขาย และนำเข้า FlowAccount",
        howTo: [
          "เปิด /ops/customers ค้นหาหรือสร้างลูกค้าใหม่",
          "กรอกชื่อในใบกำกับ เลข 13 หลัก ที่อยู่ผู้ซื้อก่อนเปิดออเดอร์",
          "ดูประวัติการขายบนหน้ารายละเอียดลูกค้า",
        ],
        donts: [
          "อย่าเปิดออเดอร์โดยใช้ที่อยู่จัดส่งแทนที่อยู่ออกบิล",
          "อย่าสร้างลูกค้าซ้ำ — รวมรายการซ้ำถ้าเป็นผู้ดูแล",
        ],
        screenshot: "ops-customers.png",
      },
      {
        id: "ops-orders",
        title: "ออเดอร์",
        opsPath: "/ops/orders",
        role: "เซลล์ / ผู้ดูแล",
        purpose:
          "รายการออเดอร์หลังเปิดจากใบเสนอราคา — ติดตามเงิน สินค้า และเอกสาร",
        howTo: [
          "เปิด /ops/orders",
          "เปิดออเดอร์ที่ต้องการ ตรวจสถานะเงินและสถานะสินค้า",
          "ส่งลิงก์ /orders/[orderId] หรือ /pay/[voucherId] ให้ลูกค้า",
          "อัปเดตสถานะสินค้าเมื่อของเคลื่อนตามจริง",
        ],
        donts: [
          "อย่าจัดส่งถึงลูกค้าถ้าชำระยังไม่ครบ",
          "อย่าสั่งโรงงานถ้ามัดจำยังไม่ถูกบัญชีอนุมัติ",
        ],
        screenshot: "ops-orders.png",
      },
      {
        id: "ops-order-detail",
        title: "รายละเอียดออเดอร์",
        opsPath: "/ops/orders",
        role: "เซลล์ / ผู้ดูแล",
        purpose:
          "ศูนย์กลางของใบงานหนึ่งใบ — QR มัดจำ เอกสาร สร้างใบสั่งโรงงาน อัปเดตสถานะ",
        howTo: [
          "ตรวจยอดมัดจำ / ส่วนที่เหลือ และสถานะสลิป",
          "เมื่อมัดจำผ่านแล้ว ผู้ดูแลสร้างใบสั่งโรงงานจากหน้านี้",
          "เมื่อของถึงคลังหรือส่งตรง ตรวจใบแจ้งหนี้ส่วนที่เหลือ",
          "เมื่อชำระครบและของถึงขั้นส่งมอบ ตรวจใบกำกับภาษี",
        ],
        donts: [
          "อย่าข้ามสถานะสินค้าโดยไม่มีเหตุการณ์จริง",
          "เซลล์อย่าพยายามดูต้นทุนโรงงานจากหน้านี้ (ไม่มีสิทธิ์)",
        ],
        screenshot: "ops-order-detail.png",
      },
      {
        id: "ops-assistant",
        title: "ผู้ช่วยเซลล์",
        opsPath: "/ops/assistant",
        role: "เซลล์ / ผู้ดูแล",
        purpose: "สรุปคำขอ ร่างข้อความ LINE ค้นแคตตาล็อก — ไม่ได้ออกใบเสนอราคาอัตโนมัติ",
        howTo: [
          "เปิด /ops/assistant",
          "วางบริบทคำขอหรือถามสรุปงาน",
          "คัดลอกข้อความที่ร่างไปคุยลูกค้า แล้วบันทึกผลในใบเสนอราคาเอง",
        ],
        donts: [
          "อย่าใช้คำตอบของผู้ช่วยเป็นใบเสนอราคาทางการโดยไม่ตรวจราคา",
          "อย่าคาดหวังให้เปิดต้นทุนโรงงานหรือกำไรขั้นต้น",
        ],
        screenshot: "ops-assistant.png",
      },
      {
        id: "ops-line-lab",
        title: "ทดลองไลน์",
        opsPath: "/ops/line-lab",
        role: "เซลล์ / ผู้ดูแล",
        purpose: "ทดสอบ webhook LINE OA ในโหมดแล็บโดยไม่ต้องมี Channel จริง",
        howTo: [
          "ตั้ง LINE_OA_TEST_MODE=true ตอนพัฒนา",
          "เปิด /ops/line-lab ยิงข้อความทดสอบพร้อมลายเซ็น HMAC",
          "ตรวจว่าผูกแชทกับลูกค้าด้วยรหัส TB-… ได้",
        ],
        donts: [
          "อย่าเปิดโหมดทดสอบบนโปรดักชันที่รับ webhook จริง",
        ],
        screenshot: "ops-line-lab.png",
      },
    ],
  },
  {
    id: "cycle",
    title: "วงจรมัดจำถึงส่งมอบ",
    summary:
      "อนุมัติสลิป ใบรับเงิน QR สั่งโรงงาน รับของ จ่ายโรงงาน เคลม และหลังขาย",
    steps: [
      {
        id: "public-pay",
        title: "หน้าชำระเงินลูกค้า",
        opsPath: "/pay",
        customerPath: "/pay/[voucherId]",
        role: "ลูกค้า",
        purpose: "โอนผ่าน QR พร้อมเพย์ แล้วแจ้งโอนพร้อมแนบสลิปเข้าระบบ",
        howTo: [
          "ลูกค้าเปิดลิงก์ /pay/[voucherId] หรือหน้าออเดอร์",
          "สแกน QR ตามยอด โอนเงิน",
          "กดแจ้งโอนเงินและแนบสลิป — รอบัญชีตรวจสอบ",
        ],
        donts: [
          "อย่าบอกลูกค้าว่าชำระสำเร็จทันทีหลังแนบสลิป (ต้องรออนุมัติ)",
        ],
        screenshot: "public-pay.png",
      },
      {
        id: "ops-approvals",
        title: "อนุมัติยอด",
        opsPath: "/ops/approvals",
        role: "บัญชี",
        purpose:
          "คิวสลิปที่รอตรวจ — เทียบรูปสลิปกับยอดและบัญชีพร้อมเพย์ แล้วอนุมัติหรือปฏิเสธ",
        howTo: [
          "เปิด /ops/approvals",
          "เลือกรายการ ดูสลิป / อนุมัติ",
          "ยอดตรงและเงินเข้าแล้ว → อนุมัติรับเงิน",
          "ไม่ตรง → กรอกเหตุผลอย่างน้อย 4 ตัวอักษร แล้วปฏิเสธ",
        ],
        donts: [
          "อย่ายืนยันเงินจาก OCR อัตโนมัติโดยไม่ดูสลิป",
          "อย่าอนุมัติถ้าชื่อบัญชีหรือยอดไม่ตรง",
        ],
        screenshot: "ops-approvals.png",
      },
      {
        id: "ops-cycle",
        title: "วงจรปฏิบัติการ (ฮับ)",
        opsPath: "/ops/cycle",
        role: "ผู้ดูแล / บัญชี / คลัง",
        purpose:
          "ศูนย์รวมลิงก์งานหลังมัดจำ — ใบรับเงิน รับสินค้า จ่ายโรงงาน ทรัพย์ เคลม ปัญหา QR",
        howTo: [
          "เปิด /ops/cycle",
          "เลือกโมดูลตามขั้นงานปัจจุบันของออเดอร์",
          "ใช้ร่วมกับเช็กลิสต์ SOP ทั้งวงจร",
        ],
        donts: [
          "อย่าข้ามลำดับ: มัดจำ → สั่งโรงงาน → รับของ → จ่ายโรงงาน",
        ],
        screenshot: "ops-cycle.png",
      },
      {
        id: "ops-receipts",
        title: "ใบรับเงิน",
        opsPath: "/ops/receipts",
        role: "บัญชี / เซลล์",
        purpose: "เอกสารรับเงินตามรายการรับ พร้อมพรีวิว A4 / PDF",
        howTo: [
          "เปิด /ops/receipts หลังยอดถูกอนุมัติ",
          "ตรวจประเภท/หมายเลขพร้อมเพย์และชื่อบัญชีบนเอกสาร",
          "พิมพ์หรือบันทึก PDF เมื่อต้องการส่งลูกค้า",
        ],
        donts: [
          "อย่าออกใบรับเงินก่อนบัญชียืนยันยอด",
        ],
        screenshot: "ops-receipts.png",
      },
      {
        id: "ops-qr-pay",
        title: "QR พร้อมเพย์",
        opsPath: "/ops/qr-pay",
        role: "เซลล์ / บัญชี",
        purpose: "สร้างหรือดู QR ชำระตามงวดสำหรับส่งลูกค้า",
        howTo: [
          "เปิด /ops/qr-pay หรือลิงก์จากออเดอร์",
          "ตรวจยอดและชื่อบัญชีก่อนส่งให้ลูกค้า",
        ],
        donts: [
          "อย่าส่ง QR คนละยอดกับใบแจ้งหนี้",
        ],
        screenshot: "ops-qr-pay.png",
      },
      {
        id: "ops-factory-po",
        title: "ใบสั่งโรงงาน",
        opsPath: "/ops/factory-po",
        role: "ผู้ดูแล",
        purpose:
          "สั่งผลิตจีนหลังมัดจำผ่าน — สเปคโลโก้ ต้นทุน ปลายทางเข้าคลังหรือส่งตรง",
        howTo: [
          "ตรวจมัดจำอนุมัติแล้วบนออเดอร์",
          "สร้างใบสั่งจากออเดอร์หรือ /ops/factory-po/new",
          "กรอกโรงงาน สเปคโลโก้ ต้นทุน และปลายทาง",
          "เปลี่ยนสถานะ ส่งโรงงานแล้ว → โรงงานยืนยันแล้ว (ลงบัญชีต้นทุน) → ผลิต → ขนส่ง",
        ],
        donts: [
          "อย่าสร้างใบสั่งถ้ายังไม่มีมัดจำที่อนุมัติ",
          "เซลล์ไม่มีสิทธิ์เปิดหน้านี้เพื่อดูต้นทุน",
        ],
        screenshot: "ops-factory-po.png",
      },
      {
        id: "ops-factories",
        title: "ทะเบียนโรงงาน",
        opsPath: "/ops/factories",
        role: "ผู้ดูแล",
        purpose: "เก็บข้อมูลโรงงาน/ซัพพลายเออร์จีนที่ใช้ซ้ำกับใบสั่ง",
        howTo: [
          "เปิด /ops/factories",
          "เพิ่มหรือแก้ไขโรงงานก่อนผูกกับใบสั่งใหม่",
        ],
        donts: [
          "อย่าลบโรงงานที่ยังมีใบสั่งค้างโดยไม่ตรวจสอบผลกระทบ",
        ],
        screenshot: "ops-factories.png",
      },
      {
        id: "ops-inbound",
        title: "รับสินค้าเข้า",
        opsPath: "/ops/inbound",
        role: "ผู้ดูแล / คลัง",
        purpose: "รับตาม PO จริง ลงล็อต เปิดเคลมของเสียอัตโนมัติถ้ามี",
        howTo: [
          "เปิด /ops/inbound หรือกดรับสินค้าจากใบสั่ง",
          "ใส่จำนวนรับจริงและของเสีย",
          "เลือกปลายทางให้ตรงใบสั่ง (คลังไทย หรือส่งตรง)",
          "บันทึกการรับ แล้วตรวจ /ops/assets หรือสถานะออเดอร์",
        ],
        donts: [
          "อย่ารับเกินหรือรับโดยไม่ดู QC",
          "อย่าจ่ายโรงงานเต็มก่อนเคลมของเสีย",
        ],
        screenshot: "ops-inbound.png",
      },
      {
        id: "ops-pay-factory",
        title: "จ่ายโรงงาน",
        opsPath: "/ops/pay-factory",
        role: "ผู้ดูแล",
        purpose: "จ่ายซัพพลายเออร์ได้ไม่เกินยอดสินค้าที่รับจริง",
        howTo: [
          "เปิด /ops/pay-factory หลังรับของ",
          "เทียบยอดรับ vs ยอดจ่ายแล้ว",
          "บันทึกจ่ายในวงเงินที่อนุญาต",
          "ตรวจผลใน /ops/finance",
        ],
        donts: [
          "อย่าจ่ายเกินยอดที่รับ",
          "อย่าจ่ายก่อนมีใบรับ",
        ],
        screenshot: "ops-pay-factory.png",
      },
      {
        id: "ops-assets",
        title: "ทะเบียนทรัพย์ / ล็อต",
        opsPath: "/ops/assets",
        role: "คลัง / ผู้ดูแล",
        purpose: "ล็อตสินค้าที่รับเข้าคลังไทยสำหรับติดตามก่อนจัดส่งลูกค้า",
        howTo: [
          "เปิด /ops/assets หลังรับเข้าคลัง",
          "ตรวจล็อตผูกกับออเดอร์/ใบรับ",
        ],
        donts: [
          "อย่าจัดส่งจากคลังถ้าชำระยังไม่ครบ",
        ],
        screenshot: "ops-assets.png",
      },
      {
        id: "ops-claims",
        title: "เคลม",
        opsPath: "/ops/claims",
        role: "ผู้ดูแล / เซลล์",
        purpose: "ติดตามเคลมโรงงาน ลูกค้า หรือขนส่ง",
        howTo: [
          "เปิด /ops/claims",
          "ติดตามเคลมที่เปิดอัตโนมัติตอนรับของเสีย หรือเปิดเคลมใหม่",
          "ปิดเมื่อแก้ไขแล้ว",
        ],
        donts: [
          "อย่าปิดเคลมโดยไม่มีหลักฐานแก้ไข",
        ],
        screenshot: "ops-claims.png",
      },
      {
        id: "ops-issues",
        title: "รับแจ้งปัญหา",
        opsPath: "/ops/issues",
        role: "เซลล์ / ผู้ดูแล",
        purpose: "ตั๋วหลังขายจากลูกค้า (คุณภาพ สกรีน ของไม่ครบ จัดส่ง) — ไม่มีชำระเงินในหน้านี้",
        howTo: [
          "ลูกค้าแจ้งที่ /issues หรือพนักงานเปิดที่ /ops/issues",
          "ผูกออเดอร์หรือใบรับถ้ามี",
          "ติดตามจนปิดเรื่อง",
        ],
        donts: [
          "อย่ารับชำระเงินผ่านหน้าแจ้งปัญหา",
        ],
        screenshot: "ops-issues.png",
      },
      {
        id: "ops-holds",
        title: "พักเอกสาร",
        opsPath: "/ops/holds",
        role: "ผู้ดูแล / บัญชี",
        purpose: "พักเอกสารที่ต้องรอข้อมูลหรืออนุมัติเพิ่มก่อนปล่อยต่อ",
        howTo: [
          "เปิด /ops/holds",
          "ตรวจรายการที่ถูกพักและเหตุผล",
          "ปลดพักเมื่อข้อมูลครบ",
        ],
        donts: [
          "อย่าปลดพักถ้าเงื่อนไขที่ค้างยังไม่แก้",
        ],
        screenshot: "ops-holds.png",
      },
    ],
  },
  {
    id: "catalog",
    title: "ราคาและสินค้า",
    summary: "คิดราคา อัปเดตราคา จัดการ SKU สมุดแคตตาล็อก และรูปโรงงาน",
    steps: [
      {
        id: "ops-pricing",
        title: "คิดราคา",
        opsPath: "/ops/pricing",
        role: "เซลล์ / ผู้ดูแล",
        purpose: "เครื่องมือช่วยประมาณการราคาช่วงสำหรับคุยลูกค้า (ไม่ใช่ใบยืนยันอัตโนมัติ)",
        howTo: [
          "เปิด /ops/pricing",
          "ใส่จำนวน/ตัวเลือกตามสินค้า แล้วอ่านช่วงราคา",
          "นำไปร่างใบเสนอราคานอกหรือในแชท แล้วบันทึกผลในคำขอ",
        ],
        donts: [
          "อย่าส่งผลคิดราคาเป็นสัญญาโดยไม่ผ่านการอนุมัติแบบ",
        ],
        screenshot: "ops-pricing.png",
      },
      {
        id: "ops-pricing-import",
        title: "อัปเดตราคา",
        opsPath: "/ops/pricing/import",
        role: "ผู้ดูแล",
        purpose: "นำเข้าหรืออัปเดตตารางราคาเป็นชุด",
        howTo: [
          "เปิด /ops/pricing/import",
          "อัปโหลดไฟล์ตามรูปแบบที่ระบบรองรับ",
          "ตรวจผลก่อนเผยแพร่ช่วงราคาบนเว็บ",
        ],
        donts: [
          "อย่าอัปเดตราคาบนโปรดักชันโดยไม่สำรองข้อมูล",
        ],
        screenshot: "ops-pricing-import.png",
      },
      {
        id: "ops-sku-price-excel-roundtrip",
        title: "ดาวน์โหลด Excel → แก้ → อัปโหลด",
        opsPath: "/ops/products",
        role: "ผู้ดูแล / เซลล์",
        purpose:
          "รีเช็คราคาและมิติกล่องจาก SKU บน Excel แล้วอัปโหลดกลับเพื่ออัปเดตราคาเว็บ",
        howTo: [
          "เปิด /ops/products แล้วกดดาวน์โหลด Excel ราคา (ชีต import)",
          "แก้คอลัมน์ sku (=รหัสโรงงาน เช่น TSQ01-2) และ rmb — อย่าใส่รหัสขาย A/B/C/D ใน sku",
          "ตรวจ/ใส่ per ctn, length, width, height, weight ถ้าต้องการเก็บมิติ ORI",
          "เปิด /ops/pricing/import อัปโหลดไฟล์เดิม → พรีวิว → เลือกแถว → ส่งอัปเดตขึ้นเว็บ",
          "ดาวน์โหลดซ้ำเพื่อยืนยันว่ามิติและราคาถูกเก็บแล้ว",
        ],
        donts: [
          "อย่าเปลี่ยนชื่อชีต import",
          "อย่าใส่รหัสขาย A/B/C/D ในคอลัมน์ sku",
          "อย่าส่งอัปเดตโดยไม่พรีวิวแถว unmatched",
        ],
        screenshot: "ops-sku-price-excel-roundtrip.png",
      },
      {
        id: "ops-products",
        title: "สินค้า A/B/C/D",
        opsPath: "/ops/products",
        role: "ผู้ดูแล / เซลล์",
        purpose: "จัดชั้นสินค้าและ SKU ที่ใช้ใน Ops (คู่กับแคตตาล็อกสาธารณะใน Strapi)",
        howTo: [
          "เปิด /ops/products",
          "กรองคลาส A/B/C/D ตามนโยบายสต็อก/ผลิต",
          "สร้างหรือแก้ SKU กลุ่ม สี ชุด",
        ],
        donts: [
          "อย่าเผยแพร่สินค้าพร้อมส่งถ้าเป็นงานสั่งผลิตสกรีน",
        ],
        screenshot: "ops-products.png",
      },
      {
        id: "ops-catalog-books",
        title: "สร้างสมุด",
        opsPath: "/ops/catalog-books",
        role: "เซลล์ / ผู้ดูแล",
        purpose: "สร้างสมุด/อัลบั้มแคตตาล็อกสำหรับแชร์ลูกค้า",
        howTo: [
          "เปิด /ops/catalog-books",
          "สร้างสมุดเลือกสินค้า แล้วแชร์ลิงก์สาธารณะที่เกี่ยวข้อง",
        ],
        donts: [
          "อย่าใส่ราคาต้นทุนโรงงานในสมุดลูกค้า",
        ],
        screenshot: "ops-catalog-books.png",
      },
      {
        id: "ops-catalog-images",
        title: "รูปโรงงาน",
        opsPath: "/ops/catalog-images",
        role: "ผู้ดูแล / เซลล์",
        purpose:
          "ค้นหารูปจาก 1688/Alibaba เก็บในระบบภายใน — ไม่ใช่แคตตาล็อกสาธารณะโดยตรง",
        howTo: [
          "เปิด /ops/catalog-images",
          "ค้นหารายการ แล้วบันทึกรูปที่ต้องการใช้ประกอบเซลล์",
        ],
        donts: [
          "อย่าเผยแพร่ราคาโรงงานหยวนบนหน้าลูกค้า",
        ],
        screenshot: "ops-catalog-images.png",
      },
    ],
  },
  {
    id: "finance",
    title: "รายงานและบัญชี",
    summary: "รายงานวงจรรายได้และงบผู้บริหารสำหรับผู้มีสิทธิ์",
    steps: [
      {
        id: "ops-reports",
        title: "รายงานวงจรรายได้",
        opsPath: "/ops/reports",
        role: "ผู้ดูแล / ผู้มีสิทธิ์ reports.read",
        purpose: "ดูขั้นวงจรรายได้และส่งออกตามสิทธิ์",
        howTo: [
          "เปิด /ops/reports",
          "เลือกช่วงเวลา/ตัวกรอง",
          "ส่งออกเมื่อต้องการ (บันทึกใน audit)",
        ],
        donts: [
          "อย่าแชร์รายงานที่มีข้อมูลลูกค้าออกนอกทีมโดยไม่ได้รับอนุญาต",
        ],
        screenshot: "ops-reports.png",
      },
      {
        id: "ops-finance",
        title: "งบผู้บริหาร",
        opsPath: "/ops/finance",
        role: "ผู้ดูแล / บัญชี",
        purpose: "กำไรขั้นต้น ค่าใช้จ่าย และทางเข้าสู่สมุดรายวัน / งบทดลอง / งบดุล",
        howTo: [
          "เปิด /ops/finance",
          "ใช้แถบย่อยไป ledger, trial-balance, journals, cash-flow ตามงาน",
          "ส่งออก CSV ให้โปรแกรมบัญชีเมื่อต้องการ",
        ],
        donts: [
          "อย่าให้เซลล์เข้าหน้านี้ถ้าไม่มีสิทธิ์ (ระบบจะกันอยู่แล้ว)",
        ],
        screenshot: "ops-finance.png",
      },
      {
        id: "ops-finance-ledger",
        title: "สมุดรายวัน / Ledger",
        opsPath: "/ops/finance/ledger",
        role: "บัญชี / ผู้ดูแล",
        purpose: "ดูรายการลงบัญชีคู่จากวงจรรับเงินและต้นทุน",
        howTo: [
          "เปิด /ops/finance/ledger",
          "กรองตามช่วงวันที่หรือออเดอร์ที่เกี่ยวข้อง",
        ],
        donts: [
          "อย่าแก้รายการนอกกระบวนการที่ระบบออกแบบไว้โดยไม่มีเอกสารอ้างอิง",
        ],
        screenshot: "ops-finance-ledger.png",
      },
    ],
  },
  {
    id: "content",
    title: "เนื้อหาเว็บ",
    summary: "SEO และบทความที่เผยแพร่บนเว็บสาธารณะ",
    steps: [
      {
        id: "ops-seo",
        title: "SEO",
        opsPath: "/ops/seo",
        role: "ผู้ดูแล / เนื้อหา",
        purpose: "ตรวจและปรับจุด SEO ของหน้าเว็บหลัก",
        howTo: [
          "เปิด /ops/seo",
          "ตรวจ title / description / สถานะหน้าที่สำคัญ",
          "บันทึกการเปลี่ยนแปลงแล้วตรวจหน้าสาธารณะ",
        ],
        donts: [
          "อย่าใส่คีย์เวิร์ดหลอกลวงว่ามีของพร้อมส่ง",
        ],
        screenshot: "ops-seo.png",
      },
      {
        id: "ops-blog",
        title: "บทความ",
        opsPath: "/ops/blog",
        role: "ผู้ดูแล / seo.write",
        purpose: "ร่างและจัดการบทความบล็อก",
        howTo: [
          "เปิด /ops/blog",
          "สร้างบทความใหม่ เลือกหมวดให้ตรงห้าหมวดของบล็อก",
          "ตั้งเวลาเผยแพร่เป็นเวลาไทย หรือเผยแพร่ทันทีเมื่อตรวจแล้ว",
        ],
        donts: [
          "อย่าเผยแพร่ราคาสัญญาหรือต้นทุนในบทความ",
        ],
        screenshot: "ops-blog.png",
      },
    ],
  },
  {
    id: "system",
    title: "ระบบ",
    summary: "บันทึกการใช้งาน ผู้ใช้/สิทธิ์ และการกลับไปเว็บสาธารณะ",
    steps: [
      {
        id: "ops-audit",
        title: "บันทึกการใช้งาน",
        opsPath: "/ops/audit",
        role: "ผู้ดูแล",
        purpose: "ตรวจสอบ login การอนุมัติ การดูรายงาน และเหตุการณ์ระบบ",
        howTo: [
          "เปิด /ops/audit",
          "กรองผู้ใช้ การกระทำ สถานะ ช่วงวันที่",
          "ส่งออก CSV เมื่อต้องการหลักฐาน",
        ],
        donts: [
          "อย่าแชร์ไฟล์ audit ที่มี IP/อุปกรณ์ออกนอกทีมโดยไม่จำเป็น",
        ],
        screenshot: "ops-audit.png",
      },
      {
        id: "ops-users",
        title: "ผู้ใช้ / สิทธิ์",
        opsPath: "/ops/users",
        role: "ผู้ดูแล",
        purpose: "จัดการพนักงานและบทบาท (admin / sales / viewer และสิทธิ์ย่อย)",
        howTo: [
          "เปิด /ops/users",
          "เพิ่มหรือแก้พนักงาน อีเมล บทบาท สถานะใช้งาน",
          "ตรวจว่า Google login ตรงอีเมลที่มีในรายชื่อ",
        ],
        donts: [
          "อย่าให้สิทธิ์ admin เกินจำเป็น",
          "อย่าปิดบัญชีตัวเองถ้าเป็นผู้ดูแลคนเดียว",
        ],
        screenshot: "ops-users.png",
      },
    ],
  },
];

export function listSopSteps(): SopStep[] {
  return SOP_GUIDE_WORKFLOWS.flatMap((w) => w.steps);
}

export function listSopCaptureTargets(): { id: string; path: string }[] {
  return listSopSteps().map((step) => ({
    id: step.id,
    path: step.opsPath.startsWith("/pay") ? "/ops/approvals" : step.opsPath,
  }));
}

export function findSopStep(stepId: string): SopStep | undefined {
  return listSopSteps().find((s) => s.id === stepId);
}

export function findSopWorkflow(workflowId: string): SopWorkflow | undefined {
  return SOP_GUIDE_WORKFLOWS.find((w) => w.id === workflowId);
}
