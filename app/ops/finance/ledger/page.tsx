import { FinanceSubnav } from "@/components/FinanceSubnav";
import { requireOpsPage } from "@/lib/ops-auth";
import { generalLedger, listLedgerAccounts } from "@/lib/ledger-repository";
import { defaultFinanceRange } from "@/lib/finance-report";
import { formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ from?: string; to?: string; account?: string }>;

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("finance.read");
  const sp = await searchParams;
  const fallback = defaultFinanceRange();
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from! : fallback.fromDate;
  const toDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to! : fallback.toDate;
  const accounts = listLedgerAccounts({ postableOnly: true });
  const accountCode = accounts.some((a) => a.code === sp.account)
    ? sp.account!
    : accounts[0]?.code || "1110";
  const ledger = generalLedger({ accountCode, fromDate, toDate });

  return (
    <div className="space-y-6">
      <FinanceSubnav current="/ops/finance/ledger" />
      <div>
        <h1 className="text-2xl font-bold text-forest">สมุดแยกประเภท</h1>
        <p className="mt-1 text-sm text-ink/70">
          เปิดดูทีละบัญชี พร้อมยอดยกมา รายการระหว่างงวด และยอดยกไป
        </p>
      </div>
      <form className="flex flex-wrap gap-3" method="get">
        <select
          name="account"
          defaultValue={accountCode}
          className="min-h-11 w-full min-w-0 rounded-xl border border-forest/20 px-3 py-2 text-sm sm:min-w-[240px] sm:w-auto"
        >
          {accounts.map((account) => (
            <option key={account.code} value={account.code}>
              {account.code} {account.nameTh}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={fromDate}
          className="rounded border border-forest/20 px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={toDate}
          className="rounded border border-forest/20 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-forest px-4 py-2 text-sm text-paper">
          เปิดบัญชี
        </button>
      </form>
      <p className="text-sm text-ink/70">
        {ledger.account?.code} {ledger.account?.nameTh} · ยอดยกมา {formatThb(ledger.opening)} ·
        ยอดยกไป {formatThb(ledger.closing)}
      </p>
      <div className="table-scroll">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-forest/15 text-left text-forest">
            <th className="py-2">วันที่</th>
            <th className="py-2">เอกสาร</th>
            <th className="py-2 text-right">เดบิต</th>
            <th className="py-2 text-right">เครดิต</th>
            <th className="py-2 text-right">คงเหลือ</th>
          </tr>
        </thead>
        <tbody>
          {ledger.moves.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-ink/60">
                ไม่มีรายการในงวดนี้
              </td>
            </tr>
          ) : (
            ledger.moves.map((move, index) => (
              <tr key={`${move.entryId}-${index}`} className="border-b border-forest/10">
                <td className="py-2 font-mono text-xs">{move.entryDate}</td>
                <td className="py-2">
                  <p className="font-mono text-xs text-ink/55">{move.entryId}</p>
                  <p>{move.memo}</p>
                </td>
                <td className="py-2 text-right">{move.debit ? formatThb(move.debit) : ""}</td>
                <td className="py-2 text-right">{move.credit ? formatThb(move.credit) : ""}</td>
                <td className="py-2 text-right font-medium">{formatThb(move.running)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
