/** กติกาสถานะการ์ดบนบอร์ดงาน — ใช้โชว์ในหน้าทำงานและเอกสารทีม */

export const BOARD_MAIN_FLOW =
  "Backlog → Todo → In Progress → รออนุมัติ → Done";

export const BOARD_STATUSES = [
  { id: "backlog", label: "Backlog", meaning: "งานเข้าคิวแล้ว แต่ยังไม่เริ่มจัดทำ" },
  { id: "todo", label: "Todo", meaning: "พร้อมทำในรอบนี้" },
  { id: "in_progress", label: "In Progress", meaning: "มีคนรับแล้ว กำลังทำ" },
  { id: "pending_approval", label: "รออนุมัติ", meaning: "ส่งให้ผู้อนุมัติแล้ว" },
  { id: "done", label: "Done", meaning: "เสร็จและปิดงานแล้ว" },
  { id: "blocked", label: "Blocked", meaning: "ติดปัญหาภายนอก ทำต่อไม่ได้ชั่วคราว" },
  { id: "rejected", label: "Rejected", meaning: "อนุมัติไม่ผ่าน ต้องแก้แล้วส่งใหม่" },
  { id: "cancelled", label: "Cancelled", meaning: "ยกเลิก ไม่ทำต่อ" },
] as const;

export type BoardStatusId = (typeof BOARD_STATUSES)[number]["id"];

/** กติกาย้ายสถานะ: จาก → ไปได้ */
export const BOARD_TRANSITIONS: Record<BoardStatusId, BoardStatusId[]> = {
  backlog: ["todo", "cancelled"],
  todo: ["in_progress", "backlog", "cancelled"],
  in_progress: ["pending_approval", "blocked", "todo", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  pending_approval: ["done", "rejected", "cancelled"],
  rejected: ["in_progress", "cancelled"],
  done: [],
  cancelled: [],
};

/** กติกาสั้น ๆ ที่ทีมควรจำ — โชว์เป็น note บนหน้าทำงาน */
export const BOARD_TEAM_RULES = [
  "เริ่มงานจริงเมื่ออยู่ In Progress เท่านั้น",
  "ส่งอนุมัติได้จาก In Progress เท่านั้น",
  "ปิดงาน (Done) ได้เฉพาะจาก รออนุมัติ หลังผ่านอนุมัติ",
  "Blocked ใช้เมื่อติดภายนอก ไม่ใช่ตอนยังไม่เริ่มทำ",
  "Rejected ต้องกลับไปทำใหม่ที่ In Progress ก่อนส่งอนุมัติซ้ำ",
  "Cancelled คือปิดทิ้ง ไม่ลบการ์ด",
  "การ์ด Done / Cancelled ไม่โชว์บนบอร์ดหลัก (ดูในรายการปิดงาน)",
] as const;
