# กติกาสถานะการ์ด — บอร์ดงาน

ใช้กับหน้าทำงาน `/ops/board` และโน้ตบน `/ops`

## Flow หลัก

`Backlog → Todo → In Progress → รออนุมัติ → Done`

## สถานะการ์ด

| สถานะ | ความหมาย |
|---|---|
| Backlog | งานเข้าคิวแล้ว แต่ยังไม่เริ่มจัดทำ |
| Todo | พร้อมทำในรอบนี้ |
| In Progress | มีคนรับแล้ว กำลังทำ |
| รออนุมัติ | ส่งให้ผู้อนุมัติแล้ว |
| Done | เสร็จและปิดงานแล้ว |
| Blocked | ติดปัญหาภายนอก ทำต่อไม่ได้ชั่วคราว |
| Rejected | อนุมัติไม่ผ่าน ต้องแก้แล้วส่งใหม่ |
| Cancelled | ยกเลิก ไม่ทำต่อ |

## Flow เสริม

- ติดขัด: `In Progress ↔ Blocked`
- ไม่ผ่านอนุมัติ: `รออนุมัติ → Rejected → In Progress → รออนุมัติ`
- ยกเลิก: จากสถานะใดก็ได้ (ยกเว้น Done) → `Cancelled`

## กติกาย้ายสถานะ

| อยู่ที่ | ย้ายไปได้ |
|---|---|
| Backlog | Todo, Cancelled |
| Todo | In Progress, Backlog, Cancelled |
| In Progress | รออนุมัติ, Blocked, Todo, Cancelled |
| Blocked | In Progress, Cancelled |
| รออนุมัติ | Done, Rejected, Cancelled |
| Rejected | In Progress, Cancelled |
| Done | ย้ายต่อไม่ได้ (ยกเว้นเปิดงานใหม่เป็นกรณีพิเศษ) |
| Cancelled | ย้ายต่อไม่ได้ (หรือเปิดกลับเป็น Backlog ถ้าต้องการ) |

## กติกาสั้น ๆ ที่ทีมควรจำ

1. เริ่มงานจริงเมื่ออยู่ In Progress เท่านั้น
2. ส่งอนุมัติได้จาก In Progress เท่านั้น
3. ปิดงาน (Done) ได้เฉพาะจาก รออนุมัติ หลังผ่านอนุมัติ
4. Blocked ใช้เมื่อติดภายนอก ไม่ใช่ตอนยังไม่เริ่มทำ
5. Rejected ต้องกลับไปทำใหม่ที่ In Progress ก่อนส่งอนุมัติซ้ำ
6. Cancelled คือปิดทิ้ง ไม่ลบการ์ด
7. การ์ด Done / Cancelled ไม่โชว์บนบอร์ดหลัก (ดูในรายการปิดงาน)

## โค้ดอ้างอิง

- ข้อมูลกติกา: `lib/board-status-rules.ts`
- โน้ตบนหน้าจอ: `components/BoardStatusRulesNote.tsx`
- หน้าบอร์ด: `app/ops/board/page.tsx`
