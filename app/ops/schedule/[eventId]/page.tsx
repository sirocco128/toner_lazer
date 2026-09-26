import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelScheduleEventAction,
  resendScheduleNotifyAction,
  updateScheduleEventAction,
} from "@/app/actions/ops-schedule";
import { EventForm } from "@/components/schedule/EventForm";
import {
  eventToFormValues,
  type EventFormStaffOption,
} from "@/lib/schedule-form";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listOpsUserSeeds } from "@/lib/ops-roles";
import { listOpsStaff } from "@/lib/ops-staff";
import { formatBangkokDateTime } from "@/lib/bangkok-date";
import { getScheduleEventById } from "@/lib/schedule-repository";
import { generateBookableSlots } from "@/lib/schedule-service";
import {
  SCHEDULE_KIND_LABELS,
  SCHEDULE_STATUS_LABELS,
} from "@/lib/schedule-types";
import { bangkokYmdDash } from "@/lib/bangkok-date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function staffOptionsFor(actorEmail: string, actorName: string): EventFormStaffOption[] {
  const fromDb: EventFormStaffOption[] = listOpsStaff()
    .filter((s) => s.active)
    .map((s) => ({
      email: s.email,
      name: s.name,
      staffId: s.id,
    }));
  const map = new Map<string, EventFormStaffOption>(
    fromDb.map((s) => [s.email, s]),
  );
  for (const seed of listOpsUserSeeds()) {
    if (!map.has(seed.email)) {
      map.set(seed.email, { email: seed.email, name: seed.name });
    }
  }
  if (!map.has(actorEmail.toLowerCase())) {
    map.set(actorEmail.toLowerCase(), {
      email: actorEmail.toLowerCase(),
      name: actorName,
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "th"),
  );
}

export default async function OpsScheduleEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const actor = await requireOpsPage("schedule.read");
  const canWrite = actorMay(actor, "schedule.write");
  const { eventId } = await params;
  const event = getScheduleEventById(eventId);
  if (!event) notFound();

  const staffOptions = staffOptionsFor(actor.email, actor.name);
  const slots = generateBookableSlots({
    hostEmail: event.hostEmail,
    fromYmd: bangkokYmdDash(),
    days: 14,
  });

  return (
    <div className="space-y-5">
      <Link href="/ops/schedule" className="text-sm text-forest hover:underline">
        ← กลับนัดหมาย
      </Link>

      <div className="rounded-2xl border border-forest/15 bg-paper p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-forest/55">{event.id}</p>
            <h1 className="font-display text-2xl text-forest">{event.title}</h1>
            <p className="mt-1 text-sm text-ink/65">
              {SCHEDULE_KIND_LABELS[event.kind]} ·{" "}
              {SCHEDULE_STATUS_LABELS[event.status]}
            </p>
            <p className="mt-2 text-sm text-ink">
              {formatBangkokDateTime(event.startsAt)} –{" "}
              {formatBangkokDateTime(event.endsAt)}
            </p>
            {event.location ? (
              <p className="mt-1 text-sm text-ink/70">สถานที่: {event.location}</p>
            ) : null}
          </div>
          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <form action={resendScheduleNotifyAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <button
                  type="submit"
                  className="rounded-full border border-forest/20 px-4 py-2 text-sm text-forest hover:bg-forest-mist"
                >
                  ส่งเมลซ้ำ
                </button>
              </form>
              {event.status !== "cancelled" ? (
                <form action={cancelScheduleEventAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-red-300 px-4 py-2 text-sm text-red-800 hover:bg-red-50"
                  >
                    ยกเลิกนัด
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-semibold text-forest">ผู้เกี่ยวข้อง</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink/80">
            {event.attendees.map((a) => (
              <li key={a.id}>
                {a.role === "staff" ? "พนักงาน" : "ภายนอก"} · {a.name || a.email}{" "}
                &lt;{a.email}&gt;
                {a.lastNotifyStatus
                  ? ` · เมล: ${a.lastNotifyStatus}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {canWrite ? (
        <EventForm
          mode="edit"
          eventId={event.id}
          initial={eventToFormValues(event)}
          staffOptions={staffOptions}
          slots={slots}
          action={updateScheduleEventAction}
          submitLabel="บันทึกและแจ้งเตือน"
        />
      ) : null}
    </div>
  );
}
