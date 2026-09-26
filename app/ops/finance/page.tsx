import Link from "next/link";
import { COMPANY } from "@/lib/company";
import { requireOpsPage } from "@/lib/ops-auth";
import { recordOpsReportPull } from "@/lib/ops-audit";
import { opsAuditRequestMeta } from "@/lib/ops-request-context";
import {
  buildExecutivePnl,
  defaultFinanceRange,
} from "@/lib/finance-report";
import {
  buildBalanceSheet,
  buildCashFlow,
  buildIncomeStatement,
} from "@/lib/ledger-statements";
import { listJournals, trialBalance } from "@/lib/ledger-repository";
import { JOURNAL_BOOK_LABELS } from "@/lib/ledger-types";
import { FinanceSubnav } from "@/components/FinanceSubnav";
import { FACTORY_PO_STATUS_LABELS, type FactoryPoStatus } from "@/lib/factory-po-types";
import { formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ from?: string; to?: string }>;

function barWidth(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return `${Math.min(100, Math.max(0, (part / whole) * 100)).toFixed(1)}%`;
}

function gpTone(pct: number): string {
  if (pct >= 40) return "text-emerald-800";
  if (pct >= 20) return "text-amber-800";
  return "text-red-800";
}

export default async function OpsFinancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOpsPage("finance.read");

  const sp = await searchParams;
  const fallback = defaultFinanceRange();
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from! : fallback.fromDate;
  const toDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to! : fallback.toDate;
  if (sp.from || sp.to) {
    recordOpsReportPull({
      actor,
      kind: "view",
      reportName: "executive-pnl",
      filters: { from: fromDate, to: toDate },
      context: await opsAuditRequestMeta(),
    });
  }
  const pnl = buildExecutivePnl({ fromDate, toDate });
  const booksPnl = buildIncomeStatement({ fromDate, toDate });
  const sheet = buildBalanceSheet({ asOf: toDate });
  const cash = buildCashFlow({ fromDate, toDate });
  const journals = listJournals({ fromDate, toDate, limit: 40 });
  const balances = trialBalance({ fromDate, toDate }).filter(
    (row) => row.debit > 0 || row.credit > 0,
  );
  const exportQs = `from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;

  return (
    <div className="space-y-8">
      <FinanceSubnav current="/ops/finance" />
      <div className="overflow-hidden rounded-2xl bg-forest text-paper shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_right,_rgba(212,175,55,0.28),_transparent_42%)] px-6 py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brass-soft">
            งบผู้บริหาร
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">กำไรขั้นต้นและวงจรรายได้</h1>
          <p className="mt-2 max-w-2xl text-sm text-paper/80">
            {COMPANY.legalName} · จากใบเสนอราคา มัดจำ ใบสั่งโรงงานจีน จนถึงส่งลูกค้า
            และลงบัญชีคู่ครบสมุด ผังบัญชี และงบจากสมุดให้ผู้ทำบัญชี
          </p>
          <p className="mt-3 text-sm text-brass-soft">
            งวด {fromDate} — {toDate} · {pnl.orderCount} ออเดอร์ · มีใบสั่งโรงงาน {pnl.withPoCount} ใบ
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
            className="mt-1 rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink/55">ถึง</span>
          <input
            type="date"
            name="to"
            defaultValue={toDate}
            className="mt-1 rounded border border-forest/20 px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded bg-forest px-4 py-2 text-sm text-paper">
          ดูงบ
        </button>
        <a
          href={`/ops/finance/export/pnl?${exportQs}`}
          className="rounded border border-forest/30 px-4 py-2 text-sm text-forest"
        >
          ส่งออกกำไรขั้นต้น CSV
        </a>
        <a
          href={`/ops/finance/export/journals?${exportQs}`}
          className="rounded border border-forest/30 px-4 py-2 text-sm text-forest"
        >
          ส่งออกสมุดรายวัน CSV
        </a>
        <Link href="/ops/finance/journals" className="text-sm text-forest underline-offset-2 hover:underline">
          สมุดรายวันทั้งหมด
        </Link>
        <Link href="/ops/finance/coa" className="text-sm text-forest underline-offset-2 hover:underline">
          ผังบัญชี
        </Link>
        <Link href="/ops/finance/manual" className="text-sm text-forest underline-offset-2 hover:underline">
          ใบสำคัญทั่วไป
        </Link>
      </form>

      {pnl.missingCostCount > 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          มี {pnl.missingCostCount} ออเดอร์ที่ยังไม่มีต้นทุนโรงงาน — กำไรขั้นต้นงวดนี้สูงเกินจริงจนกว่าจะบันทึกใบสั่ง
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-forest/10 bg-paper p-5 shadow-sm">
          <p className="text-xs text-ink/55">รายได้จากสมุด</p>
          <p className="mt-2 text-2xl font-semibold text-forest">{formatThb(booksPnl.revenue)}</p>
          <p className="mt-1 text-xs text-ink/50">เมื่อออกใบกำกับแล้ว</p>
        </article>
        <article className="rounded-2xl border border-forest/10 bg-paper p-5 shadow-sm">
          <p className="text-xs text-ink/55">กำไรสุทธิจากสมุด</p>
          <p className="mt-2 text-2xl font-semibold">{formatThb(booksPnl.netIncome)}</p>
          <p className="mt-1 text-xs text-ink/50">หลังต้นทุนและค่าใช้จ่าย</p>
        </article>
        <article className="rounded-2xl border border-brass/40 bg-brass/10 p-5 shadow-sm">
          <p className="text-xs text-ink/55">สินทรัพย์</p>
          <p className="mt-2 text-2xl font-semibold">{formatThb(sheet.assetTotal)}</p>
          <p className="mt-1 text-xs text-ink/50">
            {sheet.balanced ? "งบดุลสมดุล" : "ยังไม่สมดุล — ลงทุนที่ 3100"}
          </p>
        </article>
        <article className="rounded-2xl bg-forest p-5 text-paper shadow-sm">
          <p className="text-xs text-paper/70">เงินสดคงเหลือ</p>
          <p className="mt-2 text-2xl font-semibold">{formatThb(cash.closingCash)}</p>
          <p className="mt-1 text-sm text-brass-soft">รับ {formatThb(cash.receipts)} · จ่าย {formatThb(cash.payments)}</p>
        </article>
      </section>

      <h2 className="text-lg font-semibold text-forest">งบปฏิบัติการต่อออเดอร์</h2>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-forest/10 bg-paper p-5 shadow-sm">
          <p className="text-xs text-ink/55">รายได้ไม่รวม VAT</p>
          <p className="mt-2 text-2xl font-semibold text-forest">{formatThb(pnl.revenueExVat)}</p>
          <p className="mt-1 text-xs text-ink/50">VAT {formatThb(pnl.vatAmount)}</p>
        </article>
        <article className="rounded-2xl border border-forest/10 bg-paper p-5 shadow-sm">
          <p className="text-xs text-ink/55">ต้นทุนขาย</p>
          <p className="mt-2 text-2xl font-semibold">{formatThb(pnl.cogsThb)}</p>
          <p className="mt-1 text-xs text-ink/50">โรงงาน + ขนส่ง + นำเข้า</p>
        </article>
        <article className="rounded-2xl border border-brass/40 bg-brass/10 p-5 shadow-sm">
          <p className="text-xs text-ink/55">กำไรขั้นต้น</p>
          <p className={`mt-2 text-2xl font-semibold ${gpTone(pnl.gpPct)}`}>
            {formatThb(pnl.grossProfit)}
          </p>
          <p className="mt-1 text-sm font-medium">{pnl.gpPct.toFixed(1)}%</p>
        </article>
        <article className="rounded-2xl bg-forest p-5 text-paper shadow-sm">
          <p className="text-xs text-paper/70">ส่วนเกินหลังค่าจัดส่ง</p>
          <p className="mt-2 text-2xl font-semibold">{formatThb(pnl.contribution)}</p>
          <p className="mt-1 text-sm text-brass-soft">{pnl.contributionPct.toFixed(1)}% ของรายได้</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-forest/10 bg-paper p-5">
          <h2 className="font-semibold text-forest">วอเตอร์ฟอลล์ต้นทุน</h2>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              { label: "รายได้", amount: pnl.revenueExVat, tone: "bg-forest" },
              { label: "โรงงาน + ขนส่งในจีน", amount: pnl.factoryThb + pnl.inlandThb, tone: "bg-forest/70" },
              { label: "ขนส่งจีน–ไทย", amount: pnl.freightThb, tone: "bg-forest/55" },
              { label: "ภาษีนำเข้า / พิธีการ", amount: pnl.importThb, tone: "bg-forest/40" },
              { label: "กำไรขั้นต้น", amount: Math.max(0, pnl.grossProfit), tone: "bg-brass" },
              { label: "แพ็ก + ส่งลูกค้า", amount: pnl.sellingExpenseThb, tone: "bg-ink/30" },
              { label: "ส่วนเกิน", amount: Math.max(0, pnl.contribution), tone: "bg-emerald-700" },
            ].map((row) => (
              <li key={row.label}>
                <div className="mb-1 flex justify-between">
                  <span>{row.label}</span>
                  <span className="font-medium">{formatThb(row.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-forest/10">
                  <div
                    className={`h-full rounded-full ${row.tone}`}
                    style={{ width: barWidth(row.amount, pnl.revenueExVat) }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-forest/10 bg-paper p-5">
          <h2 className="font-semibold text-forest">งบกำไรขาดทุนย่อ</h2>
          <table className="mt-4 w-full text-sm">
            <tbody>
              <tr className="border-b border-forest/10">
                <td className="py-2">รายได้ขายสินค้า</td>
                <td className="py-2 text-right font-medium">{formatThb(pnl.revenueExVat)}</td>
              </tr>
              <tr>
                <td className="py-1.5 pl-4 text-ink/70">ต้นทุนโรงงาน</td>
                <td className="py-1.5 text-right">{formatThb(pnl.factoryThb)}</td>
              </tr>
              <tr>
                <td className="py-1.5 pl-4 text-ink/70">ขนส่งในจีน</td>
                <td className="py-1.5 text-right">{formatThb(pnl.inlandThb)}</td>
              </tr>
              <tr>
                <td className="py-1.5 pl-4 text-ink/70">ขนส่งจีน–ไทย</td>
                <td className="py-1.5 text-right">{formatThb(pnl.freightThb)}</td>
              </tr>
              <tr className="border-b border-forest/10">
                <td className="py-1.5 pl-4 text-ink/70">นำเข้าและพิธีการ</td>
                <td className="py-1.5 text-right">{formatThb(pnl.importThb)}</td>
              </tr>
              <tr className="border-b border-forest/10 font-medium">
                <td className="py-2">ต้นทุนขาย</td>
                <td className="py-2 text-right">{formatThb(pnl.cogsThb)}</td>
              </tr>
              <tr className="border-b border-brass/40 bg-brass/10 font-semibold text-forest">
                <td className="py-2.5">กำไรขั้นต้น</td>
                <td className="py-2.5 text-right">{formatThb(pnl.grossProfit)}</td>
              </tr>
              <tr>
                <td className="py-1.5 pl-4 text-ink/70">แพ็กในไทย</td>
                <td className="py-1.5 text-right">{formatThb(pnl.packingThb)}</td>
              </tr>
              <tr className="border-b border-forest/10">
                <td className="py-1.5 pl-4 text-ink/70">จัดส่งถึงลูกค้า</td>
                <td className="py-1.5 text-right">{formatThb(pnl.lastMileThb)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-2.5">กำไรส่วนเกินหลังค่าจัดส่ง</td>
                <td className="py-2.5 text-right">{formatThb(pnl.contribution)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-forest">กำไรรายออเดอร์</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-forest/15 text-forest">
                <th className="px-2 py-2">ออเดอร์</th>
                <th className="px-2 py-2">ลูกค้า</th>
                <th className="px-2 py-2 text-right">รายได้</th>
                <th className="px-2 py-2 text-right">ต้นทุนขาย</th>
                <th className="px-2 py-2 text-right">กำไรขั้นต้น</th>
                <th className="px-2 py-2 text-right">%GP</th>
                <th className="px-2 py-2">ใบสั่งโรงงาน</th>
              </tr>
            </thead>
            <tbody>
              {pnl.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-ink/60">
                    ยังไม่มีออเดอร์ในงวดนี้
                  </td>
                </tr>
              ) : (
                pnl.rows.map((row) => (
                  <tr key={row.orderId} className="border-b border-forest/10">
                    <td className="px-2 py-2.5">
                      <Link
                        href={`/ops/orders/${row.orderId}`}
                        className="font-mono text-xs text-forest underline-offset-2 hover:underline"
                      >
                        {row.orderId}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">{row.company}</td>
                    <td className="px-2 py-2.5 text-right">{formatThb(row.revenueExVat)}</td>
                    <td className="px-2 py-2.5 text-right">{formatThb(row.cogsThb)}</td>
                    <td className="px-2 py-2.5 text-right font-medium">
                      {formatThb(row.grossProfit)}
                    </td>
                    <td className={`px-2 py-2.5 text-right ${gpTone(row.gpPct)}`}>
                      {row.gpPct.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2.5">
                      {row.poId ? (
                        <Link
                          href={`/ops/factory-po/${row.poId}`}
                          className="font-mono text-xs text-forest underline-offset-2 hover:underline"
                        >
                          {row.poId}
                          {row.poStatus
                            ? ` · ${FACTORY_PO_STATUS_LABELS[row.poStatus as FactoryPoStatus] || row.poStatus}`
                            : ""}
                        </Link>
                      ) : (
                        <span className="text-amber-800">ยังไม่มีต้นทุน</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-forest">งบทดลองย่อ</h2>
          <div className="table-scroll">
          <table className="mt-3 w-full min-w-[22rem] text-sm">
            <thead>
              <tr className="border-b border-forest/15 text-left text-forest">
                <th className="py-2">บัญชี</th>
                <th className="py-2 text-right">เดบิต</th>
                <th className="py-2 text-right">เครดิต</th>
              </tr>
            </thead>
            <tbody>
              {balances.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-ink/60">
                    ยังไม่มีรายการบัญชีในงวดนี้
                  </td>
                </tr>
              ) : (
                balances.map((row) => (
                  <tr key={row.accountCode} className="border-b border-forest/10">
                    <td className="py-2">
                      <span className="font-mono text-xs">{row.accountCode}</span> {row.nameTh}
                    </td>
                    <td className="py-2 text-right">{row.debit ? formatThb(row.debit) : ""}</td>
                    <td className="py-2 text-right">{row.credit ? formatThb(row.credit) : ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-forest">สมุดรายวันล่าสุด</h2>
          <ul className="mt-3 divide-y divide-forest/10 text-sm">
            {journals.length === 0 ? (
              <li className="py-6 text-ink/60">ยังไม่มีการลงบัญชี</li>
            ) : (
              journals.slice(0, 8).map((entry) => (
                <li key={entry.entryId} className="py-3">
                  <p className="font-mono text-xs text-ink/55">
                    {JOURNAL_BOOK_LABELS[entry.bookType]} · {entry.entryDate} · {entry.entryId}
                  </p>
                  <p>{entry.memo}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
