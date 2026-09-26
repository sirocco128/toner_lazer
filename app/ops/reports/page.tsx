import Link from "next/link";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { recordOpsReportPull } from "@/lib/ops-audit";
import { opsAuditRequestMeta } from "@/lib/ops-request-context";
import { TableScroll } from "@/components/TableScroll";
import {
  buildRevenueCycleReport,
  defaultFinanceRange,
  revenueCycleVisibility,
} from "@/lib/revenue-cycle-report";
import { formatThaiDateTime, formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ from?: string; to?: string }>;

function barWidth(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return `${Math.min(100, Math.max(0, (part / whole) * 100)).toFixed(1)}%`;
}

function DimList({
  title,
  rows,
  hrefBase,
}: {
  title: string;
  rows: Array<{ key: string; label: string; count: number; amount: number }>;
  hrefBase?: string;
}) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <section className="rounded-2xl border border-forest/10 bg-paper p-5">
      <h2 className="font-semibold text-forest">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink/55">ยังไม่มีข้อมูลในงวดนี้</p>
      ) : (
        <ol className="mt-4 space-y-3 text-sm">
          {rows.map((row) => (
            <li key={row.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                {hrefBase ? (
                  <Link
                    href={`${hrefBase}${encodeURIComponent(row.key)}`}
                    className="truncate text-forest underline-offset-2 hover:underline"
                  >
                    {row.label}
                  </Link>
                ) : (
                  <span className="truncate">{row.label}</span>
                )}
                <span className="shrink-0 font-medium tabular-nums">
                  {row.count} · {formatThb(row.amount)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-forest/10">
                <div
                  className="h-full rounded-full bg-forest"
                  style={{ width: barWidth(row.count, max) }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function OpsRevenueReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOpsPage("reports.read");
  const sp = await searchParams;
  const fallback = defaultFinanceRange();
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from! : fallback.fromDate;
  const toDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to! : fallback.toDate;

  if (sp.from || sp.to) {
    recordOpsReportPull({
      actor,
      kind: "view",
      reportName: "revenue-cycle",
      filters: { from: fromDate, to: toDate },
      context: await opsAuditRequestMeta(),
    });
  }

  const report = buildRevenueCycleReport({
    fromDate,
    toDate,
    visibility: revenueCycleVisibility(actor),
  });
  const exportQs = `from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
  const canFinance = actorMay(actor, "finance.read");
  const stuck = report.depositDueAmount + report.balanceDueAmount;

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-2xl bg-forest text-paper">
        <div className="px-5 py-6 sm:px-7 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-soft">
            รายงานวงจรรายได้
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">จากคำขอถึงเงินเข้าบัญชี</h1>
          <p className="mt-2 max-w-2xl text-sm text-paper/80">
            ดูทั้งเส้นในหน้าเดียว — คำขอ ใบเสนอราคา มัดจำ สั่งโรงงาน รับของ ส่วนที่เหลือ
            ใบกำกับ แล้วส่งถึงลูกค้า กรองงวดแล้วกดขั้นที่ค้างเพื่อเปิดงาน
          </p>
          <p className="mt-3 text-sm text-brass-soft">
            {fromDate} — {toDate} · คำขอ {report.quoteCount} · ออเดอร์ {report.orderCount}
            {canFinance && report.grossProfit != null
              ? ` · กำไรขั้นต้น ${formatThb(report.grossProfit)}`
              : ""}
          </p>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm">
          <span className="block text-xs text-ink/55">ตั้งแต่</span>
          <input
            type="date"
            name="from"
            defaultValue={fromDate}
            className="mt-1 rounded border border-forest/20 bg-paper px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink/55">ถึง</span>
          <input
            type="date"
            name="to"
            defaultValue={toDate}
            className="mt-1 rounded border border-forest/20 bg-paper px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded bg-forest px-4 py-2 text-sm text-paper">
          ดูรายงาน
        </button>
        <a
          href={`/ops/reports/export?${exportQs}`}
          className="rounded border border-forest/30 px-4 py-2 text-sm text-forest"
        >
          ส่งออก CSV
        </a>
        {canFinance ? (
          <Link href="/ops/finance" className="text-sm text-forest underline-offset-2 hover:underline">
            งบผู้บริหาร / กำไรขั้นต้น
          </Link>
        ) : (
          <p className="text-xs text-ink/50">บัญชีนี้ไม่เห็นต้นทุนโรงงานและกำไรขั้นต้น</p>
        )}
      </form>

      {stuck > 0 ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          เงินค้างในวงจร {formatThb(stuck)} — มัดจำ {formatThb(report.depositDueAmount)} ·
          ส่วนที่เหลือ {formatThb(report.balanceDueAmount)}
          {report.approvalQueue > 0
            ? ` · สลิปรออนุมัติ ${report.approvalQueue} รายการ`
            : ""}
        </p>
      ) : null}

      {report.missingCostCount > 0 && canFinance ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          มี {report.missingCostCount} ออเดอร์ที่ยังไม่มีต้นทุนโรงงาน — กำไรขั้นต้นงวดนี้สูงเกินจริง
        </p>
      ) : null}

      <nav aria-label="ขั้นวงจรรายได้">
        <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-forest/15 bg-forest/15 sm:grid-cols-3 lg:grid-cols-6">
          {report.stages.map((stage) => (
            <li key={stage.id} className="bg-paper">
              <Link href={stage.href} className="block h-full p-4 hover:bg-forest-mist/50">
                <p className="text-xs text-ink/55">{stage.hint}</p>
                <p className="mt-1 font-semibold text-forest">{stage.label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-forest">{stage.count}</p>
                <p className="mt-1 text-xs text-ink/65">{formatThb(stage.amount)}</p>
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-forest/10 bg-paper p-5">
          <p className="text-xs text-ink/55">แปลงคำขอเป็นปิดการขาย</p>
          <p className="mt-2 text-2xl font-semibold text-forest">{report.quoteToWonPct.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-ink/50">
            ปิด {report.wonCount} จาก {report.quoteCount} · ไม่สำเร็จ {report.lostCount}
          </p>
        </article>
        <article className="rounded-2xl border border-forest/10 bg-paper p-5">
          <p className="text-xs text-ink/55">มูลค่าออเดอร์ที่เปิด</p>
          <p className="mt-2 text-2xl font-semibold text-forest">{formatThb(report.billedAmount)}</p>
          <p className="mt-1 text-xs text-ink/50">{report.orderCount} ออเดอร์ในงวด (รวม VAT)</p>
        </article>
        <article className="rounded-2xl border border-brass/40 bg-brass/10 p-5">
          <p className="text-xs text-ink/55">รับชำระแล้วในช่วง</p>
          <p className="mt-2 text-2xl font-semibold">{formatThb(report.collectedAmount)}</p>
          <p className="mt-1 text-xs text-ink/50">ยอดที่บัญชียืนยันรับ</p>
        </article>
        <article className="rounded-2xl bg-forest p-5 text-paper">
          <p className="text-xs text-paper/70">ลูกหนี้ปฏิบัติการ</p>
          <p className="mt-2 text-2xl font-semibold">{formatThb(report.openArAmount)}</p>
          <p className="mt-1 text-sm text-brass-soft">
            คำขอค้างติดต่อ {report.openLeadCount}
            {report.approvalQueue ? ` · รออนุมัติ ${report.approvalQueue}` : ""}
          </p>
        </article>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <DimList title="จังหวัดที่ขอใบเสนอราคา" rows={report.quoteByProvince} />
        <DimList title="สินค้าที่ลูกค้าสนใจ" rows={report.quoteByProduct} />
        <DimList title="วิธีสกรีน / ตกแต่ง" rows={report.quoteByDecoration} />
        <DimList title="แหล่งเข้าเว็บ (UTM)" rows={report.quoteByUtm} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DimList title="สถานะใบเสนอราคา" rows={report.quoteByStatus} hrefBase="/ops/quotes?status=" />
        <DimList title="สถานะรับชำระ" rows={report.orderByPayment} hrefBase="/ops/orders?payment=" />
        <DimList
          title="สถานะจัดส่งถึงลูกค้า"
          rows={report.orderByFulfillment}
          hrefBase="/ops/orders?fulfillment="
        />
        {report.showFactory ? (
          <DimList title="สถานะใบสั่งโรงงาน" rows={report.factoryByStatus} />
        ) : (
          <section className="rounded-2xl border border-dashed border-forest/20 bg-paper/60 p-5">
            <h2 className="font-semibold text-forest">ใบสั่งโรงงาน</h2>
            <p className="mt-2 text-sm text-ink/65">
              บัญชีนี้ไม่มีสิทธิ์ดูต้นทุนและสถานะใบสั่งโรงงาน — ให้ผู้ดูแลเปิดสิทธิ์โรงงานถ้าต้องการมุมนี้
            </p>
          </section>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-forest">รายการที่วงจรยังไม่จบ</h2>
        <p className="mt-1 text-sm text-ink/65">
          กดรหัสเพื่อเปิดงาน — เซลล์เห็นคำขอและออเดอร์ บัญชีเห็นเงินค้าง คลังเห็นของที่ยังไม่ครบใบสั่ง
        </p>
        <TableScroll className="mt-3">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-forest/15 text-forest">
                <th className="px-2 py-2">ติดที่</th>
                <th className="px-2 py-2">รหัส</th>
                <th className="px-2 py-2">ลูกค้า</th>
                <th className="px-2 py-2 text-right">มูลค่า</th>
                <th className="px-2 py-2">เมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {report.exceptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-ink/60">
                    งวดนี้ไม่มีรายการค้างที่ระบบจับได้
                  </td>
                </tr>
              ) : (
                report.exceptions.map((row) => (
                  <tr key={`${row.kind}-${row.title}`} className="border-b border-forest/10">
                    <td className="px-2 py-2.5">{row.label}</td>
                    <td className="px-2 py-2.5">
                      <Link
                        href={row.href}
                        className="font-mono text-xs text-forest underline-offset-2 hover:underline"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">{row.company}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatThb(row.amount)}</td>
                    <td className="px-2 py-2.5 text-ink/70">{formatThaiDateTime(row.when)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>
      </section>
    </div>
  );
}
