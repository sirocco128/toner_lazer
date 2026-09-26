"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS_TH,
  type ScheduleAvailabilityInterval,
} from "@/lib/schedule-types";
import { formatMinuteLabel, parseHmToMinute } from "@/lib/bangkok-date";

type DraftDay = {
  weekday: number;
  enabled: boolean;
  intervals: Array<{ startHm: string; endHm: string }>;
};

function toDraft(rows: ScheduleAvailabilityInterval[]): DraftDay[] {
  const days: DraftDay[] = [];
  for (let w = 0; w < 7; w += 1) {
    const intervals = rows
      .filter((r) => r.weekday === w)
      .map((r) => ({
        startHm: formatMinuteLabel(r.startMinute),
        endHm: formatMinuteLabel(r.endMinute),
      }));
    days.push({
      weekday: w,
      enabled: rows.some((r) => r.weekday === w && r.enabled),
      intervals: intervals.length
        ? intervals
        : [{ startHm: "09:00", endHm: "17:00" }],
    });
  }
  return days;
}

export function AvailabilityEditor({
  initial,
  staffEmail,
  action,
}: {
  initial: ScheduleAvailabilityInterval[];
  staffEmail: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [days, setDays] = useState(() => toDraft(initial));

  const payload: ScheduleAvailabilityInterval[] = days.flatMap((day) =>
    day.intervals.map((interval) => ({
      weekday: day.weekday,
      enabled: day.enabled,
      startMinute: parseHmToMinute(interval.startHm) ?? 9 * 60,
      endMinute: parseHmToMinute(interval.endHm) ?? 17 * 60,
    })),
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="staffEmail" value={staffEmail} />
      <input type="hidden" name="intervalsJson" value={JSON.stringify(payload)} />

      <div className="space-y-3">
        {days.map((day) => (
          <div
            key={day.weekday}
            className={cn(
              "rounded-2xl border p-4",
              day.enabled
                ? "border-forest/20 bg-paper"
                : "border-forest/10 bg-forest-mist/20 opacity-80",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-forest">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d) =>
                        d.weekday === day.weekday
                          ? { ...d, enabled: e.target.checked }
                          : d,
                      ),
                    )
                  }
                />
                {WEEKDAY_LABELS_TH[day.weekday]}
              </label>
              <button
                type="button"
                className="text-xs text-brass hover:underline"
                onClick={() =>
                  setDays((prev) =>
                    prev.map((d) =>
                      d.weekday === day.weekday
                        ? {
                            ...d,
                            intervals: [
                              ...d.intervals,
                              { startHm: "13:00", endHm: "16:00" },
                            ],
                          }
                        : d,
                    ),
                  )
                }
              >
                + เพิ่มช่วง
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {day.intervals.map((interval, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    className="rounded-lg border border-forest/20 px-2 py-1.5 text-sm"
                    value={interval.startHm}
                    disabled={!day.enabled}
                    onChange={(e) =>
                      setDays((prev) =>
                        prev.map((d) => {
                          if (d.weekday !== day.weekday) return d;
                          const intervals = d.intervals.slice();
                          intervals[idx] = {
                            startHm: e.target.value,
                            endHm: intervals[idx]?.endHm || "17:00",
                          };
                          return { ...d, intervals };
                        }),
                      )
                    }
                  />
                  <span className="text-forest/40">ถึง</span>
                  <input
                    type="time"
                    className="rounded-lg border border-forest/20 px-2 py-1.5 text-sm"
                    value={interval.endHm}
                    disabled={!day.enabled}
                    onChange={(e) =>
                      setDays((prev) =>
                        prev.map((d) => {
                          if (d.weekday !== day.weekday) return d;
                          const intervals = d.intervals.slice();
                          intervals[idx] = {
                            startHm: intervals[idx]?.startHm || "09:00",
                            endHm: e.target.value,
                          };
                          return { ...d, intervals };
                        }),
                      )
                    }
                  />
                  {day.intervals.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs text-ink/50 hover:text-red-700"
                      onClick={() =>
                        setDays((prev) =>
                          prev.map((d) =>
                            d.weekday === day.weekday
                              ? {
                                  ...d,
                                  intervals: d.intervals.filter(
                                    (_, i) => i !== idx,
                                  ),
                                }
                              : d,
                          ),
                        )
                      }
                    >
                      ลบ
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-paper hover:bg-forest-light"
      >
        บันทึกชั่วโมงว่าง
      </button>
    </form>
  );
}
