export const DESTINATIONS = ["warehouse", "ship_to"] as const;
export type DestinationMode = (typeof DESTINATIONS)[number];

export const DESTINATION_LABELS: Record<DestinationMode, string> = {
  warehouse: "เข้าคลังไทย",
  ship_to: "ไม่เข้าคลัง — ส่งตรงลูกค้า",
};

export const CASH_LINE_KINDS = [
  "deposit",
  "remaining",
  "full",
  "extra",
  "claim_settle",
] as const;
export type CashLineKind = (typeof CASH_LINE_KINDS)[number];

export const CASH_LINE_KIND_LABELS: Record<CashLineKind, string> = {
  deposit: "มัดจำ",
  remaining: "ส่วนที่เหลือ",
  full: "เต็มจำนวน",
  extra: "รายการรับอื่น",
  claim_settle: "ชำระตามเคลม",
};

export const ISSUE_CATEGORIES = [
  "quality",
  "logo",
  "missing",
  "delay",
  "delivery",
  "other",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  quality: "คุณภาพสินค้า",
  logo: "สกรีนโลโก้",
  missing: "ของไม่ครบ",
  delay: "ล่าช้า",
  delivery: "จัดส่ง",
  other: "อื่น ๆ",
};

export const ISSUE_STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  open: "เปิดใหม่",
  in_progress: "กำลังดำเนินการ",
  waiting: "รอข้อมูล",
  resolved: "แก้ไขแล้ว",
  closed: "ปิด",
};

export const CLAIM_AGAINST = ["factory", "customer", "carrier"] as const;
export type ClaimAgainst = (typeof CLAIM_AGAINST)[number];

export const CLAIM_AGAINST_LABELS: Record<ClaimAgainst, string> = {
  factory: "โรงงาน",
  customer: "ลูกค้า",
  carrier: "ขนส่ง",
};

export const CLAIM_STATUSES = [
  "open",
  "reviewing",
  "approved",
  "rejected",
  "settled",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  open: "เปิด",
  reviewing: "กำลังตรวจ",
  approved: "อนุมัติ",
  rejected: "ไม่รับ",
  settled: "ปิดเคลม",
};

export type GoodsReceiptRecord = {
  id: number;
  receiptId: string;
  poId: string;
  orderId: string | null;
  destination: DestinationMode;
  qtyOrdered: number;
  qtyReceived: number;
  qtyDamaged: number;
  qtyShort: number;
  unitThb: number;
  amountThb: number;
  qcNotes: string | null;
  trackingTh: string | null;
  status: "posted" | "void";
  productKey: string | null;
  locationId: number | null;
  receivedAt: string;
  createdBy: string | null;
  createdAt: string;
};

export type CashReceiptLine = {
  id: number;
  voucherId: string;
  lineNo: number;
  kind: CashLineKind;
  description: string;
  amount: number;
  paymentId: string | null;
  orderId: string | null;
};

export type CashReceiptRecord = {
  id: number;
  voucherId: string;
  orderId: string | null;
  payerName: string;
  status: "open" | "confirmed" | "void";
  totalAmount: number;
  qrPayload: string | null;
  method: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  notes: string | null;
  accessToken: string | null;
  rejectReason: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lines: CashReceiptLine[];
};

export const PAYABLE_KINDS = ["factory", "freight"] as const;
export type PayableKind = (typeof PAYABLE_KINDS)[number];

export const PAYABLE_KIND_LABELS: Record<PayableKind, string> = {
  factory: "เจ้าหนี้โรงงาน",
  freight: "เจ้าหนี้ขนส่งและนำเข้า",
};

export function isPayableKind(value: string | null | undefined): value is PayableKind {
  return (PAYABLE_KINDS as readonly string[]).includes(String(value || ""));
}

export type SupplierPaymentRecord = {
  id: number;
  payId: string;
  poId: string;
  receiptId: string | null;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  payableKind: PayableKind;
};

export type AssetRecord = {
  id: number;
  assetCode: string;
  kind: "inventory_lot" | "fixed";
  name: string;
  qty: number;
  unit: string;
  valueThb: number;
  location: string;
  poId: string | null;
  orderId: string | null;
  receiptId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClaimRecord = {
  id: number;
  claimId: string;
  against: ClaimAgainst;
  poId: string | null;
  orderId: string | null;
  receiptId: string | null;
  issueId: string | null;
  qty: number;
  amountThb: number;
  reason: string;
  status: ClaimStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IssueTicketRecord = {
  id: number;
  issueId: string;
  source: "public" | "ops";
  company: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  orderId: string | null;
  poId: string | null;
  category: IssueCategory;
  title: string;
  detail: string;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
};

export function isDestination(value: string): value is DestinationMode {
  return (DESTINATIONS as readonly string[]).includes(value);
}

export function isCashLineKind(value: string): value is CashLineKind {
  return (CASH_LINE_KINDS as readonly string[]).includes(value);
}

export function isIssueCategory(value: string): value is IssueCategory {
  return (ISSUE_CATEGORIES as readonly string[]).includes(value);
}

export function isIssueStatus(value: string): value is IssueStatus {
  return (ISSUE_STATUSES as readonly string[]).includes(value);
}

export function isClaimAgainst(value: string): value is ClaimAgainst {
  return (CLAIM_AGAINST as readonly string[]).includes(value);
}

export function isClaimStatus(value: string): value is ClaimStatus {
  return (CLAIM_STATUSES as readonly string[]).includes(value);
}
