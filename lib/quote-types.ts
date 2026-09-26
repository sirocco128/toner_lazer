export const DECORATION_METHODS = [
  "screen-print",
  "emboss",
  "laser",
  "full-color",
  "uv-print",
  "embroidery",
  "not-sure",
] as const;

export const DECORATION_METHOD_OPTIONS: ReadonlyArray<{
  value: DecorationMethod;
  label: string;
}> = [
  { value: "not-sure", label: "ยังไม่แน่ใจ" },
  { value: "screen-print", label: "สกรีน" },
  { value: "emboss", label: "ปั๊มนูน" },
  { value: "laser", label: "เลเซอร์" },
  { value: "full-color", label: "พิมพ์สี" },
  { value: "uv-print", label: "พิมพ์ UV" },
  { value: "embroidery", label: "ปัก" },
];

/** Max length for the submitted product-interest summary (DB column is TEXT). */
export const PRODUCT_INTEREST_MAX = 800;

export type DecorationMethod = (typeof DECORATION_METHODS)[number];

export const WEBHOOK_STATUSES = [
  "pending",
  "processing",
  "sent",
  "failed",
  "dead",
  "skipped",
] as const;

export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "won",
  "lost",
  "archived",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "ใหม่",
  contacted: "ติดต่อแล้ว",
  quoted: "ส่งใบเสนอราคาแล้ว",
  won: "ปิดการขาย",
  lost: "ไม่สำเร็จ",
  archived: "เก็บถาวร",
};

export const WEBHOOK_STATUS_LABELS: Record<WebhookStatus, string> = {
  pending: "รอส่งต่อ",
  processing: "กำลังส่งต่อ",
  sent: "ส่งต่อแล้ว",
  failed: "ส่งต่อไม่สำเร็จ",
  dead: "หยุดส่งต่อ",
  skipped: "ไม่ได้ตั้งค่า",
};

export type QuoteRequestInput = {
  name: string;
  company: string;
  email: string;
  phone: string;
  quantity: number;
  consent: boolean;
  budgetPerSet?: number;
  neededDate?: string;
  streetAddress?: string;
  province?: string;
  district?: string;
  subdistrict?: string;
  zip?: string;
  taxId?: string;
  billingBranch?: string;
  productInterest?: string;
  productSlug?: string;
  decorationMethod: DecorationMethod;
  detail?: string;
  landingPath?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  /** Honeypot — must be empty for real submissions. */
  website?: string;
  /** Client form open timestamp in milliseconds. */
  startedAt?: number;
};

export type QuoteLeadPayload = {
  name: string;
  company: string;
  email: string;
  phone: string;
  quantity: number;
  budgetPerSet?: number | null;
  neededDate?: string | null;
  streetAddress?: string | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  zip?: string | null;
  taxId?: string | null;
  billingBranch?: string | null;
  productInterest?: string | null;
  productSlug?: string | null;
  decorationMethod: DecorationMethod;
  detail?: string | null;
  landingPath?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  consent: true;
};

export type QuoteWebhookEvent = {
  event: "quote.requested";
  requestId: string;
  submittedAt: string;
  attempt: number;
  lead: QuoteLeadPayload;
};

export type QuoteSalesTimelineEntry = {
  id: number;
  requestId: string;
  createdAt: string;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  note: string | null;
};

export type QuoteRequestRecord = {
  id: number;
  requestId: string;
  submittedAt: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  quantity: number;
  budgetPerSet: number | null;
  neededDate: string | null;
  province: string | null;
  billingBranch: string | null;
  productInterest: string | null;
  productSlug: string | null;
  decorationMethod: DecorationMethod;
  detail: string | null;
  consentAt: string;
  landingPath: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  ipHash: string;
  userAgent: string | null;
  leadStatus: LeadStatus;
  webhookStatus: WebhookStatus;
  webhookAttemptCount: number;
  webhookError: string | null;
  webhookDeliveredAt: string | null;
  webhookLastAttemptAt: string | null;
  webhookNextAttemptAt: string | null;
  rawPayload: string;
  customerId: number | null;
  salesNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuoteFieldErrors = Partial<
  Record<keyof QuoteRequestInput | "form" | "consent", string>
>;

export type QuoteSubmitSuccess = {
  ok: true;
  requestId: string;
  neutral?: boolean;
};

export type QuoteSubmitFailure = {
  ok: false;
  error: string;
  fieldErrors?: QuoteFieldErrors;
};

export type QuoteSubmitResult = QuoteSubmitSuccess | QuoteSubmitFailure;

export type RetryBatchResult = {
  ok: true;
  processed: number;
  sent: number;
  failed: number;
  dead: number;
  results: Array<{
    requestId: string;
    status: WebhookStatus;
    error?: string;
  }>;
  processedAt: string;
};
