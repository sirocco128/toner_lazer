"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  addDaysYmd,
  bangkokYmdDash,
  formatMinuteLabel,
} from "@/lib/bangkok-date";
import type { ScheduleSlot } from "@/lib/schedule-types";

export function PublicBookingSurface({
  hostName,
  summary,
  slots,
  action,
}: {
  hostName: string;
  summary: string;
  slots: ScheduleSlot[];
  action: (formData: FormData) => Promise<void>;
}) {
  const today = bangkokYmdDash();
  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDaysYmd(today, i)),
    [today],
  );
  const availableDays = days.filter((ymd) => slots.some((s) => s.ymd === ymd));
  const [ymd, setYmd] = useState(availableDays[0] || today);
  const [selected, setSelected] = useState<ScheduleSlot | null>(null);
  const daySlots = slots.filter((s) => s.ymd === ymd);

  return (
    <form action={action} className="mx-auto max-w-3xl space-y-6">
      <input type="hidden" name="startsAt" value={selected?.startsAt || ""} />
      <input type="hidden" name="endsAt" value={selected?.endsAt || ""} />

      <section className="rounded-3xl border border-forest/15 bg-paper/95 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
          นัดคุยเซลล์
        </p>
        <h1 className="mt-2 font-display text-3xl text-forest">{hostName}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">{summary}</p>
      </section>

      <section className="rounded-3xl border border-forest/15 bg-paper p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-forest">เลือกวัน</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const has = slots.some((s) => s.ymd === day);
            return (
              <button
                key={day}
                type="button"
                disabled={!has}
                onClick={() => {
                  setYmd(day);
                  setSelected(null);
                }}
                className={cn(
                  "min-w-[4.5rem] shrink-0 rounded-2xl border px-3 py-3 text-center text-xs transition",
                  ymd === day
                    ? "border-forest bg-forest text-paper"
                    : has
                      ? "border-forest/20 text-forest hover:bg-forest-mist"
                      : "cursor-not-allowed border-forest/10 text-ink/30",
                )}
              >
                <div className="font-semibold">{day.slice(5)}</div>
                <div className="mt-0.5 opacity-70">
                  {has ? "ว่าง" : "เต็ม"}
                </div>
              </button>
            );
          })}
        </div>

        <h2 className="mt-6 text-sm font-semibold text-forest">เลือกเวลา</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {daySlots.length === 0 ? (
            <p className="col-span-full text-sm text-ink/50">ไม่มีช่องว่างวันนี้</p>
          ) : (
            daySlots.map((slot) => {
              const active = selected?.startsAt === slot.startsAt;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => setSelected(slot)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "border-brass bg-brass/15 text-forest"
                      : "border-forest/15 text-ink hover:border-brass/40",
                  )}
                >
                  {formatMinuteLabel(slot.startMinute)}–
                  {formatMinuteLabel(slot.endMinute)}
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-forest/15 bg-paper p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-forest">ข้อมูลติดต่อ</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block text-forest/70">ชื่อ</span>
            <input
              name="guestName"
              required
              className="w-full rounded-xl border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-forest/70">อีเมล</span>
            <input
              name="guestEmail"
              type="email"
              required
              className="w-full rounded-xl border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-forest/70">โทรศัพท์</span>
            <input
              name="guestPhone"
              className="w-full rounded-xl border border-forest/20 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-forest/70">รายละเอียดเพิ่มเติม</span>
            <textarea
              name="notes"
              className="min-h-24 w-full rounded-xl border border-forest/20 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={!selected}
          className="mt-5 rounded-full bg-brass px-6 py-2.5 text-sm font-semibold text-[color:var(--accent-foreground)] disabled:opacity-40"
        >
          ยืนยันนัดหมาย
        </button>
        {!selected ? (
          <p className="mt-2 text-xs text-ink/50">กรุณาเลือกช่องเวลาก่อน</p>
        ) : null}
      </section>
    </form>
  );
}
