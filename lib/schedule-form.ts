import {
  bangkokLocalToUtcIso,
  bangkokYmdDash,
  parseHmToMinute,
} from "@/lib/bangkok-date";
import type {
  ScheduleAttendeeInput,
  ScheduleEvent,
  ScheduleKind,
  ScheduleStatus,
} from "@/lib/schedule-types";

export type EventFormStaffOption = {
  email: string;
  name: string;
  staffId?: number;
};

export type EventFormValues = {
  kind: ScheduleKind;
  title: string;
  notes: string;
  ymd: string;
  startHm: string;
  endHm: string;
  status: ScheduleStatus;
  location: string;
  hostEmail: string;
  customerId: string;
  orderId: string;
  staffEmails: string[];
  externalEmails: string;
  notify: boolean;
};

function toAttendees(
  values: EventFormValues,
  staffOptions: EventFormStaffOption[],
): ScheduleAttendeeInput[] {
  const out: ScheduleAttendeeInput[] = [];
  const seen = new Set<string>();
  for (const email of values.staffEmails) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    const staff = staffOptions.find((s) => s.email === normalized);
    out.push({
      role: "staff",
      email: normalized,
      name: staff?.name,
      staffId: staff?.staffId ?? null,
      notify: values.notify,
    });
  }
  const host = values.hostEmail.trim().toLowerCase();
  if (host && !seen.has(host)) {
    const staff = staffOptions.find((s) => s.email === host);
    out.push({
      role: "staff",
      email: host,
      name: staff?.name,
      staffId: staff?.staffId ?? null,
      notify: values.notify,
    });
  }
  for (const raw of values.externalEmails.split(/[,;\n]+/)) {
    const email = raw.trim().toLowerCase();
    if (!email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    out.push({ role: "external", email, notify: values.notify });
  }
  return out;
}

export function buildEventPayload(
  values: EventFormValues,
  staffOptions: EventFormStaffOption[],
) {
  const startMin = parseHmToMinute(values.startHm) ?? 9 * 60;
  const endMin = parseHmToMinute(values.endHm) ?? startMin + 30;
  return {
    kind: values.kind,
    title: values.title,
    notes: values.notes,
    startsAt: bangkokLocalToUtcIso(values.ymd, startMin),
    endsAt: bangkokLocalToUtcIso(values.ymd, endMin),
    status: values.status,
    location: values.location,
    hostEmail: values.hostEmail,
    customerId: values.customerId.trim() ? Number(values.customerId) : null,
    orderId: values.orderId.trim() || null,
    attendees: toAttendees(values, staffOptions),
  };
}

export function eventToFormValues(event: ScheduleEvent): EventFormValues {
  const ymd = bangkokYmdDash(new Date(event.startsAt));
  const startParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(event.startsAt));
  const endParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(event.endsAt));
  const startHm = `${startParts.find((p) => p.type === "hour")?.value}:${startParts.find((p) => p.type === "minute")?.value}`;
  const endHm = `${endParts.find((p) => p.type === "hour")?.value}:${endParts.find((p) => p.type === "minute")?.value}`;
  return {
    kind: event.kind,
    title: event.title,
    notes: event.notes || "",
    ymd,
    startHm,
    endHm,
    status: event.status,
    location: event.location || "",
    hostEmail: event.hostEmail,
    customerId: event.customerId ? String(event.customerId) : "",
    orderId: event.orderId || "",
    staffEmails: event.attendees
      .filter((a) => a.role === "staff")
      .map((a) => a.email),
    externalEmails: event.attendees
      .filter((a) => a.role === "external")
      .map((a) => a.email)
      .join(", "),
    notify: true,
  };
}
