"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatMinuteLabel, addDaysYmd, bangkokYmdDash } from "@/lib/bangkok-date";
import type { ScheduleSlot } from "@/lib/schedule-types";

export function DeadlineSlotPicker({
  slots,
  selectedStartsAt,
  onSelect,
  dayCount = 7,
}: {
  slots: ScheduleSlot[];
  selectedStartsAt?: string;
  onSelect: (slot: ScheduleSlot) => void;
  dayCount?: number;
}) {
  const today = bangkokYmdDash();
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDaysYmd(today, i)),
    [today, dayCount],
  );
  const [ymd, setYmd] = useState(days[0] || today);
  const daySlots = slots.filter((s) => s.ymd === ymd);

  const presets = [
    { label: "วันนี้", ymd: today },
    { label: "พรุ่งนี้", ymd: addDaysYmd(today, 1) },
    { label: "วันทำการถัดไป", ymd: days.find((d) => d > today) || today },
  ];

  return (
    <div className="rounded-2xl border border-forest/15 bg-forest-mist/30 p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setYmd(p.ymd)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              ymd === p.ymd
                ? "border-brass bg-brass/15 text-forest"
                : "border-forest/15 text-forest/70",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <label className="mb-1 block text-sm text-forest/70">ปฏิทิน</label>
          <input
            type="date"
            className="w-full rounded-xl border border-forest/20 bg-paper px-3 py-2"
            value={ymd}
            min={today}
            onChange={(e) => setYmd(e.target.value)}
          />
          <p className="mt-2 text-xs text-ink/55">
            เลือกวันแล้วเลือกช่องเวลาทางขวา (จากชั่วโมงว่างของ host)
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-forest/10 bg-paper p-2">
          {daySlots.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-ink/50">
              ไม่มีช่องว่างวันนี้
            </p>
          ) : (
            <ul className="space-y-1">
              {daySlots.map((slot) => {
                const active = selectedStartsAt === slot.startsAt;
                return (
                  <li key={slot.startsAt}>
                    <button
                      type="button"
                      onClick={() => onSelect(slot)}
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left text-sm transition",
                        active
                          ? "bg-forest text-paper"
                          : "hover:bg-forest-mist text-ink",
                      )}
                    >
                      {formatMinuteLabel(slot.startMinute)}–
                      {formatMinuteLabel(slot.endMinute)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
