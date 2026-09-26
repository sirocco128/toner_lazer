"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  addDaysYmd,
  bangkokMinutesOfDay,
  bangkokYmdDash,
  formatMinuteLabel,
} from "@/lib/bangkok-date";
import type { ScheduleEvent } from "@/lib/schedule-types";
import { SCHEDULE_KIND_LABELS } from "@/lib/schedule-types";

const HOUR_START = 8;
const HOUR_END = 20;
const PX_PER_MINUTE = 1.1;

export function WeekTimeline({
  weekStartYmd,
  events,
  viewLinks,
}: {
  weekStartYmd: string;
  events: ScheduleEvent[];
  viewLinks: { monthHref: string; weekHref: string };
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStartYmd, i));
  const hours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + i,
  );
  const totalMinutes = (HOUR_END - HOUR_START) * 60;
  const height = totalMinutes * PX_PER_MINUTE;

  return (
    <div className="rounded-2xl border border-forest/15 bg-paper/90 p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-forest">มุมมองสัปดาห์</h2>
        <div className="flex gap-2 text-xs">
          <Link
            href={viewLinks.monthHref}
            className="rounded-full border border-forest/20 px-3 py-1 text-forest hover:bg-forest-mist"
          >
            เดือน
          </Link>
          <Link
            href={viewLinks.weekHref}
            className="rounded-full border border-forest bg-forest px-3 py-1 text-paper"
          >
            สัปดาห์
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="mb-2 grid grid-cols-[56px_repeat(7,minmax(0,1fr))] gap-1 text-center text-xs font-semibold text-forest/65">
            <div />
            {days.map((ymd) => (
              <div key={ymd}>
                <div>{ymd.slice(5)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] gap-1">
            <div className="relative" style={{ height }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-1 text-[10px] text-forest/45"
                  style={{ top: (h - HOUR_START) * 60 * PX_PER_MINUTE }}
                >
                  {formatMinuteLabel(h * 60)}
                </div>
              ))}
            </div>
            {days.map((ymd) => {
              const dayEvents = events.filter(
                (ev) =>
                  ev.status !== "cancelled" &&
                  bangkokYmdDash(new Date(ev.startsAt)) === ymd,
              );
              return (
                <div
                  key={ymd}
                  className="relative rounded-xl border border-forest/10 bg-forest-mist/20"
                  style={{ height }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-forest/5"
                      style={{ top: (h - HOUR_START) * 60 * PX_PER_MINUTE }}
                    />
                  ))}
                  {dayEvents.map((ev) => {
                    const startMin = bangkokMinutesOfDay(new Date(ev.startsAt));
                    const endMin = bangkokMinutesOfDay(new Date(ev.endsAt));
                    const top = Math.max(
                      0,
                      (startMin - HOUR_START * 60) * PX_PER_MINUTE,
                    );
                    const hPx = Math.max(
                      22,
                      (endMin - startMin) * PX_PER_MINUTE,
                    );
                    return (
                      <Link
                        key={ev.id}
                        href={`/ops/schedule/${ev.id}`}
                        className={cn(
                          "absolute left-1 right-1 overflow-hidden rounded-lg border border-brass/40 bg-forest px-1.5 py-1 text-[10px] text-paper shadow-sm",
                        )}
                        style={{ top, height: hPx }}
                        title={`${ev.title} · ${SCHEDULE_KIND_LABELS[ev.kind]}`}
                      >
                        <div className="truncate font-semibold">{ev.title}</div>
                        <div className="truncate opacity-80">
                          {formatMinuteLabel(startMin)}–
                          {formatMinuteLabel(endMin)}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
