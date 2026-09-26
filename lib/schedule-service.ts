import {
  addDaysYmd,
  bangkokLocalToUtcIso,
  bangkokWeekday,
  bangkokYmdDash,
} from "@/lib/bangkok-date";
import {
  createScheduleEvent,
  ensureDefaultAvailability,
  findOverlappingEvents,
  getScheduleEventById,
  listAvailability,
  listScheduleEvents,
  updateScheduleEvent,
  type ListScheduleEventsFilter,
} from "@/lib/schedule-repository";
import { notifyScheduleAttendees, type ScheduleMailAction } from "@/lib/schedule-mail";
import {
  defaultKindTitle,
  isScheduleKind,
  isScheduleStatus,
  type CreateScheduleEventInput,
  type ScheduleAttendeeInput,
  type ScheduleEvent,
  type ScheduleKind,
  type ScheduleSlot,
  type ScheduleStatus,
  type UpdateScheduleEventInput,
} from "@/lib/schedule-types";
import { isValidEmail } from "@/lib/contact-validate";

export type ScheduleServiceResult =
  | { ok: true; event: ScheduleEvent; conflicts: ScheduleEvent[]; mail: { sent: number; skipped: number; failed: number } }
  | { ok: false; error: string };

function mailActionForStatus(
  status: ScheduleStatus,
  isNew: boolean,
): ScheduleMailAction {
  if (status === "cancelled") return "cancelled";
  if (status === "confirmed") return "confirmed";
  return isNew ? "created" : "updated";
}

export async function createScheduleEventWithNotify(
  input: CreateScheduleEventInput,
): Promise<ScheduleServiceResult> {
  try {
    const conflicts = findOverlappingEvents({
      hostEmail: input.hostEmail,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    const event = createScheduleEvent(input);
    const mail = await notifyScheduleAttendees(
      event,
      mailActionForStatus(event.status, true),
    );
    return { ok: true, event, conflicts, mail };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "create_failed",
    };
  }
}

export async function updateScheduleEventWithNotify(
  input: UpdateScheduleEventInput,
): Promise<ScheduleServiceResult> {
  try {
    const current = getScheduleEventById(input.id);
    if (!current) return { ok: false, error: "not_found" };
    const startsAt = input.startsAt ?? current.startsAt;
    const endsAt = input.endsAt ?? current.endsAt;
    const hostEmail = input.hostEmail ?? current.hostEmail;
    const conflicts = findOverlappingEvents({
      hostEmail,
      startsAt,
      endsAt,
      excludeEventId: current.id,
    });
    const event = updateScheduleEvent(input);
    if (!event) return { ok: false, error: "update_failed" };
    const mail = await notifyScheduleAttendees(
      event,
      mailActionForStatus(event.status, false),
    );
    return { ok: true, event, conflicts, mail };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "update_failed",
    };
  }
}

export async function resendScheduleNotify(
  eventId: string,
): Promise<ScheduleServiceResult> {
  const event = getScheduleEventById(eventId);
  if (!event) return { ok: false, error: "not_found" };
  const mail = await notifyScheduleAttendees(
    event,
    mailActionForStatus(event.status, false),
  );
  return { ok: true, event, conflicts: [], mail };
}

export function listScheduleEventsForRange(
  filter: ListScheduleEventsFilter,
): ScheduleEvent[] {
  return listScheduleEvents(filter);
}

export function generateBookableSlots(options: {
  hostEmail: string;
  fromYmd: string;
  days: number;
  slotMinutes?: number;
}): ScheduleSlot[] {
  const slotMinutes = options.slotMinutes ?? 30;
  const availability = ensureDefaultAvailability(options.hostEmail);
  const fromIso = bangkokLocalToUtcIso(options.fromYmd, 0);
  const toYmd = addDaysYmd(options.fromYmd, Math.max(1, options.days) - 1);
  const toIso = bangkokLocalToUtcIso(toYmd, 24 * 60 - 1);
  const busy = listScheduleEvents({
    hostEmail: options.hostEmail,
    fromIso,
    toIso,
    includeCancelled: false,
  });
  const slots: ScheduleSlot[] = [];
  for (let d = 0; d < options.days; d += 1) {
    const ymd = addDaysYmd(options.fromYmd, d);
    const weekday = bangkokWeekday(new Date(bangkokLocalToUtcIso(ymd, 12 * 60)));
    const dayIntervals = availability.filter(
      (row) => row.weekday === weekday && row.enabled,
    );
    for (const interval of dayIntervals) {
      for (
        let start = interval.startMinute;
        start + slotMinutes <= interval.endMinute;
        start += slotMinutes
      ) {
        const end = start + slotMinutes;
        const startsAt = bangkokLocalToUtcIso(ymd, start);
        const endsAt = bangkokLocalToUtcIso(ymd, end);
        const clash = busy.some(
          (ev) => ev.startsAt < endsAt && ev.endsAt > startsAt,
        );
        if (clash) continue;
        if (new Date(startsAt).getTime() < Date.now()) continue;
        slots.push({ ymd, startMinute: start, endMinute: end, startsAt, endsAt });
      }
    }
  }
  return slots;
}

export type PublicBookInput = {
  hostEmail: string;
  hostName: string;
  hostStaffId?: number | null;
  startsAt: string;
  endsAt: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  title?: string;
};

export async function bookPublicSlot(
  input: PublicBookInput,
): Promise<ScheduleServiceResult> {
  const guestEmail = input.guestEmail.trim().toLowerCase();
  const guestName = input.guestName.trim();
  if (!guestName) return { ok: false, error: "name_required" };
  if (!isValidEmail(guestEmail)) return { ok: false, error: "email_invalid" };
  if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
    return { ok: false, error: "invalid_time_range" };
  }
  if (new Date(input.startsAt).getTime() < Date.now() - 60_000) {
    return { ok: false, error: "slot_in_past" };
  }
  const conflicts = findOverlappingEvents({
    hostEmail: input.hostEmail,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
  if (conflicts.length > 0) return { ok: false, error: "slot_taken" };

  const ymd = bangkokYmdDash(new Date(input.startsAt));
  const slots = generateBookableSlots({
    hostEmail: input.hostEmail,
    fromYmd: ymd,
    days: 1,
  });
  const allowed = slots.some(
    (s) => s.startsAt === input.startsAt && s.endsAt === input.endsAt,
  );
  if (!allowed) return { ok: false, error: "slot_unavailable" };

  const noteParts = [
    input.notes?.trim() || "",
    input.guestPhone?.trim() ? `โทร: ${input.guestPhone.trim()}` : "",
  ].filter(Boolean);

  const attendees: ScheduleAttendeeInput[] = [
    {
      role: "staff",
      email: input.hostEmail,
      name: input.hostName,
      staffId: input.hostStaffId ?? null,
      notify: true,
    },
    {
      role: "external",
      email: guestEmail,
      name: guestName,
      notify: true,
    },
  ];

  try {
    const event = createScheduleEvent({
      kind: "sales_meeting",
      title: (input.title || "").trim() || `นัดคุยกับ ${guestName}`,
      notes: noteParts.join("\n") || undefined,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "confirmed",
      hostEmail: input.hostEmail,
      createdByEmail: guestEmail,
      createdByName: guestName,
      attendees,
    });
    const mail = await notifyScheduleAttendees(event, "booked");
    return { ok: true, event, conflicts: [], mail };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "book_failed",
    };
  }
}

export function parseScheduleKind(raw: string): ScheduleKind | null {
  return isScheduleKind(raw) ? raw : null;
}

export function parseScheduleStatus(raw: string): ScheduleStatus | null {
  return isScheduleStatus(raw) ? raw : null;
}

export function titleOrDefault(kind: ScheduleKind, title: string): string {
  const trimmed = title.trim();
  return trimmed || defaultKindTitle(kind);
}

export function getAvailabilityOrDefault(staffEmail: string) {
  const rows = listAvailability(staffEmail);
  if (rows.length) return rows;
  return ensureDefaultAvailability(staffEmail);
}
