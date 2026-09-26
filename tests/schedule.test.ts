import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  bangkokLocalToUtcIso,
  formatMinuteLabel,
  parseHmToMinute,
} from "../lib/bangkok-date";
import { composeScheduleNotifyMail } from "../lib/schedule-mail";
import { closeDb, getDb } from "../lib/database";
import {
  createScheduleEvent,
  findOverlappingEvents,
  replaceAvailability,
  resetScheduleTablesReadyCache,
} from "../lib/schedule-repository";
import { generateBookableSlots } from "../lib/schedule-service";
import { isGmailSmtpConfigured } from "../lib/gmail-smtp";

function resolveProjectRoot(): string {
  if (process.env.PROJECT_ROOT && existsSync(join(process.env.PROJECT_ROOT, "package.json"))) {
    return process.env.PROJECT_ROOT;
  }
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = join(dir, "..");
  }
  return join(__dirname, "..");
}

const ROOT = resolveProjectRoot();

describe("bangkok schedule helpers", () => {
  it("parses and formats minute-of-day labels", () => {
    assert.equal(parseHmToMinute("09:30"), 9 * 60 + 30);
    assert.equal(formatMinuteLabel(9 * 60 + 30), "09:30");
    assert.equal(parseHmToMinute("25:00"), null);
  });

  it("converts Bangkok local wall time to UTC ISO (+7)", () => {
    const iso = bangkokLocalToUtcIso("2026-09-07", 10 * 60);
    assert.equal(iso, "2026-09-07T03:00:00.000Z");
  });
});

describe("schedule repository + slots", () => {
  let dataDir = "";
  let prevSqlite = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-schedule-"));
    const sqlitePath = join(dataDir, "leads.sqlite");
    prevSqlite = process.env.SQLITE_PATH || "";
    process.env.SQLITE_PATH = sqlitePath;
    closeDb();
    resetScheduleTablesReadyCache();
    const migrated = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: sqlitePath },
      encoding: "utf8",
    });
    assert.equal(migrated.status, 0, migrated.stderr || migrated.stdout);
    closeDb();
    resetScheduleTablesReadyCache();
    getDb();
  });

  after(() => {
    closeDb();
    resetScheduleTablesReadyCache();
    if (prevSqlite) process.env.SQLITE_PATH = prevSqlite;
    else delete process.env.SQLITE_PATH;
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it("creates events and detects soft conflicts", () => {
    const startsAt = bangkokLocalToUtcIso("2030-01-06", 10 * 60);
    const endsAt = bangkokLocalToUtcIso("2030-01-06", 10 * 60 + 30);
    const first = createScheduleEvent({
      kind: "sales_meeting",
      title: "นัดตัวอย่าง",
      startsAt,
      endsAt,
      hostEmail: "sales@example.com",
      createdByEmail: "sales@example.com",
      createdByName: "Sales",
      attendees: [
        {
          role: "staff",
          email: "sales@example.com",
          name: "Sales",
          notify: true,
        },
        {
          role: "external",
          email: "customer@example.com",
          name: "ลูกค้า",
          notify: true,
        },
      ],
    });
    assert.match(first.id, /^SCH-/);
    assert.equal(first.attendees.length, 2);

    const overlaps = findOverlappingEvents({
      hostEmail: "sales@example.com",
      startsAt: bangkokLocalToUtcIso("2030-01-06", 10 * 60 + 15),
      endsAt: bangkokLocalToUtcIso("2030-01-06", 11 * 60),
    });
    assert.equal(overlaps.length, 1);
    assert.equal(overlaps[0]?.id, first.id);
  });

  it("generates bookable slots from availability minus busy", () => {
    replaceAvailability("slot.host@example.com", [
      {
        weekday: 1,
        enabled: true,
        startMinute: 9 * 60,
        endMinute: 11 * 60,
      },
    ]);
    // 2030-01-07 is a Monday
    createScheduleEvent({
      kind: "internal",
      title: "busy",
      startsAt: bangkokLocalToUtcIso("2030-01-07", 9 * 60),
      endsAt: bangkokLocalToUtcIso("2030-01-07", 9 * 60 + 30),
      hostEmail: "slot.host@example.com",
      createdByEmail: "slot.host@example.com",
      attendees: [
        { role: "staff", email: "slot.host@example.com", notify: false },
      ],
    });
    const slots = generateBookableSlots({
      hostEmail: "slot.host@example.com",
      fromYmd: "2030-01-07",
      days: 1,
      slotMinutes: 30,
    });
    assert.ok(slots.length >= 3);
    assert.equal(
      slots.some((s) => s.startMinute === 9 * 60),
      false,
    );
    assert.equal(
      slots.some((s) => s.startMinute === 9 * 60 + 30),
      true,
    );
  });
});

describe("schedule mail", () => {
  it("composes Thai notify mail", () => {
    const mail = composeScheduleNotifyMail(
      {
        id: "SCH-TEST",
        kind: "delivery",
        title: "ส่งมอบชุดของขวัญ",
        notes: "ชั้น 3",
        startsAt: "2030-01-06T03:00:00.000Z",
        endsAt: "2030-01-06T04:00:00.000Z",
        timezone: "Asia/Bangkok",
        status: "scheduled",
        customerId: null,
        orderId: null,
        location: "สำนักงาน",
        hostEmail: "sales@example.com",
        createdByEmail: "sales@example.com",
        createdByName: "Sales",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attendees: [],
      },
      "created",
      "คุณเอ",
    );
    assert.match(mail.subject, /นัดหมายใหม่/);
    assert.match(mail.text, /ส่งมอบชุดของขวัญ/);
    assert.match(mail.html, /SCH-TEST/);
  });

  it("reports gmail not configured without secrets", () => {
    const prevUser = process.env.GMAIL_USER;
    const prevPass = process.env.GMAIL_APP_PASSWORD;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    assert.equal(isGmailSmtpConfigured(), false);
    if (prevUser) process.env.GMAIL_USER = prevUser;
    if (prevPass) process.env.GMAIL_APP_PASSWORD = prevPass;
  });
});

describe("schedule form mapping", () => {
  it("maps an event into Bangkok form values from a server-safe module", async () => {
    const { eventToFormValues } = await import("../lib/schedule-form");
    const values = eventToFormValues({
      id: "SCH-TEST",
      kind: "sales_meeting",
      title: "คุยเซลล์",
      notes: null,
      startsAt: "2026-09-06T03:00:00.000Z",
      endsAt: "2026-09-06T03:30:00.000Z",
      timezone: "Asia/Bangkok",
      status: "scheduled",
      customerId: null,
      orderId: null,
      location: null,
      hostEmail: "sales@example.com",
      createdByEmail: "sales@example.com",
      createdByName: "เซลล์",
      createdAt: "2026-09-06T03:00:00.000Z",
      updatedAt: "2026-09-06T03:00:00.000Z",
      attendees: [],
    });
    assert.equal(values.ymd, "2026-09-06");
    assert.equal(values.startHm, "10:00");
    assert.equal(values.endHm, "10:30");
    assert.equal(values.hostEmail, "sales@example.com");
  });
});
