import { FinanceSubnav } from "@/components/FinanceSubnav";
import { requireOpsPage } from "@/lib/ops-auth";
import { trialBalance } from "@/lib/ledger-repository";
import { LEDGER_ACCOUNT_TYPE_LABELS } from "@/lib/ledger-types";
import { defaultFinanceRange } from "@/lib/finance-report";
import { formatThb } from "@/lib/th-billing";
import { roundSatang } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ from?: string; to?: string }>;

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("finance.read");
  const sp = await searchParams;
  const fallback = defaultFinanceRange();
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from! : fallback.fromDate;
  const toDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to! : fallback.toDate;
  const rows = trialBalance({ fromDate, toDate }).filter(
    (row) => row.debit > 0.009 || row.credit > 0.009,
  );
  const debit = roundSatang(rows.reduce((sum, row) => sum + row.debit, 0));
  const credit = roundSatang(rows.reduce((sum, row) => sum + row.credit, 0));

  return (
    <div className="space-y-6">
      <FinanceSubnav current="/ops/finance/trial-balance" />
      <div>
        <h1 className="text-2xl font-bold text-forest">งบทดลอง</h1>
        <p className="mt-1 text-sm text-ink/70">
          ยอดเคลื่อนไหวตามงวด {fromDate} — {toDate} · เดบิตต้องเท่าเครดิต
        </p>
      </div>
      <form className="flex flex-wrap gap-3" method="get">
        <input type="date" name="from" defaultValue={fromDate} className="rounded border border-forest/20 px-3 py-2 text-sm" />
        <input type="date" name="to" defaultValue={toDate} className="rounded border border-forest/20 px-3 py-2 text-sm" />
        <button type="submit" className="rounded bg-forest px-4 py-2 text-sm text-paper">
          ดูงบทดลอง
        </button>
        <a
          href={`/ops/finance/export/trial-balance?from=${fromDate}&to=${toDate}`}
          className="rounded border border-forest/30 px-4 py-2 text-sm text-forest"
        >
          ส่งออก CSV
        </a>
      </form>
      <div className="table-scroll">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-forest/15 text-left text-forest">
            <th className="py-2">บัญชี</th>
            <th className="py-2">ประเภท</th>
            <th className="py-2 text-right">เดบิต</th>
            <th className="py-2 text-right">เครดิต</th>
            <th className="py-2 text-right">สุทธิเดบิต</th>
            <th className="py-2 text-right">สุทธิเครดิต</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.accountCode} className="border-b border-forest/10">
              <td className="py-2">
                <span className="font-mono text-xs">{row.accountCode}</span> {row.nameTh}
              </td>
              <td className="py-2">{LEDGER_ACCOUNT_TYPE_LABELS[row.type]}</td>
              <td className="py-2 text-right">{row.debit ? formatThb(row.debit) : ""}</td>
              <td className="py-2 text-right">{row.credit ? formatThb(row.credit) : ""}</td>
              <td className="py-2 text-right">{row.netDebit ? formatThb(row.netDebit) : ""}</td>
              <td className="py-2 text-right">{row.netCredit ? formatThb(row.netCredit) : ""}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-3" colSpan={2}>
              รวม
            </td>
            <td className="py-3 text-right">{formatThb(debit)}</td>
            <td className="py-3 text-right">{formatThb(credit)}</td>
            <td colSpan={2} className="py-3 text-right text-ink/60">
              {Math.abs(debit - credit) < 0.02 ? "สมดุล" : "ไม่สมดุล"}
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}
