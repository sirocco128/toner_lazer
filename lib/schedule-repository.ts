import { randomBytes } from "node:crypto";
import { bangkokDateYmd, bangkokLocalToUtcIso, formatMinuteLabel } from "@/lib/bangkok-date";
import { getDb } from "@/lib/database";
import type {
  CreateScheduleEventInput,
  ScheduleAttendee,
  ScheduleAttendeeInput,
  ScheduleAttendeeRole,
  ScheduleAvailabilityInterval,
  ScheduleAvailabilityRow,
  ScheduleEvent,
  ScheduleKind,
  ScheduleStatus,
  UpdateScheduleEventInput,
} from "@/lib/schedule-types";
import { isScheduleKind, isScheduleStatus } from "@/lib/schedule-types";

type EventRow = {
  id: string;
  kind: string;
  title: string;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  customer_id: number | null;
  order_id: string | null;
  location: string | null;
  host_email: string;
  created_by_email: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type AttendeeRow = {
  id: number;
  event_id: string;
  role: string;
  staff_id: number | null;
  email: string;
  name: string | null;
  notify: number;
  last_notify_status: string | null;
  last_notify_error: string | null;
  last_notify_at: string | null;
  created_at: string;
};

type AvailabilityRow = {
  id: number;
  staff_email: string;
  weekday: number;
  enabled: number;
  start_minute: number;
  end_minute: number;
  created_at: string;
  updated_at: string;
};

let tablesReadyCache: boolean | null = null;

function tablesReady(): boolean {
  if (tablesReadyCache === true) return true;
  try {
    getDb().prepare("SELECT 1 FROM schedule_events LIMIT 1").get();
    tablesReadyCache = true;
    return true;
  } catch {
    tablesReadyCache = false;
    return false;
  }
}

export function resetScheduleTablesReadyCache(): void {
  tablesReadyCache = null;
}

export function createScheduleEventId(now = new Date()): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `SCH-${bangkokDateYmd(now)}-${suffix}`;
}

function mapAttendee(row: AttendeeRow): ScheduleAttendee {
  return {
    id: row.id,
    eventId: row.event_id,
    role: (row.role === "external" ? "external" : "staff") as ScheduleAttendeeRole,
    staffId: row.staff_id,
    email: row.email,
    name: row.name,
    notify: row.notify === 1,
    lastNotifyStatus: row.last_notify_status,
    lastNotifyError: row.last_notify_error,
    lastNotifyAt: row.last_notify_at,
    createdAt: row.created_at,
  };
}

function mapEvent(row: EventRow, attendees: ScheduleAttendee[]): ScheduleEvent {
  const kind = isScheduleKind(row.kind) ? row.kind : "other";
  const status = isScheduleStatus(row.status) ? row.status : "scheduled";
  return {
    id: row.id,
    kind,
    title: row.title,
    notes: row.notes,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone || "Asia/Bangkok",
    status,
    customerId: row.customer_id,
    orderId: row.order_id,
    location: row.location,
    hostEmail: row.host_email,
    createdByEmail: row.created_by_email,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attendees,
  };
}

function listAttendeesForEvent(eventId: string): ScheduleAttendee[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM schedule_attendees WHERE event_id = ? ORDER BY id ASC`,
    )
    .all(eventId) as AttendeeRow[];
  return rows.map(mapAttendee);
}

function hydrate(row: EventRow): ScheduleEvent {
  return mapEvent(row, listAttendeesForEvent(row.id));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function insertAttendees(
  eventId: string,
  attendees: ScheduleAttendeeInput[],
  now: string,
): void {
  const stmt = getDb().prepare(
    `INSERT INTO schedule_attendees (
      event_id, role, staff_id, email, name, notify, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const seen = new Set<string>();
  for (const item of attendees) {
    const email = normalizeEmail(item.email);
    if (!email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    stmt.run(
      eventId,
      item.role === "external" ? "external" : "staff",
      item.staffId ?? null,
      email,
      (item.name || "").trim() || null,
      item.notify === false ? 0 : 1,
      now,
    );
  }
}

export function createScheduleEvent(
  input: CreateScheduleEventInput,
): ScheduleEvent {
  if (!tablesReady()) throw new Error("schedule_tables_missing");
  const id = createScheduleEventId();
  const now = new Date().toISOString();
  const title = input.title.trim();
  if (!title) throw new Error("title_required");
  if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
    throw new Error("invalid_time_range");
  }
  getDb()
    .prepare(
      `INSERT INTO schedule_events (
        id, kind, title, notes, starts_at, ends_at, timezone, status,
        customer_id, order_id, location, host_email,
        created_by_email, created_by_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Asia/Bangkok', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.kind,
      title,
      (input.notes || "").trim() || null,
      input.startsAt,
      input.endsAt,
      input.status || "scheduled",
      input.customerId ?? null,
      (input.orderId || "").trim() || null,
      (input.location || "").trim() || null,
      normalizeEmail(input.hostEmail),
      normalizeEmail(input.createdByEmail),
      (input.createdByName || "").trim() || null,
      now,
      now,
    );
  insertAttendees(id, input.attendees, now);
  const created = getScheduleEventById(id);
  if (!created) throw new Error("create_failed");
  return created;
}

export function getScheduleEventById(id: string): ScheduleEvent | null {
  if (!tablesReady() || !id.trim()) return null;
  const row = getDb()
    .prepare(`SELECT * FROM schedule_events WHERE id = ?`)
    .get(id.trim()) as EventRow | undefined;
  return row ? hydrate(row) : null;
}

export function updateScheduleEvent(
  input: UpdateScheduleEventInput,
): ScheduleEvent | null {
  if (!tablesReady()) return null;
  const current = getScheduleEventById(input.id);
  if (!current) return null;
  const now = new Date().toISOString();
  const kind = input.kind ?? current.kind;
  const title = input.title !== undefined ? input.title.trim() : current.title;
  if (!title) throw new Error("title_required");
  const startsAt = input.startsAt ?? current.startsAt;
  const endsAt = input.endsAt ?? current.endsAt;
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error("invalid_time_range");
  }
  getDb()
    .prepare(
      `UPDATE schedule_events SET
        kind = ?, title = ?, notes = ?, starts_at = ?, ends_at = ?, status = ?,
        customer_id = ?, order_id = ?, location = ?, host_email = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      kind,
      title,
      input.notes !== undefined
        ? (input.notes || "").trim() || null
        : current.notes,
      startsAt,
      endsAt,
      input.status ?? current.status,
      input.customerId !== undefined ? input.customerId : current.customerId,
      input.orderId !== undefined
        ? (input.orderId || "").trim() || null
        : current.orderId,
      input.location !== undefined
        ? (input.location || "").trim() || null
        : current.location,
      input.hostEmail
        ? normalizeEmail(input.hostEmail)
        : current.hostEmail,
      now,
      current.id,
    );
  if (input.attendees) {
    getDb()
      .prepare(`DELETE FROM schedule_attendees WHERE event_id = ?`)
      .run(current.id);
    insertAttendees(current.id, input.attendees, now);
  }
  return getScheduleEventById(current.id);
}

export type ListScheduleEventsFilter = {
  fromIso?: string;
  toIso?: string;
  kind?: ScheduleKind | "all";
  status?: ScheduleStatus | "all";
  hostEmail?: string;
  q?: string;
  includeCancelled?: boolean;
};

export function listScheduleEvents(
  filter: ListScheduleEventsFilter = {},
): ScheduleEvent[] {
  if (!tablesReady()) return [];
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.fromIso) {
    clauses.push("ends_at >= ?");
    params.push(filter.fromIso);
  }
  if (filter.toIso) {
    clauses.push("starts_at <= ?");
    params.push(filter.toIso);
  }
  if (filter.kind && filter.kind !== "all") {
    clauses.push("kind = ?");
    params.push(filter.kind);
  }
  if (filter.status && filter.status !== "all") {
    clauses.push("status = ?");
    params.push(filter.status);
  } else if (!filter.includeCancelled && (!filter.status || filter.status === "all")) {
    clauses.push("status != 'cancelled'");
  }
  if (filter.hostEmail) {
    clauses.push("host_email = ?");
    params.push(normalizeEmail(filter.hostEmail));
  }
  if (filter.q?.trim()) {
    const like = `%${filter.q.trim()}%`;
    clauses.push("(title LIKE ? OR notes LIKE ? OR location LIKE ? OR id LIKE ?)");
    params.push(like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(
      `SELECT * FROM schedule_events ${where} ORDER BY starts_at ASC LIMIT 500`,
    )
    .all(...(params as Array<string | number | null>)) as EventRow[];
  return rows.map(hydrate);
}

export function findOverlappingEvents(options: {
  hostEmail: string;
  startsAt: string;
  endsAt: string;
  excludeEventId?: string;
}): ScheduleEvent[] {
  if (!tablesReady()) return [];
  const rows = getDb()
    .prepare(
      `SELECT * FROM schedule_events
       WHERE host_email = ?
         AND status != 'cancelled'
         AND starts_at < ?
         AND ends_at > ?
         ${options.excludeEventId ? "AND id != ?" : ""}
       ORDER BY starts_at ASC`,
    )
    .all(
      ...(options.excludeEventId
        ? [
            normalizeEmail(options.hostEmail),
            options.endsAt,
            options.startsAt,
            options.excludeEventId,
          ]
        : [
            normalizeEmail(options.hostEmail),
            options.endsAt,
            options.startsAt,
          ]),
    ) as EventRow[];
  return rows.map(hydrate);
}

export function updateAttendeeNotifyResult(
  attendeeId: number,
  result: { ok: boolean; error?: string },
): void {
  if (!tablesReady()) return;
  getDb()
    .prepare(
      `UPDATE schedule_attendees SET
        last_notify_status = ?, last_notify_error = ?, last_notify_at = ?
       WHERE id = ?`,
    )
    .run(
      result.ok ? "sent" : "failed",
      result.ok ? null : (result.error || "failed").slice(0, 400),
      new Date().toISOString(),
      attendeeId,
    );
}

function mapAvailability(row: AvailabilityRow): ScheduleAvailabilityRow {
  return {
    id: row.id,
    staffEmail: row.staff_email,
    weekday: row.weekday,
    enabled: row.enabled === 1,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listAvailability(
  staffEmail: string,
): ScheduleAvailabilityRow[] {
  if (!tablesReady()) return [];
  const rows = getDb()
    .prepare(
      `SELECT * FROM schedule_availability
       WHERE staff_email = ?
       ORDER BY weekday ASC, start_minute ASC`,
    )
    .all(normalizeEmail(staffEmail)) as AvailabilityRow[];
  return rows.map(mapAvailability);
}

export function replaceAvailability(
  staffEmail: string,
  intervals: ScheduleAvailabilityInterval[],
): ScheduleAvailabilityRow[] {
  if (!tablesReady()) throw new Error("schedule_tables_missing");
  const email = normalizeEmail(staffEmail);
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(`DELETE FROM schedule_availability WHERE staff_email = ?`).run(email);
  const stmt = db.prepare(
    `INSERT INTO schedule_availability (
      staff_email, weekday, enabled, start_minute, end_minute, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const item of intervals) {
    if (item.weekday < 0 || item.weekday > 6) continue;
    if (item.endMinute <= item.startMinute) continue;
    stmt.run(
      email,
      item.weekday,
      item.enabled ? 1 : 0,
      item.startMinute,
      item.endMinute,
      now,
      now,
    );
  }
  return listAvailability(email);
}

export const DEFAULT_WEEKDAY_AVAILABILITY: ScheduleAvailabilityInterval[] = [
  { weekday: 1, enabled: true, startMinute: 9 * 60, endMinute: 17 * 60 },
  { weekday: 2, enabled: true, startMinute: 9 * 60, endMinute: 17 * 60 },
  { weekday: 3, enabled: true, startMinute: 9 * 60, endMinute: 17 * 60 },
  { weekday: 4, enabled: true, startMinute: 9 * 60, endMinute: 17 * 60 },
  { weekday: 5, enabled: true, startMinute: 9 * 60, endMinute: 17 * 60 },
  { weekday: 0, enabled: false, startMinute: 9 * 60, endMinute: 12 * 60 },
  { weekday: 6, enabled: false, startMinute: 9 * 60, endMinute: 12 * 60 },
];

export function ensureDefaultAvailability(
  staffEmail: string,
): ScheduleAvailabilityRow[] {
  const existing = listAvailability(staffEmail);
  if (existing.length > 0) return existing;
  return replaceAvailability(staffEmail, DEFAULT_WEEKDAY_AVAILABILITY);
}

export function getOpsStaffBookingSlug(staffId: number): string | null {
  try {
    const row = getDb()
      .prepare(`SELECT booking_slug FROM ops_staff WHERE id = ?`)
      .get(staffId) as { booking_slug: string | null } | undefined;
    return row?.booking_slug || null;
  } catch {
    return null;
  }
}

export function getOpsStaffByBookingSlug(slug: string): {
  id: number;
  email: string;
  name: string;
  bookingSlug: string;
} | null {
  const wanted = slug.trim().toLowerCase();
  if (!wanted) return null;
  try {
    const row = getDb()
      .prepare(
        `SELECT id, email, name, booking_slug FROM ops_staff
         WHERE lower(booking_slug) = ? AND active = 1`,
      )
      .get(wanted) as
      | { id: number; email: string; name: string; booking_slug: string }
      | undefined;
    if (!row?.booking_slug) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      bookingSlug: row.booking_slug,
    };
  } catch {
    return null;
  }
}

export function setOpsStaffBookingSlug(
  staffId: number,
  slug: string,
): string {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized.length < 3) throw new Error("slug_too_short");
  getDb()
    .prepare(
      `UPDATE ops_staff SET booking_slug = ?, updated_at = ? WHERE id = ?`,
    )
    .run(normalized, new Date().toISOString(), staffId);
  return normalized;
}

export function ensureOpsStaffBookingSlug(
  staffId: number,
  email: string,
  name: string,
): string {
  const existing = getOpsStaffBookingSlug(staffId);
  if (existing) return existing;
  const base =
    email.split("@")[0]?.replace(/[^a-z0-9]/gi, "").toLowerCase() ||
    name.replace(/[^a-z0-9]/gi, "").toLowerCase() ||
    `staff${staffId}`;
  const candidate = base.slice(0, 24) || `s${staffId}`;
  for (let i = 0; i < 8; i += 1) {
    const trySlug = i === 0 ? candidate : `${candidate}${i + 1}`;
    const clash = getOpsStaffByBookingSlug(trySlug);
    if (!clash || clash.id === staffId) {
      return setOpsStaffBookingSlug(staffId, trySlug);
    }
  }
  return setOpsStaffBookingSlug(
    staffId,
    `${candidate}-${randomBytes(2).toString("hex")}`,
  );
}

/** Pure helper for tests / slot UI labels. */
export function describeInterval(startMinute: number, endMinute: number): string {
  return `${formatMinuteLabel(startMinute)}–${formatMinuteLabel(endMinute)}`;
}

export function buildDayWindowIso(ymd: string): { fromIso: string; toIso: string } {
  return {
    fromIso: bangkokLocalToUtcIso(ymd, 0),
    toIso: bangkokLocalToUtcIso(ymd, 24 * 60 - 1),
  };
}
