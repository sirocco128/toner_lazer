export const SCHEDULE_KINDS = [
  "sales_meeting",
  "delivery",
  "pickup",
  "internal",
  "other",
] as const;

export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

export const SCHEDULE_KIND_LABELS: Record<ScheduleKind, string> = {
  sales_meeting: "นัดคุยเซลล์ / ดูตัวอย่าง",
  delivery: "นัดส่งมอบ",
  pickup: "นัดรับของ",
  internal: "ประชุมภายใน",
  other: "อื่นๆ",
};

export const SCHEDULE_STATUSES = [
  "scheduled",
  "confirmed",
  "cancelled",
  "done",
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  scheduled: "นัดแล้ว",
  confirmed: "ยืนยันแล้ว",
  cancelled: "ยกเลิก",
  done: "เสร็จสิ้น",
};

export const SCHEDULE_ATTENDEE_ROLES = ["staff", "external"] as const;
export type ScheduleAttendeeRole = (typeof SCHEDULE_ATTENDEE_ROLES)[number];

export const WEEKDAY_LABELS_TH = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
] as const;

export type ScheduleAttendeeInput = {
  role: ScheduleAttendeeRole;
  email: string;
  name?: string;
  staffId?: number | null;
  notify?: boolean;
};

export type ScheduleAttendee = {
  id: number;
  eventId: string;
  role: ScheduleAttendeeRole;
  staffId: number | null;
  email: string;
  name: string | null;
  notify: boolean;
  lastNotifyStatus: string | null;
  lastNotifyError: string | null;
  lastNotifyAt: string | null;
  createdAt: string;
};

export type ScheduleEvent = {
  id: string;
  kind: ScheduleKind;
  title: string;
  notes: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: ScheduleStatus;
  customerId: number | null;
  orderId: string | null;
  location: string | null;
  hostEmail: string;
  createdByEmail: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  attendees: ScheduleAttendee[];
};

export type ScheduleAvailabilityRow = {
  id: number;
  staffEmail: string;
  weekday: number;
  enabled: boolean;
  startMinute: number;
  endMinute: number;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleAvailabilityInterval = {
  weekday: number;
  enabled: boolean;
  startMinute: number;
  endMinute: number;
};

export type CreateScheduleEventInput = {
  kind: ScheduleKind;
  title: string;
  notes?: string;
  startsAt: string;
  endsAt: string;
  status?: ScheduleStatus;
  customerId?: number | null;
  orderId?: string | null;
  location?: string;
  hostEmail: string;
  createdByEmail: string;
  createdByName?: string;
  attendees: ScheduleAttendeeInput[];
};

export type UpdateScheduleEventInput = {
  id: string;
  kind?: ScheduleKind;
  title?: string;
  notes?: string | null;
  startsAt?: string;
  endsAt?: string;
  status?: ScheduleStatus;
  customerId?: number | null;
  orderId?: string | null;
  location?: string | null;
  hostEmail?: string;
  attendees?: ScheduleAttendeeInput[];
};

export type ScheduleSlot = {
  ymd: string;
  startMinute: number;
  endMinute: number;
  startsAt: string;
  endsAt: string;
};

export function isScheduleKind(value: string): value is ScheduleKind {
  return (SCHEDULE_KINDS as readonly string[]).includes(value);
}

export function isScheduleStatus(value: string): value is ScheduleStatus {
  return (SCHEDULE_STATUSES as readonly string[]).includes(value);
}

export function defaultKindTitle(kind: ScheduleKind): string {
  return SCHEDULE_KIND_LABELS[kind];
}
