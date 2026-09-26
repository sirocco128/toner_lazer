import Link from "next/link";
import { bookPublicScheduleAction } from "@/app/actions/ops-schedule";
import { PublicBookingSurface } from "@/components/schedule/PublicBookingSurface";
import { COMPANY } from "@/lib/company";
import { bangkokYmdDash } from "@/lib/bangkok-date";
import {
  ensureDefaultAvailability,
  getOpsStaffByBookingSlug,
  getScheduleEventById,
} from "@/lib/schedule-repository";
import { generateBookableSlots } from "@/lib/schedule-service";
import { formatBangkokDateTime } from "@/lib/bangkok-date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ booked?: string; error?: string }>;

export default async function PublicBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const host = getOpsStaffByBookingSlug(slug);

  if (!host) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl text-forest">ไม่พบลิงก์นัดหมาย</h1>
        <p className="mt-2 text-sm text-ink/65">
          ลิงก์อาจหมดอายุหรือยังไม่ได้เปิดรับจอง
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-brass hover:underline">
          กลับหน้าแรก
        </Link>
      </main>
    );
  }

  if (sp.booked) {
    const event = getScheduleEventById(sp.booked);
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-3xl border border-forest/15 bg-paper p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
            จองสำเร็จ
          </p>
          <h1 className="mt-2 font-display text-3xl text-forest">นัดหมายยืนยันแล้ว</h1>
          {event ? (
            <p className="mt-3 text-sm text-ink/70">
              {event.title}
              <br />
              {formatBangkokDateTime(event.startsAt)}
              <br />
              รหัสนัด {event.id}
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink/70">รหัสนัด {sp.booked}</p>
          )}
          <p className="mt-4 text-sm text-ink/60">
            เราได้ส่งอีเมลยืนยันไปยังคุณและทีมเซลล์แล้ว (ถ้าตั้งค่า Gmail ไว้)
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-paper"
          >
            กลับหน้าแรก
          </Link>
        </div>
      </main>
    );
  }

  ensureDefaultAvailability(host.email);
  const slots = generateBookableSlots({
    hostEmail: host.email,
    fromYmd: bangkokYmdDash(),
    days: 14,
  });

  const boundAction = bookPublicScheduleAction.bind(null, slug);

  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-10">
      <div className="mx-auto mb-6 max-w-3xl text-center">
        <Link href="/" className="text-xs font-semibold tracking-wide text-brass">
          {COMPANY.brandName}
        </Link>
      </div>
      {sp.error ? (
        <p className="mx-auto mb-4 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          จองไม่สำเร็จ ({sp.error}) — ลองเลือกช่องเวลาอื่น
        </p>
      ) : null}
      <PublicBookingSurface
        hostName={host.name}
        summary={`นัดคุยเซลล์ / ดูตัวอย่างสินค้ากับ ${host.name} — เลือกวันและเวลาที่สะดวก ระบบจะแจ้งเตือนทางอีเมล`}
        slots={slots}
        action={boundAction}
      />
    </main>
  );
}
