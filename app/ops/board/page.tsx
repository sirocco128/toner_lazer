import Link from "next/link";
import { BoardStatusRulesNote } from "@/components/BoardStatusRulesNote";
import { requireOpsPage } from "@/lib/ops-auth";
import {
  BOARD_MAIN_FLOW,
  BOARD_STATUSES,
  BOARD_TRANSITIONS,
} from "@/lib/board-status-rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_LABEL = Object.fromEntries(
  BOARD_STATUSES.map((s) => [s.id, s.label]),
) as Record<string, string>;

export default async function OpsBoardPage() {
  await requireOpsPage();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-forest">บอร์ดงาน</h1>
        <p className="mt-1 text-sm text-ink/70">
          ติดตามงานแบบ Kanban — สถานะ · อนุมัติ · สมาชิก · ค่าใช้จ่าย (กำลังเตรียมบอร์ดลากวาง)
        </p>
        <p className="mt-2 text-sm text-forest/80">
          Flow หลัก: <span className="font-medium">{BOARD_MAIN_FLOW}</span>
        </p>
      </header>

      <BoardStatusRulesNote />

      <section>
        <h2 className="text-lg font-semibold text-forest">สถานะการ์ด</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {BOARD_STATUSES.map((status) => (
            <li
              key={status.id}
              className="rounded-xl border border-forest/15 bg-paper px-4 py-3"
            >
              <p className="font-medium text-forest">{status.label}</p>
              <p className="mt-1 text-sm text-ink/70">{status.meaning}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-forest">กติกาย้ายสถานะ</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-forest/15 bg-paper">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-forest/10 bg-forest/5 text-forest">
              <tr>
                <th className="px-4 py-2 font-semibold">อยู่ที่</th>
                <th className="px-4 py-2 font-semibold">ย้ายไปได้</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(BOARD_TRANSITIONS) as Array<
                keyof typeof BOARD_TRANSITIONS
              >).map((from) => {
                const next = BOARD_TRANSITIONS[from];
                return (
                  <tr key={from} className="border-b border-forest/10 last:border-0">
                    <td className="px-4 py-2 font-medium text-forest">
                      {STATUS_LABEL[from]}
                    </td>
                    <td className="px-4 py-2 text-ink/80">
                      {next.length
                        ? next.map((id) => STATUS_LABEL[id]).join(", ")
                        : "ย้ายต่อไม่ได้ (ยกเว้นเปิดงานใหม่เป็นกรณีพิเศษ)"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm text-ink/60">
        เอกสารเต็ม:{" "}
        <Link href="/ops" className="text-brass hover:underline">
          กลับภาพรวม
        </Link>
        {" · "}
        <span className="text-ink/50">docs/BOARD-STATUS-RULES.md</span>
      </p>
    </div>
  );
}
