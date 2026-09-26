"use client";

import { cn } from "@/lib/utils";
import { formatMinuteLabel, parseHmToMinute } from "@/lib/bangkok-date";

const DURATION_CHIPS = [15, 30, 45, 60, 90, 120] as const;

function minuteOptions(step = 15): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    out.push(formatMinuteLabel(m));
  }
  return out;
}

const OPTIONS = minuteOptions(15);

export function TimeRangePicker({
  startHm,
  endHm,
  onChange,
  idPrefix = "time",
}: {
  startHm: string;
  endHm: string;
  onChange: (next: { startHm: string; endHm: string }) => void;
  idPrefix?: string;
}) {
  const startMin = parseHmToMinute(startHm) ?? 9 * 60;
  const endMin = parseHmToMinute(endHm) ?? startMin + 30;
  const duration = Math.max(0, endMin - startMin);

  function setStart(hm: string) {
    const s = parseHmToMinute(hm) ?? startMin;
    let e = parseHmToMinute(endHm) ?? s + 30;
    if (e <= s) e = Math.min(24 * 60, s + 30);
    onChange({
      startHm: formatMinuteLabel(s),
      endHm: formatMinuteLabel(e),
    });
  }

  function setEnd(hm: string) {
    onChange({ startHm, endHm: hm });
  }

  function applyDuration(mins: number) {
    const e = Math.min(24 * 60, startMin + mins);
    onChange({
      startHm: formatMinuteLabel(startMin),
      endHm: formatMinuteLabel(e),
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-forest/15 bg-forest-mist/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-forest/70">เริ่ม</span>
          <select
            id={`${idPrefix}-start`}
            className="w-full rounded-xl border border-forest/20 bg-paper px-3 py-2"
            value={formatMinuteLabel(startMin)}
            onChange={(e) => setStart(e.target.value)}
          >
            {OPTIONS.map((hm) => (
              <option key={hm} value={hm}>
                {hm}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-forest/70">สิ้นสุด</span>
          <select
            id={`${idPrefix}-end`}
            className="w-full rounded-xl border border-forest/20 bg-paper px-3 py-2"
            value={formatMinuteLabel(endMin)}
            onChange={(e) => setEnd(e.target.value)}
          >
            {OPTIONS.map((hm) => (
              <option key={hm} value={hm} disabled={(parseHmToMinute(hm) ?? 0) <= startMin}>
                {hm}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {DURATION_CHIPS.map((mins) => (
          <button
            key={mins}
            type="button"
            onClick={() => applyDuration(mins)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              duration === mins
                ? "border-brass bg-brass/15 text-forest"
                : "border-forest/15 text-forest/70 hover:border-brass/40",
            )}
          >
            {mins < 60 ? `${mins} นาที` : `${mins / 60} ชม.`}
          </button>
        ))}
      </div>
    </div>
  );
}
