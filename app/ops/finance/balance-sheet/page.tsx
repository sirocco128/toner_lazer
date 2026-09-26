import { FinanceSubnav } from "@/components/FinanceSubnav";
import { requireOpsPage } from "@/lib/ops-auth";
import { buildBalanceSheet, buildIncomeStatement } from "@/lib/ledger-statements";
import { defaultFinanceRange } from "@/lib/finance-report";
import { formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ asOf?: string }>;

function LineTable({
  title,
  lines,
  total,
}: {
  title: string;
  lines: Array<{ accountCode: string; nameTh: string; amount: number }>;
  total: number;
}) {
  return (
    <div>
      <h2 className="font-semibold text-forest">{title}</h2>
      <div className="table-scroll">
      <table className="mt-3 w-full min-w-[18rem] text-sm">
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td className="py-4 text-ink/60">ยังไม่มียอด</td>
            </tr>
          ) : (
            lines.map((line) => (
              <tr key={line.accountCode} className="border-b border-forest/10">
                <td className="py-2">
                  <span className="font-mono text-xs">{line.accountCode}</span> {line.nameTh}
                </td>
                <td className="py-2 text-right">{formatThb(line.amount)}</td>
              </tr>
            ))
          )}
          <tr className="font-semibold">
            <td className="py-2.5">รวม {title}</td>
            <td className="py-2.5 text-right">{formatThb(total)}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("finance.read");
  const sp = await searchParams;
  const fallback = defaultFinanceRange();
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(sp.asOf || "") ? sp.asOf! : fallback.toDate;
  const sheet = buildBalanceSheet({ asOf });
  const income = buildIncomeStatement({ fromDate: "1970-01-01", toDate: asOf });

  return (
    <div className="space-y-6">
      <FinanceSubnav current="/ops/finance/balance-sheet" />
      <div>
        <h1 className="text-2xl font-bold text-forest">งบดุล</h1>
        <p className="mt-1 text-sm text-ink/70">
          ณ วันที่ {asOf} · คำนวณจากสมุดบัญชี ไม่ใช่จากออเดอร์ · กำไรสุทธิสะสม {formatThb(income.netIncome)}
        </p>
      </div>
      <form className="flex flex-wrap gap-3" method="get">
        <label className="text-sm">
          <span className="block text-xs text-ink/55">ณ วันที่</span>
          <input type="date" name="asOf" defaultValue={asOf} className="mt-1 rounded border border-forest/20 px-3 py-2" />
        </label>
        <button type="submit" className="self-end rounded bg-forest px-4 py-2 text-sm text-paper">
          ดูงบดุล
        </button>
        <a
          href={`/ops/finance/export/balance-sheet?asOf=${asOf}`}
          className="self-end rounded border border-forest/30 px-4 py-2 text-sm text-forest"
        >
          ส่งออก CSV
        </a>
      </form>
      {sheet.balanced ? null : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          สินทรัพย์ {formatThb(sheet.assetTotal)} ยังไม่เท่าหนี้สิน+ส่วนของเจ้าของ {formatThb(sheet.liabilityAndEquity)}
          — ลงทุนจดทะเบียนด้วยใบสำคัญทั่วไปที่บัญชี 3100 หากเพิ่งเริ่มใช้สมุด
        </p>
      )}
      <section className="grid gap-8 lg:grid-cols-2">
        <LineTable title="สินทรัพย์" lines={sheet.assets} total={sheet.assetTotal} />
        <div className="space-y-8">
          <LineTable title="หนี้สิน" lines={sheet.liabilities} total={sheet.liabilityTotal} />
          <LineTable title="ส่วนของเจ้าของ" lines={sheet.equity} total={sheet.equityTotal} />
          <p className="text-sm font-semibold">
            หนี้สิน + ส่วนของเจ้าของ {formatThb(sheet.liabilityAndEquity)}
          </p>
        </div>
      </section>
    </div>
  );
}
