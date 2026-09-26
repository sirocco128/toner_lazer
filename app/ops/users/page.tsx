import Link from "next/link";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import {
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  listOpsUserSeeds,
} from "@/lib/ops-roles";
import { listOpsStaff } from "@/lib/ops-staff";
import { OpsStaffForm } from "@/components/OpsStaffForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function OpsUsersPage() {
  const actor = await requireOpsPage("users.read");
  const canWrite = actorMay(actor, "users.write");
  const staff = listOpsStaff();
  const envUsers = listOpsUserSeeds();

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">ผู้ใช้และพนักงาน</h1>
      <p className="mt-1 text-sm text-ink/70">
        กำหนดใครเข้า Ops ได้ และให้สิทธิ์ตามบทบาท (ผู้ดูแล / เซลล์ / ดูอย่างเดียว)
        แล้วปรับสิทธิ์รายคนได้
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2 font-semibold">พนักงาน</th>
              <th className="px-2 py-2 font-semibold">บทบาท</th>
              <th className="px-2 py-2 font-semibold">แผนก</th>
              <th className="px-2 py-2 font-semibold">สถานะ</th>
              <th className="px-2 py-2 font-semibold">เข้าล่าสุด</th>
              <th className="px-2 py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-ink/60">
                  ยังไม่มีพนักงานในฐานข้อมูล — เพิ่มด้านล่าง หรือใช้บัญชีจากค่าเครื่องชั่วคราว
                </td>
              </tr>
            ) : (
              staff.map((row) => (
                <tr key={row.id} className="border-b border-forest/10">
                  <td className="px-2 py-2">
                    <p className="font-medium text-forest">{row.name}</p>
                    <p className="text-xs text-ink/55">{row.email}</p>
                  </td>
                  <td className="px-2 py-2">{ROLE_LABELS[row.role]}</td>
                  <td className="px-2 py-2">
                    {row.department ? DEPARTMENT_LABELS[row.department] : "—"}
                  </td>
                  <td className="px-2 py-2">
                    {row.active ? "ใช้งานได้" : "ปิดอยู่"}
                  </td>
                  <td className="px-2 py-2 text-ink/70">
                    {formatWhen(row.lastLoginAt)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {canWrite ? (
                      <Link
                        href={`/ops/users/${row.id}`}
                        className="text-forest underline-offset-2 hover:underline"
                      >
                        แก้สิทธิ์
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {envUsers.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-forest">บัญชีจากค่าเครื่อง</h2>
          <p className="mt-1 text-sm text-ink/65">
            ตั้งในไฟล์สภาพแวดล้อม (ADMIN_PASSWORD / OPS_USERS) ไม่ใช่พนักงานในฐานข้อมูล
            ถ้าสร้างพนักงานอีเมลเดียวกัน ระบบจะใช้บัญชีในหน้านี้แทน
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {envUsers.map((user) => (
              <li key={user.email}>
                {user.name} · {user.email} · {ROLE_LABELS[user.role]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canWrite ? (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-forest">เพิ่มพนักงาน</h2>
          <OpsStaffForm mode="create" />
        </section>
      ) : null}
    </div>
  );
}
