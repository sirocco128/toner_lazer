/**
 * Public buyer copy for the toner business (Thai). Claims here must match
 * the business plan: warranty, government paperwork, tax invoice, delivery.
 */

export const TONER_TAGLINE_EN = "Compatible toner for offices and government";

export const TONER_PROMISE =
  "ตลับหมึกเลเซอร์เทียบเท่า ประหยัดกว่าของแท้ เอกสารยื่นงานรัฐครบ";

export const TONER_HERO_BODY =
  "ค้นหาตลับหมึกจากรุ่นเครื่องพิมพ์ ขอใบเสนอราคาได้ทันที ส่งถึงหน่วยงาน ออกใบกำกับภาษี และวางบิลได้";

export const TONER_SERVICE_POINTS = [
  {
    title: "ประหยัดกว่าของแท้",
    body: "ราคาต่อตลับต่ำกว่าตลับแท้หลายเท่า คิดเป็นต้นทุนต่อหน้าที่ชัดเจน",
  },
  {
    title: "เอกสารยื่นงานรัฐครบ",
    body: "หนังสือรับรองบริษัท ภ.พ.20 สเปกและผลทดสอบจำนวนหน้า พร้อมใช้กับวิธีเฉพาะเจาะจงและ e-GP",
  },
  {
    title: "รับประกันคุณภาพ",
    body: "ตลับที่พิมพ์ไม่ผ่านเปลี่ยนใหม่ให้ แจ้งเคลมผ่าน LINE หรือหน้าเว็บ",
  },
  {
    title: "ส่งถึงหน่วยงาน",
    body: "จัดส่งถึงสำนักงานทั่วประเทศ พร้อมใบส่งของและใบกำกับภาษีในกล่อง",
  },
] as const;

export const TONER_BUY_STEPS = [
  { title: "ค้นรุ่นเครื่องพิมพ์", body: "พิมพ์รุ่นเครื่อง เช่น HP M1132 หรือรหัสตลับ เช่น 85A" },
  { title: "ขอใบเสนอราคา", body: "ระบุจำนวนและหน่วยงาน ทีมขายส่งใบเสนอราคาให้ภายในวันทำการ" },
  { title: "ยืนยันและรับของ", body: "ยืนยันใบเสนอราคา รับของพร้อมเอกสาร แล้ววางบิลตามเครดิตของหน่วยงาน" },
] as const;
