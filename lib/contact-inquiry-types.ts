export const CONTACT_TOPICS = [
  "contact",
  "inquiry",
  "complaint",
  "other",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  contact: "ติดต่อทั่วไป",
  inquiry: "สอบถาม",
  complaint: "ร้องเรียน",
  other: "อื่นๆ",
};

export const CONTACT_CALLBACK_CHANNELS = ["email", "phone", "both"] as const;

export type ContactCallbackChannel = (typeof CONTACT_CALLBACK_CHANNELS)[number];

export const CONTACT_CALLBACK_LABELS: Record<ContactCallbackChannel, string> = {
  email: "อีเมล",
  phone: "โทรศัพท์",
  both: "ทั้งอีเมลและโทรศัพท์",
};

export const CONTACT_INQUIRY_STATUSES = ["new", "contacted", "closed"] as const;

export type ContactInquiryStatus = (typeof CONTACT_INQUIRY_STATUSES)[number];

export const CONTACT_INQUIRY_STATUS_LABELS: Record<ContactInquiryStatus, string> =
  {
    new: "ใหม่",
    contacted: "ติดต่อแล้ว",
    closed: "ปิดเรื่อง",
  };

export const CONTACT_MAIL_STATUSES = [
  "pending",
  "sent",
  "skipped",
  "failed",
] as const;

export type ContactMailStatus = (typeof CONTACT_MAIL_STATUSES)[number];

export const CONTACT_MAIL_STATUS_LABELS: Record<ContactMailStatus, string> = {
  pending: "รอส่ง",
  sent: "ส่งแล้ว",
  skipped: "ไม่ส่งจดหมาย",
  failed: "ส่งไม่ถึง",
};

export function contactMailErrorLabel(error: string | null): string | null {
  if (!error) return null;
  if (error === "not_configured") return "ยังไม่ได้ตั้งค่าจดหมายตอบรับ";
  return "ส่งจดหมายไม่สำเร็จ";
}

export type ContactInquiryInput = {
  topic: ContactTopic;
  name: string;
  company?: string;
  email: string;
  phone: string;
  callbackChannel: ContactCallbackChannel;
  message: string;
  consent: boolean;
  landingPath?: string;
  website?: string;
  startedAt?: number;
};

export type ContactInquiryRecord = {
  id: number;
  inquiryId: string;
  submittedAt: string;
  topic: ContactTopic;
  name: string;
  company: string | null;
  email: string;
  phone: string;
  callbackChannel: ContactCallbackChannel;
  message: string;
  consentAt: string;
  status: ContactInquiryStatus;
  mailStatus: ContactMailStatus;
  mailError: string | null;
  mailSentAt: string | null;
  ipHash: string;
  userAgent: string | null;
  landingPath: string | null;
  createdAt: string;
  updatedAt: string;
};
