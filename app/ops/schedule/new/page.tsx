import Link from "next/link";
import { createScheduleEventAction } from "@/app/actions/ops-schedule";
import { EventForm } from "@/components/schedule/EventForm";
import type {
  EventFormStaffOption,
  EventFormValues,
} from "@/lib/schedule-form";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listOpsUserSeeds } from "@/lib/ops-roles";
import { listOpsStaff } from "@/lib/ops-staff";
import { bangkokYmdDash } from "@/lib/bangkok-date";
import { generateBookableSlots } from "@/lib/schedule-service";
import { SCHEDULE_KIND_LABELS } from "@/lib/schedule-types";

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

export default async function OpsScheduleNewPage() {
  const actor = await requireOpsPage("schedule.write");
  if (!actorMay(actor, "schedule.write")) return null;
  const staffOptions = staffOptionsFor(actor.email, actor.name);
  const hostEmail = actor.email.toLowerCase();
  const slots = generateBookableSlots({
    hostEmail,
    fromYmd: bangkokYmdDash(),
    days: 14,
  });
  const initial: EventFormValues = {
    kind: "sales_meeting",
    title: SCHEDULE_KIND_LABELS.sales_meeting,
    notes: "",
    ymd: bangkokYmdDash(),
    startHm: "10:00",
    endHm: "10:30",
    status: "scheduled",
    location: "",
    hostEmail,
    customerId: "",
    orderId: "",
    staffEmails: [hostEmail],
    externalEmails: "",
    notify: true,
  };

  return (
    <div className="space-y-4">
      <Link href="/ops/schedule" className="text-sm text-forest hover:underline">
        ← กลับนัดหมาย
      </Link>
      <EventForm
        mode="create"
        initial={initial}
        staffOptions={staffOptions}
        slots={slots}
        action={createScheduleEventAction}
        submitLabel="สร้างและแจ้งเตือน"
      />
    </div>
  );
}
