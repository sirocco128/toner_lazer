"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { isPlatformAdmin } from "@/lib/ops-roles";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";
import {
  ensureOpsStaffBookingSlug,
  getScheduleEventById,
  replaceAvailability,
} from "@/lib/schedule-repository";
import {
  bookPublicSlot,
  createScheduleEventWithNotify,
  parseScheduleKind,
  parseScheduleStatus,
  resendScheduleNotify,
  titleOrDefault,
  updateScheduleEventWithNotify,
} from "@/lib/schedule-service";
import type {
  ScheduleAttendeeInput,
  ScheduleAvailabilityInterval,
} from "@/lib/schedule-types";
import { getOpsStaffByBookingSlug } from "@/lib/schedule-repository";
import { getOpsStaffByEmail, listOpsStaff } from "@/lib/ops-staff";

function parseAttendeesJson(raw: string): ScheduleAttendeeInput[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ScheduleAttendeeInput[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const email = String(row.email || "")
        .trim()
        .toLowerCase();
      if (!email.includes("@")) continue;
      out.push({
        role: row.role === "external" ? "external" : "staff",
        email,
        name: row.name ? String(row.name) : undefined,
        staffId:
          typeof row.staffId === "number"
            ? row.staffId
            : row.staffId
              ? Number(row.staffId)
              : null,
        notify: row.notify !== false && row.notify !== 0 && row.notify !== "0",
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function createScheduleEventAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireOpsActor("schedule.write");
  if (!actor) return;
  const kind = parseScheduleKind(String(formData.get("kind") || ""));
  if (!kind) return;
  const title = titleOrDefault(kind, String(formData.get("title") || ""));
  const startsAt = String(formData.get("startsAt") || "").trim();
  const endsAt = String(formData.get("endsAt") || "").trim();
  const hostEmail = String(formData.get("hostEmail") || actor.email)
    .trim()
    .toLowerCase();
  const status =
    parseScheduleStatus(String(formData.get("status") || "")) || "scheduled";
  const notify = String(formData.get("notify") || "1") !== "0";
  let attendees = parseAttendeesJson(String(formData.get("attendeesJson") || "[]"));
  if (!notify) {
    attendees = attendees.map((a) => ({ ...a, notify: false }));
  }
  const customerRaw = String(formData.get("customerId") || "").trim();
  const result = await createScheduleEventWithNotify({
    kind,
    title,
    notes: String(formData.get("notes") || ""),
    startsAt,
    endsAt,
    status,
    location: String(formData.get("location") || ""),
    hostEmail,
    createdByEmail: actor.email,
    createdByName: actor.name,
    customerId: customerRaw ? Number(customerRaw) : null,
    orderId: String(formData.get("orderId") || "") || null,
    attendees,
  });
  const meta = await requestMeta();
  writeOpsAudit({
    actor,
    action: "schedule.create",
    status: result.ok ? "ok" : "denied",
    resourceType: "schedule_event",
    resourceId: result.ok ? result.event.id : undefined,
    detail: result.ok
      ? {
          kind,
          mail: result.mail,
          conflicts: result.conflicts.map((c) => c.id),
        }
      : { error: result.error },
    ...meta,
  });
  if (!result.ok) return;
  revalidatePath("/ops/schedule");
  redirect(`/ops/schedule/${result.event.id}`);
}

export async function updateScheduleEventAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireOpsActor("schedule.write");
  if (!actor) return;
  const id = String(formData.get("eventId") || "").trim();
  if (!id) return;
  const kind = parseScheduleKind(String(formData.get("kind") || ""));
  if (!kind) return;
  const title = titleOrDefault(kind, String(formData.get("title") || ""));
  const startsAt = String(formData.get("startsAt") || "").trim();
  const endsAt = String(formData.get("endsAt") || "").trim();
  const hostEmail = String(formData.get("hostEmail") || actor.email)
    .trim()
    .toLowerCase();
  const status =
    parseScheduleStatus(String(formData.get("status") || "")) || "scheduled";
  const notify = String(formData.get("notify") || "1") !== "0";
  let attendees = parseAttendeesJson(String(formData.get("attendeesJson") || "[]"));
  if (!notify) {
    attendees = attendees.map((a) => ({ ...a, notify: false }));
  }
  const customerRaw = String(formData.get("customerId") || "").trim();
  const result = await updateScheduleEventWithNotify({
    id,
    kind,
    title,
    notes: String(formData.get("notes") || ""),
    startsAt,
    endsAt,
    status,
    location: String(formData.get("location") || ""),
    hostEmail,
    customerId: customerRaw ? Number(customerRaw) : null,
    orderId: String(formData.get("orderId") || "") || null,
    attendees,
  });
  const meta = await requestMeta();
  writeOpsAudit({
    actor,
    action: "schedule.update",
    status: result.ok ? "ok" : "denied",
    resourceType: "schedule_event",
    resourceId: id,
    detail: result.ok
      ? { status, mail: result.mail }
      : { error: result.error },
    ...meta,
  });
  if (!result.ok) return;
  revalidatePath("/ops/schedule");
  revalidatePath(`/ops/schedule/${id}`);
  redirect(`/ops/schedule/${id}`);
}

export async function cancelScheduleEventAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireOpsActor("schedule.write");
  if (!actor) return;
  const id = String(formData.get("eventId") || "").trim();
  if (!id) return;
  const current = getScheduleEventById(id);
  if (!current) return;
  const result = await updateScheduleEventWithNotify({
    id,
    status: "cancelled",
  });
  const meta = await requestMeta();
  writeOpsAudit({
    actor,
    action: "schedule.update",
    status: result.ok ? "ok" : "denied",
    resourceType: "schedule_event",
    resourceId: id,
    detail: { status: "cancelled", mail: result.ok ? result.mail : undefined },
    ...meta,
  });
  revalidatePath("/ops/schedule");
  revalidatePath(`/ops/schedule/${id}`);
}

export async function resendScheduleNotifyAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireOpsActor("schedule.write");
  if (!actor) return;
  const id = String(formData.get("eventId") || "").trim();
  if (!id) return;
  const result = await resendScheduleNotify(id);
  const meta = await requestMeta();
  writeOpsAudit({
    actor,
    action: "schedule.notify",
    status: result.ok ? "ok" : "denied",
    resourceType: "schedule_event",
    resourceId: id,
    detail: result.ok ? { mail: result.mail } : { error: result.error },
    ...meta,
  });
  revalidatePath(`/ops/schedule/${id}`);
}

export async function saveScheduleAvailabilityAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireOpsActor("schedule.write");
  if (!actor) return;
  let staffEmail = String(formData.get("staffEmail") || actor.email)
    .trim()
    .toLowerCase();
  if (!isPlatformAdmin(actor.role) && staffEmail !== actor.email.toLowerCase()) {
    staffEmail = actor.email.toLowerCase();
  }
  let intervals: ScheduleAvailabilityInterval[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("intervalsJson") || "[]")) as unknown;
    if (Array.isArray(parsed)) {
      intervals = parsed
        .map((item) => {
          const row = item as Record<string, unknown>;
          return {
            weekday: Number(row.weekday),
            enabled: Boolean(row.enabled),
            startMinute: Number(row.startMinute),
            endMinute: Number(row.endMinute),
          };
        })
        .filter(
          (row) =>
            row.weekday >= 0 &&
            row.weekday <= 6 &&
            row.endMinute > row.startMinute,
        );
    }
  } catch {
    return;
  }
  replaceAvailability(staffEmail, intervals);
  const staff = getOpsStaffByEmail(staffEmail);
  if (staff) {
    ensureOpsStaffBookingSlug(staff.id, staff.email, staff.name);
  }
  const meta = await requestMeta();
  writeOpsAudit({
    actor,
    action: "schedule.availability",
    status: "ok",
    resourceType: "schedule_availability",
    resourceId: staffEmail,
    detail: { intervals: intervals.length },
    ...meta,
  });
  revalidatePath("/ops/schedule/availability");
  revalidatePath("/ops/schedule");
}

export async function ensureMyBookingSlugAction(): Promise<void> {
  const actor = await requireOpsActor("schedule.write");
  if (!actor) return;
  const staff =
    (actor.staffId ? listOpsStaff().find((s) => s.id === actor.staffId) : null) ||
    getOpsStaffByEmail(actor.email);
  if (!staff) return;
  ensureOpsStaffBookingSlug(staff.id, staff.email, staff.name);
  revalidatePath("/ops/schedule/availability");
}

export async function bookPublicScheduleAction(
  slug: string,
  formData: FormData,
): Promise<void> {
  const host = getOpsStaffByBookingSlug(slug);
  if (!host) return;
  const startsAt = String(formData.get("startsAt") || "").trim();
  const endsAt = String(formData.get("endsAt") || "").trim();
  const result = await bookPublicSlot({
    hostEmail: host.email,
    hostName: host.name,
    hostStaffId: host.id,
    startsAt,
    endsAt,
    guestName: String(formData.get("guestName") || ""),
    guestEmail: String(formData.get("guestEmail") || ""),
    guestPhone: String(formData.get("guestPhone") || ""),
    notes: String(formData.get("notes") || ""),
  });
  writeOpsAudit({
    actor: {
      email: String(formData.get("guestEmail") || "public").toLowerCase(),
      name: String(formData.get("guestName") || "public"),
      role: "viewer",
    },
    action: "schedule.book",
    status: result.ok ? "ok" : "denied",
    resourceType: "schedule_event",
    resourceId: result.ok ? result.event.id : slug,
    detail: result.ok
      ? { host: host.email, mail: result.mail }
      : { error: result.error },
  });
  if (!result.ok) {
    redirect(`/book/${slug}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/book/${slug}?booked=${encodeURIComponent(result.event.id)}`);
}
