import { FinanceSubnav } from "@/components/FinanceSubnav";
import { requireOpsPage } from "@/lib/ops-auth";
import { buildCashFlow, buildIncomeStatement } from "@/lib/ledger-statements";
import { defaultFinanceRange } from "@/lib/finance-report";
import { formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("finance.read");
  const sp = await searchParams;
  const fallback = defaultFinanceRange();
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from! : fallback.fromDate;
  const toDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to! : fallback.toDate;
  const flow = buildCashFlow({ fromDate, toDate });
  const income = buildIncomeStatement({ fromDate, toDate });

  return (
    <div className="space-y-6">
      <FinanceSubnav current="/ops/finance/cash-flow" />
      <div>
        <h1 className="text-2xl font-bold text-forest">งบกระแสเงินสด</h1>
        <p className="mt-1 text-sm text-ink/70">
          วิธีตรงจากบัญชี 1110 เงินสด/พร้อมเพย์ งวด {fromDate} — {toDate}
        </p>
      </div>
      <form className="flex flex-wrap gap-3" method="get">
        <input type="date" name="from" defaultValue={fromDate} className="rounded border border-forest/20 px-3 py-2 text-sm" />
        <input type="date" name="to" defaultValue={toDate} className="rounded border border-forest/20 px-3 py-2 text-sm" />
        <button type="submit" className="rounded bg-forest px-4 py-2 text-sm text-paper">
          ดูงบ
        </button>
      </form>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-forest/10 bg-paper p-5">
          <p className="text-xs text-ink/55">รับเงิน</p>
          <p className="mt-2 text-2xl font-semibold text-forest">{formatThb(flow.receipts)}</p>
        </article>
        <article className="rounded-2xl border border-forest/10 bg-paper p-5">
          <p className="text-xs text-ink/55">จ่ายเงิน</p>
          <p className="mt-2 text-2xl font-semibold">{formatThb(flow.payments)}</p>
        </article>
        <article className="rounded-2xl border border-brass/40 bg-brass/10 p-5">
          <p className="text-xs text-ink/55">เงินสดเพิ่ม (ลด)</p>
          <p className="mt-2 text-2xl font-semibold">{formatThb(flow.netChange)}</p>
        </article>
        <article className="rounded-2xl bg-forest p-5 text-paper">
          <p className="text-xs text-paper/70">เงินสดคงเหลือ</p>
          <p className="mt-2 text-2xl font-semibold">{formatThb(flow.closingCash)}</p>
        </article>
      </section>
      <p className="text-sm text-ink/70">
        กำไรสุทธิจากสมุดในงวดเดียวกัน {formatThb(income.netIncome)} — ไม่ใช่เงินสดถ้ายังมีลูกหนี้หรือเจ้าหนี้ค้าง
      </p>
    </div>
  );
}
