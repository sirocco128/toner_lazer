/** Shared Bangkok calendar / clock helpers for scheduling. */

export const BANGKOK_TZ = "Asia/Bangkok";

/** Earliest usable quote date = Bangkok calendar today plus this many days. */
export const NEEDED_DATE_MIN_LEAD_DAYS = 10;

export function bangkokDateYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("-", "");
}

/** YYYY-MM-DD in Asia/Bangkok. */
export function bangkokYmdDash(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export const bangkokTodayYmd = bangkokYmdDash;

export function bangkokWeekday(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TZ,
    weekday: "short",
  }).formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value;
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd || ""] ?? 0;
}

export function bangkokMinutesOfDay(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

/** Build an Instant for YYYY-MM-DD + minutes-from-midnight in Bangkok. */
export function bangkokLocalToUtcIso(ymd: string, minuteOfDay: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) throw new Error("invalid_ymd");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  // Asia/Bangkok is always UTC+7 (no DST)
  const utcMs = Date.UTC(year, month - 1, day, hours - 7, minutes, 0, 0);
  return new Date(utcMs).toISOString();
}

export function formatBangkokDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: BANGKOK_TZ,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatBangkokTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeStyle: "short",
      timeZone: BANGKOK_TZ,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatMinuteLabel(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseHmToMinute(hm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function addDaysYmd(ymd: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) throw new Error("invalid_ymd");
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  return bangkokYmdDash(new Date(utc + 7 * 60 * 60 * 1000));
}

export function bangkokYmdPlusDays(days: number, now = new Date()): string {
  return addDaysYmd(bangkokYmdDash(now), days);
}

export function minNeededDateYmd(now = new Date()): string {
  return addDaysYmd(bangkokYmdDash(now), NEEDED_DATE_MIN_LEAD_DAYS);
}

export function startOfBangkokWeekYmd(ymd: string): string {
  const iso = bangkokLocalToUtcIso(ymd, 12 * 60);
  const wd = bangkokWeekday(new Date(iso));
  return addDaysYmd(ymd, -wd);
}
