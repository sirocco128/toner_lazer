import Link from "next/link";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { DayAgenda, MonthCalendar } from "@/components/schedule/MonthCalendar";
import { WeekTimeline } from "@/components/schedule/WeekTimeline";
import {
  addDaysYmd,
  bangkokLocalToUtcIso,
  bangkokYmdDash,
  startOfBangkokWeekYmd,
} from "@/lib/bangkok-date";
import { listScheduleEventsForRange } from "@/lib/schedule-service";
import {
  SCHEDULE_KINDS,
  SCHEDULE_KIND_LABELS,
  SCHEDULE_STATUSES,
  SCHEDULE_STATUS_LABELS,
  type ScheduleKind,
  type ScheduleStatus,
} from "@/lib/schedule-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{
  day?: string;
  view?: string;
  kind?: string;
  status?: string;
  month?: string;
}>;

function parseYmd(raw: string | undefined, fallback: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return fallback;
}

export default async function OpsSchedulePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOpsPage("schedule.read");
  const canWrite = actorMay(actor, "schedule.write");
  const sp = await searchParams;
  const today = bangkokYmdDash();
  const day = parseYmd(sp.day, today);
  const view = sp.view === "week" ? "week" : "month";
  const kind =
    sp.kind && (SCHEDULE_KINDS as readonly string[]).includes(sp.kind)
      ? (sp.kind as ScheduleKind)
      : "all";
  const status =
    sp.status && (SCHEDULE_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as ScheduleStatus)
      : "all";

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(sp.month || day.slice(0, 7));
  const year = monthMatch ? Number(monthMatch[1]) : Number(day.slice(0, 4));
  const monthIndex = monthMatch
    ? Number(monthMatch[2]) - 1
    : Number(day.slice(5, 7)) - 1;
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const weekStart = startOfBangkokWeekYmd(day);
  const rangeFrom =
    view === "week"
      ? bangkokLocalToUtcIso(weekStart, 0)
      : bangkokLocalToUtcIso(`${monthPrefix}-01`, 0);
  const rangeTo =
    view === "week"
      ? bangkokLocalToUtcIso(addDaysYmd(weekStart, 6), 24 * 60 - 1)
      : bangkokLocalToUtcIso(addDaysYmd(`${monthPrefix}-28`, 10), 24 * 60 - 1);

  let events: Awaited<ReturnType<typeof listScheduleEventsForRange>> = [];
  try {
    events = listScheduleEventsForRange({
      fromIso: rangeFrom,
      toIso: rangeTo,
      kind,
      status,
      includeCancelled: status === "cancelled" || status === "all",
    });
  } catch (error) {
    console.error("[ops-schedule] list failed", error);
  }

  const qs = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      day,
      view,
      kind: kind === "all" ? undefined : kind,
      status: status === "all" ? undefined : status,
      month: monthPrefix,
      ...extra,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  const prevMonth =
    monthIndex === 0
      ? `${year - 1}-12`
      : `${year}-${String(monthIndex).padStart(2, "0")}`;
  const nextMonth =
    monthIndex === 11
      ? `${year + 1}-01`
      : `${year}-${String(monthIndex + 2).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-forest">นัดหมาย</h1>
          <p className="mt-1 text-sm text-ink/65">
            ปฏิทิน · วาระ · ชั่วโมงว่าง — แจ้งเตือนพนักงานและลูกค้าทาง Gmail
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <>
              <Link
                href="/ops/schedule/new"
                className="rounded-full bg-brass px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground)]"
              >
                สร้างนัด
              </Link>
              <Link
                href="/ops/schedule/availability"
                className="rounded-full border border-forest/20 px-4 py-2 text-sm text-forest hover:bg-forest-mist"
              >
                ชั่วโมงว่าง
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <form className="flex flex-wrap gap-2 text-sm">
        <input type="hidden" name="day" value={day} />
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="month" value={monthPrefix} />
        <select
          name="kind"
          defaultValue={kind}
          className="rounded-xl border border-forest/20 bg-paper px-3 py-2"
        >
          <option value="all">ทุกประเภท</option>
          {SCHEDULE_KINDS.map((k) => (
            <option key={k} value={k}>
              {SCHEDULE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-xl border border-forest/20 bg-paper px-3 py-2"
        >
          <option value="all">ทุกสถานะ</option>
          {SCHEDULE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SCHEDULE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full border border-forest/20 px-4 py-2 text-forest hover:bg-forest-mist"
        >
          กรอง
        </button>
      </form>

      {view === "week" ? (
        <WeekTimeline
          weekStartYmd={weekStart}
          events={events}
          viewLinks={{
            monthHref: `/ops/schedule${qs({ view: "month" })}`,
            weekHref: `/ops/schedule${qs({ view: "week" })}`,
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/ops/schedule${qs({ month: prevMonth, day: `${prevMonth}-01` })}`}
                className="text-sm text-forest hover:underline"
              >
                ← เดือนก่อน
              </Link>
              <div className="font-medium text-forest">
                {monthPrefix.replace("-", "/")}
              </div>
              <Link
                href={`/ops/schedule${qs({ month: nextMonth, day: `${nextMonth}-01` })}`}
                className="text-sm text-forest hover:underline"
              >
                เดือนถัดไป →
              </Link>
            </div>
            <MonthCalendar
              year={year}
              monthIndex={monthIndex}
              selectedYmd={day}
              events={events}
              filterParams={{
                view: "month",
                ...(kind === "all" ? {} : { kind }),
                ...(status === "all" ? {} : { status }),
              }}
            />
            <div className="flex gap-2 text-xs">
              <Link
                href={`/ops/schedule${qs({ view: "month" })}`}
                className="rounded-full border border-forest bg-forest px-3 py-1 text-paper"
              >
                เดือน
              </Link>
              <Link
                href={`/ops/schedule${qs({ view: "week" })}`}
                className="rounded-full border border-forest/20 px-3 py-1 text-forest hover:bg-forest-mist"
              >
                สัปดาห์
              </Link>
            </div>
          </div>
          <DayAgenda
            ymd={day}
            events={events}
            kindFilter={kind === "all" ? "all" : kind}
          />
        </div>
      )}
    </div>
  );
}
