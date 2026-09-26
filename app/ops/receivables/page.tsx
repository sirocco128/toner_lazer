import Link from "next/link";
import { requireOpsPage } from "@/lib/ops-auth";
import { getOrderRepository } from "@/lib/order-repository";
import {
  AGING_BUCKETS,
  AGING_BUCKET_LABELS,
  summarizeReceivables,
} from "@/lib/receivables";
import { formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ReceivablesPage() {
  await requireOpsPage("finance.read");
  const orders = getOrderRepository().listOpenReceivables(1000);
  const summary = summarizeReceivables(orders, new Date());

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">ลูกหนี้ค้างชำระ</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink/70">
        ออเดอร์ที่ยังชำระไม่ครบ แยกตามอายุหนี้นับจากวันครบกำหนด ออเดอร์เครดิตได้วันครบกำหนดเมื่อส่งของ
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-forest/15 bg-paper p-4">
          <dt className="text-xs text-ink/60">ยอดค้างทั้งหมด</dt>
          <dd className="mt-1 text-xl font-semibold text-forest">{formatThb(summary.totalOutstanding)}</dd>
        </div>
        <div className="rounded-xl border border-forest/15 bg-paper p-4">
          <dt className="text-xs text-ink/60">เกินกำหนดแล้ว</dt>
          <dd className="mt-1 text-xl font-semibold text-red-700">{formatThb(summary.overdueOutstanding)}</dd>
        </div>
        <div className="rounded-xl border border-forest/15 bg-paper p-4">
          <dt className="text-xs text-ink/60">จำนวนออเดอร์</dt>
          <dd className="mt-1 text-xl font-semibold text-forest">{summary.rows.length}</dd>
        </div>
      </dl>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-left text-xs text-ink/60">
              {AGING_BUCKETS.map((b) => (
                <th key={b} className="px-2 py-2 font-medium">{AGING_BUCKET_LABELS[b]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {AGING_BUCKETS.map((b) => (
                <td key={b} className="px-2 py-2 tabular-nums">{formatThb(summary.totals[b])}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-left text-xs text-ink/60">
              <th className="px-2 py-2 font-medium">ออเดอร์</th>
              <th className="px-2 py-2 font-medium">ลูกค้า</th>
              <th className="px-2 py-2 font-medium">เครดิต</th>
              <th className="px-2 py-2 font-medium">ครบกำหนด</th>
              <th className="px-2 py-2 font-medium">สถานะหนี้</th>
              <th className="px-2 py-2 text-right font-medium">ค้างชำระ</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-ink/60">ไม่มีลูกหนี้ค้างชำระ</td>
              </tr>
            ) : (
              summary.rows.map((row) => (
                <tr key={row.orderId} className="border-b border-forest/10">
                  <td className="px-2 py-2">
                    <Link href={`/ops/orders/${row.orderId}`} className="text-forest underline-offset-2 hover:underline">
                      {row.orderId}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{row.company}</td>
                  <td className="px-2 py-2">{row.creditDays > 0 ? `${row.creditDays} วัน` : "เงินสด"}</td>
                  <td className="px-2 py-2">{row.dueDate ?? "-"}</td>
                  <td className={`px-2 py-2 ${row.daysPastDue != null && row.daysPastDue > 0 ? "text-red-700" : ""}`}>
                    {AGING_BUCKET_LABELS[row.bucket]}
                    {row.daysPastDue != null && row.daysPastDue > 0 ? ` (${row.daysPastDue} วัน)` : ""}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatThb(row.outstanding)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
