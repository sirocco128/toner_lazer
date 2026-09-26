import Link from "next/link";
import {
  ensureMyBookingSlugAction,
  saveScheduleAvailabilityAction,
} from "@/app/actions/ops-schedule";
import { AvailabilityEditor } from "@/components/schedule/AvailabilityEditor";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { isPlatformAdmin } from "@/lib/ops-roles";
import { getSiteConfig } from "@/lib/site";
import {
  ensureOpsStaffBookingSlug,
  getOpsStaffBookingSlug,
} from "@/lib/schedule-repository";
import { getAvailabilityOrDefault } from "@/lib/schedule-service";
import { getOpsStaffByEmail, listOpsStaff } from "@/lib/ops-staff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ staff?: string }>;

export default async function OpsScheduleAvailabilityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOpsPage("schedule.write");
  const sp = await searchParams;
  const staffList = listOpsStaff().filter((s) => s.active);
  let staffEmail = actor.email.toLowerCase();
  if (isPlatformAdmin(actor.role) && sp.staff) {
    const wanted = sp.staff.trim().toLowerCase();
    if (staffList.some((s) => s.email === wanted) || wanted === actor.email.toLowerCase()) {
      staffEmail = wanted;
    }
  }

  const rows = getAvailabilityOrDefault(staffEmail);
  const intervals = rows.map((r) => ({
    weekday: r.weekday,
    enabled: r.enabled,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
  }));

  const staff = getOpsStaffByEmail(staffEmail);
  let bookingSlug: string | null = null;
  if (staff) {
    bookingSlug =
      getOpsStaffBookingSlug(staff.id) ||
      ensureOpsStaffBookingSlug(staff.id, staff.email, staff.name);
  }
  const site = getSiteConfig();
  const bookUrl = bookingSlug ? `${site.url}/book/${bookingSlug}` : null;

  return (
    <div className="space-y-5">
      <Link href="/ops/schedule" className="text-sm text-forest hover:underline">
        ← กลับนัดหมาย
      </Link>
      <div>
        <h1 className="font-display text-2xl text-forest">ชั่วโมงว่าง</h1>
        <p className="mt-1 text-sm text-ink/65">
          กำหนดช่วงที่ลูกค้าจองนัดคุยเซลล์ได้ — ส่งลิงก์จองสาธารณะได้
        </p>
      </div>

      {isPlatformAdmin(actor.role) && staffList.length > 0 ? (
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <label>
            <span className="mb-1 block text-forest/70">พนักงาน</span>
            <select
              name="staff"
              defaultValue={staffEmail}
              className="rounded-xl border border-forest/20 bg-paper px-3 py-2"
            >
              <option value={actor.email.toLowerCase()}>
                {actor.name} (ฉัน)
              </option>
              {staffList.map((s) => (
                <option key={s.id} value={s.email}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-full border border-forest/20 px-4 py-2 text-forest hover:bg-forest-mist"
          >
            เปิด
          </button>
        </form>
      ) : null}

      {bookUrl ? (
        <div className="rounded-2xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm">
          <div className="font-medium text-forest">ลิงก์จองสาธารณะ</div>
          <a
            href={bookUrl}
            className="mt-1 break-all text-brass hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {bookUrl}
          </a>
        </div>
      ) : actorMay(actor, "schedule.write") ? (
        <form action={ensureMyBookingSlugAction}>
          <p className="text-sm text-ink/60">
            ยังไม่มีลิงก์จอง — ต้องมีบัญชีพนักงานในระบบก่อน
          </p>
        </form>
      ) : null}

      <AvailabilityEditor
        initial={intervals}
        staffEmail={staffEmail}
        action={saveScheduleAvailabilityAction}
      />
    </div>
  );
}
