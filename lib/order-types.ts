export const FULFILLMENT_STATUSES = [
  "reserved",
  "awaiting_production",
  "producing",
  "in_transit",
  "inbound",
  "warehouse",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  reserved: "จองสินค้าแล้ว",
  awaiting_production: "รอสั่งผลิต",
  producing: "กำลังผลิต",
  in_transit: "กำลังขนส่งจากจีน",
  inbound: "รอเข้าประเทศ",
  warehouse: "เข้าคลังสินค้าแล้ว",
  out_for_delivery: "กำลังจัดส่งถึงลูกค้า",
  delivered: "ส่งถึงลูกค้าแล้ว",
  cancelled: "ยกเลิก",
};

export const PAYMENT_STATUSES = [
  "deposit_due",
  "deposit_paid",
  "balance_due",
  "paid",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  deposit_due: "รอชำระมัดจำ",
  deposit_paid: "ชำระมัดจำแล้ว",
  balance_due: "รอชำระส่วนที่เหลือ",
  paid: "ชำระครบแล้ว",
};

export const PAYMENT_KINDS = ["deposit", "remaining", "full"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  deposit: "มัดจำ",
  remaining: "ส่วนที่เหลือ",
  full: "เต็มจำนวน",
};

export const PAYMENT_RECORD_STATUSES = [
  "pending",
  "submitted",
  "confirmed",
  "rejected",
  "expired",
] as const;

export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export const PAYMENT_RECORD_STATUS_LABELS: Record<PaymentRecordStatus, string> = {
  pending: "รอชำระ",
  submitted: "รอบัญชีอนุมัติยอด",
  confirmed: "รับชำระแล้ว",
  rejected: "บัญชีปฏิเสธ",
  expired: "หมดอายุ",
};

export const OPEN_PAYMENT_STATUSES: PaymentRecordStatus[] = [
  "pending",
  "submitted",
  "rejected",
];

export function isOpenPaymentStatus(status: PaymentRecordStatus): boolean {
  return OPEN_PAYMENT_STATUSES.includes(status);
}

export const BILLING_DOCUMENT_TYPES = [
  "deposit_invoice",
  "deposit_receipt",
  "balance_invoice",
  "tax_invoice",
  "receipt",
] as const;

export type BillingDocumentType = (typeof BILLING_DOCUMENT_TYPES)[number];

export const BILLING_DOCUMENT_LABELS: Record<BillingDocumentType, string> = {
  deposit_invoice: "ใบแจ้งหนี้มัดจำ",
  deposit_receipt: "ใบเสร็จรับเงินมัดจำ",
  balance_invoice: "ใบแจ้งหนี้ส่วนที่เหลือ",
  tax_invoice: "ใบกำกับภาษี",
  receipt: "ใบเสร็จรับเงิน",
};

export type OrderRecord = {
  id: number;
  orderId: string;
  quoteRequestId: string | null;
  customerId: number | null;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  billingName: string;
  billingTaxId: string | null;
  billingAddress: string | null;
  billingBranch: string;
  shipToName: string | null;
  shipToPhone: string | null;
  shipToAddress: string | null;
  shipToProvince: string | null;
  productSummary: string;
  quantity: number;
  currency: string;
  vatRate: number;
  vatMode: "exclusive" | "inclusive";
  subtotalExVat: number;
  vatAmount: number;
  totalAmount: number;
  depositMode: "auto" | "percent" | "full";
  depositPercent: number;
  depositAmount: number;
  remainingAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  accessToken: string;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type PaymentRecord = {
  id: number;
  paymentId: string;
  orderId: string;
  kind: PaymentKind;
  amount: number;
  method: string;
  status: PaymentRecordStatus;
  qrPayload: string | null;
  customerReference: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingDocumentRecord = {
  id: number;
  documentId: string;
  documentType: BillingDocumentType;
  orderId: string;
  paymentId: string | null;
  status: "issued" | "void";
  subtotalExVat: number;
  vatAmount: number;
  grandTotal: number;
  amountText: string;
  lineDescription: string;
  issuedAt: string;
  voidedAt: string | null;
  buyerName: string;
  buyerTaxId: string | null;
  buyerAddress: string | null;
  buyerBranch: string | null;
  createdAt: string;
};

export type OrderEventRecord = {
  id: number;
  orderId: string;
  eventType: string;
  message: string;
  actor: string | null;
  createdAt: string;
};
