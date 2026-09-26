"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  SCHEDULE_KIND_LABELS,
  SCHEDULE_STATUS_LABELS,
  type ScheduleEvent,
  type ScheduleKind,
} from "@/lib/schedule-types";
import { formatBangkokTime, bangkokYmdDash } from "@/lib/bangkok-date";

function eventYmd(iso: string): string {
  return bangkokYmdDash(new Date(iso));
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function MonthCalendar({
  year,
  monthIndex,
  selectedYmd,
  events,
  filterParams,
}: {
  year: number;
  monthIndex: number;
  selectedYmd: string;
  events: ScheduleEvent[];
  /** Query keys without `day` — built on the client so this stays serializable. */
  filterParams: Record<string, string>;
}) {
  const firstDow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const total = daysInMonth(year, monthIndex);
  const cells: Array<{ ymd: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDow; i += 1) cells.push({ ymd: null, day: null });
  for (let d = 1; d <= total; d += 1) {
    const ymd = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ ymd, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ ymd: null, day: null });

  const counts = new Map<string, number>();
  for (const ev of events) {
    if (ev.status === "cancelled") continue;
    const ymd = eventYmd(ev.startsAt);
    counts.set(ymd, (counts.get(ymd) || 0) + 1);
  }

  const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  return (
    <div className="rounded-2xl border border-forest/15 bg-paper/90 p-4 shadow-sm">
      <div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-forest/60">
        {weekdays.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell.ymd || cell.day == null) {
            return <div key={`e-${idx}`} className="aspect-square" />;
          }
          const count = counts.get(cell.ymd) || 0;
          const selected = cell.ymd === selectedYmd;
          const params = new URLSearchParams(filterParams);
          params.set("day", cell.ymd);
          params.set("month", cell.ymd.slice(0, 7));
          const href = `/ops/schedule?${params.toString()}`;
          return (
            <Link
              key={cell.ymd}
              href={href}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition",
                selected
                  ? "bg-forest text-paper"
                  : "text-ink hover:bg-forest-mist",
              )}
            >
              <span className="font-medium">{cell.day}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    "mt-0.5 h-1.5 w-1.5 rounded-full",
                    selected ? "bg-brass-soft" : "bg-brass",
                  )}
                  title={`${count} นัด`}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function DayAgenda({
  ymd,
  events,
  kindFilter,
}: {
  ymd: string;
  events: ScheduleEvent[];
  kindFilter?: ScheduleKind | "all";
}) {
  const dayEvents = events
    .filter((ev) => eventYmd(ev.startsAt) === ymd)
    .filter((ev) =>
      kindFilter && kindFilter !== "all" ? ev.kind === kindFilter : true,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <div className="rounded-2xl border border-forest/15 bg-paper/90 p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-forest">วาระวันนี้</h2>
        <span className="text-xs text-forest/55">{ymd}</span>
      </div>
      {dayEvents.length === 0 ? (
        <p className="text-sm text-ink/60">ยังไม่มีนัดในวันนี้</p>
      ) : (
        <ul className="space-y-2">
          {dayEvents.map((ev) => (
            <li key={ev.id}>
              <Link
                href={`/ops/schedule/${ev.id}`}
                className="block rounded-xl border border-forest/10 px-3 py-2 transition hover:border-brass/40 hover:bg-forest-mist/60"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-forest/65">
                  <span>
                    {formatBangkokTime(ev.startsAt)}–{formatBangkokTime(ev.endsAt)}
                  </span>
                  <span>·</span>
                  <span>{SCHEDULE_KIND_LABELS[ev.kind]}</span>
                  <span>·</span>
                  <span>{SCHEDULE_STATUS_LABELS[ev.status]}</span>
                </div>
                <div className="mt-0.5 font-medium text-ink">{ev.title}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
