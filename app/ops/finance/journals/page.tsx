import Link from "next/link";
import { FinanceSubnav } from "@/components/FinanceSubnav";
import { requireOpsPage } from "@/lib/ops-auth";
import { listJournals, listLedgerAccounts } from "@/lib/ledger-repository";
import {
  JOURNAL_BOOK_LABELS,
  JOURNAL_BOOKS,
  isJournalBookType,
} from "@/lib/ledger-types";
import { defaultFinanceRange } from "@/lib/finance-report";
import { formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ from?: string; to?: string; book?: string; ok?: string }>;

export default async function JournalsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("finance.read");
  const sp = await searchParams;
  const fallback = defaultFinanceRange();
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from! : fallback.fromDate;
  const toDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to! : fallback.toDate;
  const bookType = isJournalBookType(sp.book) ? sp.book : undefined;
  const entries = listJournals({ fromDate, toDate, bookType, limit: 200 });
  const names = new Map(listLedgerAccounts().map((a) => [a.code, a.nameTh]));
  const exportQs = new URLSearchParams({ from: fromDate, to: toDate });
  if (bookType) exportQs.set("book", bookType);

  return (
    <div className="space-y-6">
      <FinanceSubnav current="/ops/finance/journals" />
      <div>
        <h1 className="text-2xl font-bold text-forest">สมุดรายวัน</h1>
        <p className="mt-1 text-sm text-ink/70">
          แยกเล่มขาย ซื้อ รับเงิน จ่ายเงิน และทั่วไป — ส่งออก CSV ไป FlowAccount / PEAK ได้
        </p>
      </div>
      {sp.ok ? (
        <p className="rounded-lg bg-forest/10 px-3 py-2 text-sm text-forest">
          ลงใบสำคัญ {sp.ok} แล้ว
        </p>
      ) : null}

      <form className="flex flex-wrap gap-3" method="get">
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
        <select
          name="book"
          defaultValue={bookType || ""}
          className="rounded border border-forest/20 px-3 py-2 text-sm"
        >
          <option value="">ทุกสมุด</option>
          {JOURNAL_BOOKS.map((book) => (
            <option key={book} value={book}>
              {JOURNAL_BOOK_LABELS[book]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-forest px-4 py-2 text-sm text-paper">
          กรอง
        </button>
        <a
          href={`/ops/finance/export/journals?${exportQs.toString()}`}
          className="rounded border border-forest/30 px-4 py-2 text-sm text-forest"
        >
          ส่งออก CSV
        </a>
        <Link href="/ops/finance/manual" className="px-2 py-2 text-sm text-forest underline-offset-2 hover:underline">
          ใบสำคัญทั่วไป
        </Link>
      </form>

      <div className="space-y-5">
        {entries.length === 0 ? (
          <p className="text-sm text-ink/60">ยังไม่มีรายการในงวดนี้</p>
        ) : (
          entries.map((entry) => (
            <article key={entry.entryId} className="rounded-xl border border-forest/10 bg-paper p-4">
              <p className="font-mono text-xs text-ink/55">
                {JOURNAL_BOOK_LABELS[entry.bookType]} · {entry.entryDate} · {entry.entryId}
                {entry.orderId ? ` · ${entry.orderId}` : ""}
                {entry.poId ? ` · ${entry.poId}` : ""}
              </p>
              <p className="mt-1 font-medium">{entry.memo}</p>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {entry.lines.map((line) => (
                    <tr key={`${entry.entryId}-${line.lineNo}`} className="border-t border-forest/10">
                      <td className="py-1.5">
                        <span className="font-mono text-xs">{line.accountCode}</span>{" "}
                        {names.get(line.accountCode) || ""}
                      </td>
                      <td className="py-1.5 text-right">
                        {line.debit ? formatThb(line.debit) : ""}
                      </td>
                      <td className="py-1.5 text-right">
                        {line.credit ? formatThb(line.credit) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
