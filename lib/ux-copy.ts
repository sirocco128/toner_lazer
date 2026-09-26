/**
 * Shared Thai copy for consistent UX messaging.
 * Keep buyer-facing language plain; avoid internal jargon (SEO Landing, P2, etc.).
 */

export const PRICE_DISCLAIMER_SHORT =
  "ราคาที่แสดงเป็นค่าประมาณ รวมค่าขนส่งจากจีนโดยประมาณ ราคาสุดท้ายขึ้นกับจำนวน สเปค โลโก้ บรรจุภัณฑ์ และจุดส่งในไทย";

export const PRICE_DISCLAIMER_FULL =
  "ราคาบนเว็บเป็นช่วงราคาโดยประมาณ รวมค่าขนส่งจากจีนแล้ว ไม่ใช่ใบเสนอราคา และยังไม่รวมค่าตกแต่งพิเศษ ค่าแพ็กในไทย หรือค่าจัดส่งในประเทศ ทีมขายจะยืนยันราคาหลังได้รับรายละเอียดจากแบบฟอร์ม";

export const PRICE_DISCLAIMER_HEADING = "ราคาบนเว็บเป็นค่าประมาณ";

export const PRICE_DISCLAIMER_POINTS = [
  "ตัวเลขที่เห็นเป็นช่วงราคาโดยประมาณ ไม่ใช่ใบเสนอราคา และยังชำระเงินบนเว็บไม่ได้",
  "ช่วงราคารวมค่าขนส่งจากจีนโดยประมาณแล้ว",
  "ราคาสุดท้ายขึ้นกับจำนวน โลโก้ บรรจุภัณฑ์ และจุดส่งในไทย — ทีมขายยืนยันหลังได้รับแบบฟอร์ม",
] as const;

export const RFQ_NO_PAYMENT =
  "แบบฟอร์มนี้ใช้ขอใบเสนอราคาเท่านั้น ไม่มีการชำระเงิน และยังไม่ใช่การยืนยันสั่งซื้อ";

export const QUOTE_NOT_AN_ORDER =
  "ไม่ใช่การสั่งซื้อ — ไม่มีการชำระเงินบนหน้านี้";

export const CONTACT_INQUIRY_INTRO =
  "ใช้เมื่อต้องการติดต่อ สอบถาม ร้องเรียน หรือเรื่องอื่นที่ไม่ใช่ใบเสนอราคา กรอกอีเมลและเบอร์โทรเพื่อให้ทีมงานติดต่อกลับ — ไม่มีการชำระเงินในหน้านี้";

export const NEEDED_DATE_MIN_HINT =
  "เลือกได้ตั้งแต่วันนี้บวก 10 วัน เป็นต้นไป เพราะต้องใช้เวลาผลิตและขนส่ง";

export const COMPANY_TAX_LOOKUP_HINT =
  "พิมพ์ชื่อบริษัทหรือเลขผู้เสียภาษี 13 หลัก ระบบจะเช็คกับกรมสรรพากร ถ้าชื่อตรงหลายบริษัท จะมีหน้าต่างให้เลือกชื่อและสาขาให้ตรง แล้วที่อยู่ด้านล่างจะถูกใส่ให้อัตโนมัติ";

export const EMAIL_FORMAT_HINT = "เช่น name@company.co.th";
export const PHONE_FORMAT_HINT = "เช่น 081-234-5678 หรือ 02-123-4567";
export const EMAIL_REQUIRED = "กรุณากรอกอีเมล";
export const PHONE_REQUIRED = "กรุณากรอกเบอร์โทร";
export const EMAIL_INVALID =
  "อีเมลไม่ถูกต้อง กรุณาใส่รูปแบบ name@company.co.th";
export const PHONE_INVALID =
  "เบอร์โทรไม่ถูกต้อง กรุณาใส่เบอร์มือถือ 10 หลัก หรือเบอร์สำนักงานที่ขึ้นต้นด้วย 0";

export const ORDER_TRACKING_INTRO =
  "หลังทีมขายส่งใบเสนอราคาและเปิดออเดอร์แล้ว ชำระมัดจำหรือเต็มจำนวนผ่านพร้อมเพย์ แล้วแจ้งโอนพร้อมแนบสลิปให้ระบบตรวจยอด ติดตามสินค้าตั้งแต่จอง รอผลิต ขนส่งจากจีน เข้าประเทศ เข้าคลัง จนจัดส่งถึงคุณ พร้อมดูประวัติรับชำระและเอกสารใบเสร็จ / ใบกำกับภาษี";

export const ISSUE_REPORT_INTRO =
  "แจ้งปัญหาคุณภาพ สกรีนโลโก้ ของไม่ครบ หรือจัดส่ง ทีมจะรับเรื่องและติดต่อกลับ ไม่มีการชำระเงินในหน้านี้";

/** Hub for returning buyers — grouped with ops in the storefront top bar. */
export const ACCOUNT_HUB_TITLE = "ลูกค้าที่สั่งแล้ว";

export const ACCOUNT_HUB_NAV_HINT = "ติดตามออเดอร์ · แจ้งปัญหา";

export const OPS_CONSOLE_TITLE = "Smart Gift";

export const OPS_CONSOLE_KICKER = "คอนโซลปฏิบัติการ";

/** Short storefront label — staff chrome uses Smart Gift, not the buyer header. */
export const OPS_CONSOLE_NAV_LABEL = "พนักงาน";

export const OPS_CONSOLE_NAV_HINT = "เข้าทำงาน — สำหรับพนักงาน";

export const ACCOUNT_HUB_INTRO =
  "โซนนี้สำหรับลูกค้าที่มีออเดอร์จากทีมขายแล้ว ใช้ติดตามสถานะ แจ้งโอน หรือแจ้งปัญหาสินค้า หากยังไม่ได้สั่ง ให้ขอใบเสนอราคาก่อน";

export const ACCOUNT_HUB_ORDERS_TITLE = "ออเดอร์ของฉัน";

export const ACCOUNT_HUB_ORDERS_BODY =
  "ค้นหาด้วยอีเมลและเบอร์โทรที่ใช้ตอนขอราคา หรือเปิดจากลิงก์ที่ทีมขายส่งให้";

export const ACCOUNT_HUB_ISSUES_TITLE = "แจ้งปัญหาสินค้า";

export const ACCOUNT_HUB_ISSUES_BODY =
  "แจ้งคุณภาพ โลโก้ ของไม่ครบ หรือจัดส่ง — ทีมรับเรื่องและติดต่อกลับ ไม่มีการชำระเงินในหน้านี้";

export const ACCOUNT_HUB_NEED_ORDER =
  "ยังไม่มีออเดอร์? ส่งคำขอใบเสนอราคา ทีมขายจะเปิดออเดอร์และส่งลิงก์ให้คุณ";

export const RECENT_ORDER_HINT = "กลับไปออเดอร์ที่เพิ่งดู";

export const REPORT_ISSUE_FOR_ORDER = "แจ้งปัญหาออเดอร์นี้";

export const HOW_IT_WORKS = [
  {
    step: "1",
    title: "เลือกสินค้าหรือบอกโจทย์",
    body: "เลือกหมวดของพรีเมียม หรือแจ้งงบ จำนวน และโอกาสใช้งาน",
  },
  {
    step: "2",
    title: "ปรึกษาและขอใบเสนอราคา",
    body: "ส่งโจทย์ทางแบบฟอร์มหรือ LINE ทีมขายเสนอแนวทางและแบบตำแหน่งโลโก้",
  },
  {
    step: "3",
    title: "อนุมัติแบบแล้วผลิต",
    body: "ยืนยันตัวอย่างก่อนผลิต จากนั้นผลิตและจัดส่งตามนัด สั่งซ้ำจากสเปคเดิมได้",
  },
] as const;

export const LOGO_SCREENING_BADGE = "สกรีนโลโก้ได้";

export const CUSTOM_QUOTE_NOTICE_SHORT =
  "ราคาประมาณ — ราคาสุดท้ายตามจำนวนและงานโลโก้ ไม่ใช่ราคาชำระบนเว็บ";

export const CUSTOM_QUOTE_NOTICE =
  "ราคาบนเว็บเป็นราคาฐานโดยประมาณสำหรับขอใบเสนอราคา (Custom Quote) ราคาสุดท้ายขึ้นกับจำนวนสั่ง วิธีสกรีนโลโก้ จำนวนสี บรรจุภัณฑ์ และจุดส่งในไทย";

export const MOQ_NOTICE_SHORT = "สั่งขั้นต่ำ";

export const MOQ_NOTICE =
  "สินค้านี้เป็นงานสั่งผลิตจำนวนมากสำหรับองค์กร ไม่ใช่สินค้าขายปลีกทีละชิ้น — ต้องถึงจำนวนขั้นต่ำตามที่ระบุ";

export const CATALOG_PILL = "ของพรีเมียมสำหรับทุกแบรนด์ ทุกแคมเปญ";

export const CATALOG_SUBTITLE =
  "ทุกชิ้นสกรีนโลโก้ใส่ได้ — สั่งผลิตตามแบบจากจีน ไม่ใช่ของพร้อมส่ง เลือกหมวด แล้วขอใบเสนอราคาเมื่อพร้อม";

export const CATALOG_LOADING = "กำลังโหลดแคตตาล็อกจากฐานสินค้า…";

export const CATALOG_EMPTY_TITLE = "ยังไม่มีสินค้าในแคตตาล็อก";

export const CATALOG_EMPTY_BODY =
  "ขณะนี้ยังไม่มีรายการเผยแพร่ ส่งโจทย์ให้ทีมขายแนะนำเซ็ตที่สกรีนโลโก้ได้ — ไม่ต้องรอหน้านี้";

export const CATALOG_UNAVAILABLE_TITLE = "โหลดแคตตาล็อกไม่สำเร็จ";

export const CATALOG_UNAVAILABLE_BODY =
  "เชื่อมต่อฐานสินค้าไม่ทันหรือช้าเกินไป ลองรีเฟรช หรือส่งโจทย์ให้ทีมขายแนะนำเซ็ตได้เลย";

export const FLIP_CATALOG_NAV = "สมุดแคตตาล็อก";

export const PRODUCTS_NAV_HINT = "เลือกเซ็ตแล้วขอราคา";

export const CATALOG_NAV_HINT = "พลิกดูแคตตาล็อก ไม่ใช่รายการขอราคา";

export const FLIP_CATALOG_TITLE = "สมุดแคตตาล็อกของขวัญองค์กร";

export const FLIP_CATALOG_LEAD =
  "พลิกดูสินค้าจากเว็บ จัดตามกลุ่มเดียวกัน ทุกชิ้นสกรีนโลโก้ใส่ได้ — สั่งผลิตตามออเดอร์จากจีน ไม่ใช่ของพร้อมส่ง";

export const FLIP_CATALOG_CLOSING_TITLE = "พร้อมแล้ว ขอใบเสนอราคา";

export const FLIP_CATALOG_CLOSING_BODY =
  "สมุดนี้ใช้เลือกแนวเซ็ต ไม่ใช่ใบเสนอราคา และไม่มีการชำระเงิน ทีมขายยืนยันสเปค โลโก้ และจำนวนก่อนสั่งผลิต";

export const FLIP_CATALOG_PRINT_HINT =
  "พิมพ์หรือบันทึกเป็น PDF เพื่อส่งต่อให้ทีมภายใน";

export const FLIP_CATALOG_OPEN = "เปิดสมุดพลิก";

export const FLIP_CATALOG_EXTERNAL = "สมุดพลิกที่อัปโหลดไว้";

export const QUOTE_BASKET_FAB = "ตะกร้าขอใบเสนอราคา";

export const QUOTE_FAB_LABEL = "ขอใบเสนอราคา";

export function quoteBasketAddLabel(qty: number): string {
  return `เพิ่ม ${qty} ชุดเข้าตะกร้าใบเสนอราคา`;
}

export function quoteBasketAddedLabel(qty: number): string {
  return `เพิ่มแล้ว ${qty} ชุด — เพิ่มอีก`;
}

export function quoteBasketLockNote(qty: number): string {
  return `ล็อกจำนวนขั้นต่ำ ${qty} ชุด พร้อมราคาโดยประมาณตอนเพิ่ม — ลดต่ำกว่านี้ไม่ได้`;
}

export const LOGO_DECORATION_HEADING = "สกรีนโลโก้ใส่ได้";

export const LOGO_DECORATION_INTRO =
  "สินค้านี้สั่งผลิตตามแบบ ไม่ใช่ของพร้อมส่ง — ใส่โลโก้ได้ด้วยสกรีน ปั๊มนูน เลเซอร์ พิมพ์สี หรือปัก แล้วค่อยสั่งโรงงานหลังยืนยันแบบ";

export const LOGO_MOCKUP_NOTE =
  "ตัวอย่างบนหน้าเว็บใช้ดูตำแหน่งโลโก้เท่านั้น ยังไม่ใช่แบบผลิต ไฟล์โลโก้จริงส่งให้ทีมขายทางอีเมลหรือ LINE";

export const MOCKUP_RETAIL_HEADING = "ช่องรีเทล";

export const MOCKUP_RETAIL_HINT =
  "พิมพ์คำสั่งเดิมเพื่อขยับรายละเอียดในรูป เช่น สูงขึ้นไปอีกนิด หรือ เปลี่ยนสีเป็นดำด้าน";

export const BUYER_ASSISTANT_TITLE = "แชท AI Smart Gift";

export const BUYER_ASSISTANT_INTRO =
  "ตอบได้เฉพาะข้อมูลสั่งผลิตบนเว็บนี้ เช่น จำนวนขั้นต่ำ วิธีใส่โลโก้ และขั้นตอนสั่ง — ไม่ใช่ใบเสนอราคา และไม่มีการชำระเงินในแชท";

export const BUYER_ASSISTANT_CTA = "แชท AI";

export const BUYER_ASSISTANT_CHIPS = [
  "สั่งขั้นต่ำกี่ชุด",
  "สกรีนโลโก้ได้อย่างไร",
  "ขั้นตอนสั่งผลิต",
  "ราคาบนเว็บหมายความว่าอย่างไร",
] as const;

export const CHINA_AFTER_ORDER_HEADING = "หลังยืนยันออเดอร์ สั่งผลิตอย่างไร";

export const QUOTE_DETAIL_HINT =
  "เลือกข้อความช่วยกรอกด้านล่าง แล้วแก้จำนวน วันที่ หรือจุดส่งให้ตรงงานของคุณ";

export const QUOTE_DETAIL_TEMPLATES = [
  {
    id: "welcome-kit",
    label: "ชุดต้อนรับพนักงานใหม่",
    body: "ต้องการชุดต้อนรับพนักงานใหม่ จำนวน … ชุด สกรีนโลโก้บริษัท แพ็กเป็นรายบุคคล ใช้ภายในวันที่ …",
  },
  {
    id: "new-year",
    label: "ของขวัญปีใหม่คู่ค้า",
    body: "ต้องการของขวัญปีใหม่สำหรับคู่ค้า จำนวน … ชุด โทนสุภาพ ใส่โลโก้ได้ จัดส่งตามที่อยู่บริษัทภายในวันที่ …",
  },
  {
    id: "team-trip",
    label: "ทริปบริษัท / ทีมบิลดิ้ง",
    body: "ต้องการของที่ระลึกทริปบริษัท จำนวน … ชุด ของพกพาที่ใช้ระหว่างเดินทาง สกรีนโลโก้ แพ็กแยกคน ส่งถึงก่อนวันเดินทางวันที่ …",
  },
  {
    id: "nature",
    label: "ธีมธรรมชาติ / รักษ์โลก",
    body: "สนใจชุดธีมธรรมชาติหรือรักษ์โลก เช่น ถุงผ้า กระบอกน้ำ สมุดรีไซเคิล สกรีนโลโก้ได้ จำนวน … ชุด สำหรับงานวันที่ …",
  },
  {
    id: "health",
    label: "ธีมสุขภาพพนักงาน",
    body: "ต้องการของขวัญสุขภาพพนักงาน เช่น กระบอกน้ำหรือของใช้ทุกวัน สกรีนโลโก้สุภาพ จำนวน … ชุด ไม่ใช่ยาหรืออาหารเสริม ใช้ภายในวันที่ …",
  },
  {
    id: "logo-ready",
    label: "มีไฟล์โลโก้แล้ว",
    body: "มีไฟล์โลโก้พร้อมส่งให้ทีมขาย ต้องการสกรีนหรือพิมพ์บนสินค้า ตำแหน่งประมาณด้านหน้า ยังไม่แน่ใจสีพิมพ์ รบกวนแนะนำ",
  },
  {
    id: "need-sample",
    label: "ขอตัวอย่างก่อนผลิต",
    body: "อยากขอดูตัวอย่างหรือแบบก่อนผลิต ก่อนเปิดสั่งจำนวนเต็ม แจ้งได้ว่าใช้เวลาและค่าใช้จ่ายประมาณเท่าไร",
  },
  {
    id: "multi-drop",
    label: "ส่งหลายจุดในไทย",
    body: "ต้องการจัดส่งหลายจุดในไทย กรุณาประเมินค่าจัดส่งในประเทศหลังทราบที่อยู่และจำนวนต่อจุด",
  },
  {
    id: "ask-recommend",
    label: "ขอให้แนะนำตามงบ",
    body: "ยังไม่ล็อกสินค้า งบประมาณประมาณ … บาทต่อชุด จำนวน … ชุด โอกาสใช้งานคือ … รบกวนแนะนำเซ็ตที่สกรีนโลโก้ได้",
  },
] as const;

export function appendQuoteDetailTemplate(
  current: string,
  templateBody: string,
): string {
  const existing = String(current || "").trim();
  const incoming = String(templateBody || "").trim();
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (existing.includes(incoming)) return existing;
  return `${existing}\n\n${incoming}`;
}

export const CHINA_AFTER_ORDER_INTRO =
  "เมื่อยืนยันสเปคและโลโก้แล้ว จึงสั่งผลิตที่โรงงาน แล้วขนส่งเข้าไทย — ไม่ตัดของจากคลังสำเร็จรูปในประเทศ";

export const CHINA_AFTER_ORDER_STEPS = [
  {
    step: "1",
    title: "ยืนยันสเปคและมัดจำ",
    body: "สรุปจำนวน สี วิธีใส่โลโก้ และวันต้องการ แล้วยืนยันตัวอย่างก่อนผลิต จากนั้นชำระมัดจำหรือเต็มจำนวนตามใบแจ้งหนี้",
  },
  {
    step: "2",
    title: "สั่งผลิตที่โรงงาน",
    body: "หลังอนุมัติแบบ จึงเปิดออเดอร์ผลิตตามจำนวนที่ตกลง",
  },
  {
    step: "3",
    title: "ขนส่งเข้าไทย",
    body: "สินค้าเดินทางจากจีน ค่าขนส่งรวมในราคาโดยประมาณที่เห็นบนเว็บ",
  },
  {
    step: "4",
    title: "ตรวจ แพ็ก จัดส่ง",
    body: "ตรวจคุณภาพ แพ็กตามจุดส่งในไทย แล้วจัดส่งตามนัด",
  },
] as const;
