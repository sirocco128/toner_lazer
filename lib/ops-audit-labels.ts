export type OpsAuditStatus = "ok" | "denied";

export const OPS_AUDIT_ACTION_LABELS: Record<string, string> = {
  login: "เข้าสู่ระบบ",
  logout: "ออกจากระบบ",
  "quote.update": "แก้ใบเสนอราคา",
  "customer.update": "แก้ลูกค้า",
  "customer.create": "สร้างลูกค้า",
  "customer.merge": "รวมลูกค้า",
  "order.create": "เปิดออเดอร์",
  "order.update": "แก้ออเดอร์",
  "payment.record": "บันทึกชำระ",
  "staff.create": "สร้างผู้ใช้",
  "staff.update": "แก้ผู้ใช้ / สิทธิ์",
  "journal.manual": "ลงสมุดรายวัน",
  "coa.upsert": "แก้ผังบัญชี",
  "goods_receipt.create": "รับสินค้าเข้า",
  "supplier_pay.create": "จ่ายโรงงาน",
  "cash_receipt.create": "ออกใบรับเงิน",
  "cash_receipt.confirm": "อนุมัติรับเงิน",
  "cash_receipt.reject": "ปฏิเสธยอด / สลิป",
  "asset.create": "ลงทะเบียนทรัพย์",
  "claim.create": "เปิดเคลม",
  "claim.from_issue": "เปิดเคลมจากเรื่อง",
  "claim.status": "เปลี่ยนสถานะเคลม",
  "issue.create": "รับเรื่องปัญหา",
  "issue.status": "เปลี่ยนสถานะเรื่อง",
  "assistant.ops": "เรียกผู้ช่วยเซลล์",
  "report.view": "ดูรายงาน",
  "report.export": "ดึงรายงาน",
  "object.upload": "อัปโหลดไฟล์",
  "object.download": "เปิด / ดาวน์โหลดไฟล์",
  "object.deny": "ถูกปฏิเสธไฟล์",
  "object.delete": "ลบไฟล์",
  "object.hold": "พักลบเอกสาร",
  "object.hold.release": "ปลดการพักลบ",
  "factory.upsert": "บันทึกโรงงาน",
  "factory.create": "สร้างโรงงาน",
  "factory.update": "แก้ทะเบียนโรงงาน",
  "factory_po.create": "สร้างใบสั่งโรงงาน",
  "factory_po.update": "แก้ใบสั่งโรงงาน",
  "product.write": "แก้สินค้า",
  "price.batch": "อัปเดตราคาชุด",
  "schedule.create": "สร้างนัดหมาย",
  "schedule.update": "แก้ / ยกเลิกนัดหมาย",
  "schedule.notify": "ส่งเมลแจ้งนัดหมาย",
  "schedule.availability": "แก้ชั่วโมงว่าง",
  "schedule.book": "จองนัดหมายสาธารณะ",
  "knowledge.diff": "เทียบคลังความรู้ Smart Gift",
  "knowledge.sync": "อัปเดตคลังความรู้ Smart Gift",
};

export function opsAuditActionLabel(action: string): string {
  return OPS_AUDIT_ACTION_LABELS[action] || action;
}

function asRecord(detail: unknown): Record<string, unknown> {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return {};
  return detail as Record<string, unknown>;
}

function text(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  return s;
}

function formatFilters(filters: unknown): string {
  if (!filters) return "";
  if (typeof filters === "string") return filters;
  const rec = asRecord(filters);
  const parts = Object.entries(rec)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}=${v}`);
  return parts.join(" · ");
}

export function describeOpsAuditImpact(params: {
  action: string;
  status: OpsAuditStatus;
  resourceType?: string | null;
  resourceId?: string | null;
  reportName?: string | null;
  reportFilters?: unknown;
  detail?: unknown;
  errorMessage?: string | null;
}): string {
  const detail = asRecord(params.detail);
  const id = text(params.resourceId);
  const filters = formatFilters(params.reportFilters ?? detail.filters);
  const report = text(params.reportName) || text(detail.reportName);

  if (params.status === "denied") {
    const why = text(params.errorMessage) || "ไม่มีสิทธิ์หรือข้อมูลไม่ถูกต้อง";
    if (params.action === "login") return `เข้าสู่ระบบไม่สำเร็จ — ${why}`;
    return `ถูกปฏิเสธ: ${opsAuditActionLabel(params.action)} — ${why}`;
  }

  switch (params.action) {
    case "login":
      return text(detail.method) === "google"
        ? "เข้าสู่ระบบด้วย Google"
        : "เข้าสู่ระบบคอนโซล Smart Gift";
    case "logout":
      return "ออกจากระบบ";
    case "quote.update":
      return `แก้สถานะใบเสนอราคา ${id} เป็น ${text(detail.leadStatus) || "—"} — มีผลที่คิวใบเสนอราคาและไทม์ไลน์ลูกค้า`;
    case "customer.update":
      return `แก้บัตรลูกค้า #${id}${text(detail.status) ? ` สถานะ ${text(detail.status)}` : ""}`;
    case "cash_receipt.confirm":
      return `อนุมัติรับเงิน ${id}${detail.total != null ? ` ยอด ${detail.total}` : ""} — ยอดเข้าออเดอร์และสมุดบัญชี`;
    case "cash_receipt.reject":
      return `ปฏิเสธยอด ${id}${text(detail.reason) ? ` เหตุผล: ${text(detail.reason)}` : ""} — เงินยังไม่เข้าบัญชี`;
    case "cash_receipt.create":
      return `ออกใบรับเงิน ${id}${detail.total != null ? ` ยอด ${detail.total}` : ""}`;
    case "goods_receipt.create":
      return `รับสินค้า ${id} จาก PO ${text(detail.poId)} จำนวน ${text(detail.qty)} — มีผลสต็อก/เคลม/จ่ายโรงงาน`;
    case "supplier_pay.create":
      return `จ่ายโรงงาน ${id} จำนวน ${text(detail.amount)} — ลงสมุดจ่ายและลดเจ้าหนี้`;
    case "journal.manual":
      return `ลงสมุดรายวัน ${id} (${text(detail.memo)}) — งบทดลอง / งบดุล / กำไรขาดทุนขยับ`;
    case "coa.upsert":
      return `บันทึกผังบัญชี ${id} ${text(detail.nameTh)}`;
    case "staff.create":
      return `สร้างผู้ใช้ ${text(detail.email)} บทบาท ${text(detail.role)} — มีผลสิทธิ์เข้าคอนโซล`;
    case "staff.update":
      return `แก้ผู้ใช้ ${id} — มีผลสิทธิ์เข้าหน้าและอนุมัติ`;
    case "report.view":
      return `ดูรายงาน ${report || "—"} ${filters ? `(${filters})` : ""}`.trim();
    case "report.export":
      return `ดึงไฟล์รายงาน ${report || "—"} ${filters ? `(${filters})` : ""}`.trim();
    case "assistant.ops":
      return "เรียกผู้ช่วยเซลล์ (ไม่ออกใบเสนอราคาและไม่เปิดต้นทุนโรงงาน)";
    case "knowledge.diff":
      return `เทียบคลัง Smart Gift — พบ ${text(detail.changedCount) || "0"} หัวข้อที่เปลี่ยน`;
    case "knowledge.sync":
      return `อัปเดตคลัง Smart Gift${text(detail.lastSyncAt) ? ` เวลา ${text(detail.lastSyncAt)}` : ""} — ไม่แตะราคา/ต้นทุนโรงงาน`;
    case "object.download":
      return `เปิดไฟล์ ${id || text(detail.key)}`;
    case "claim.create":
    case "claim.from_issue":
      return `เปิดเคลม ${id} — มีผลต้นทุน/โรงงาน`;
    case "claim.status":
      return `เปลี่ยนสถานะเคลม ${id} เป็น ${text(detail.status) || "—"}`;
    default:
      break;
  }

  const bits = [
    opsAuditActionLabel(params.action),
    params.resourceType && id ? `${params.resourceType} ${id}` : id,
  ].filter(Boolean);
  return bits.join(" — ") || opsAuditActionLabel(params.action);
}

export function formatOpsReportFilters(
  filters: Record<string, string | number | null | undefined> | null | undefined,
): string | null {
  if (!filters) return null;
  const parts = Object.entries(filters)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? parts.join(" · ") : null;
}
