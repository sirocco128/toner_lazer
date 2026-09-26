import Link from "next/link";
import { FinanceSubnav } from "@/components/FinanceSubnav";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { upsertAccountAction } from "@/app/actions/ops-finance";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listLedgerAccounts } from "@/lib/ledger-repository";
import { LEDGER_ACCOUNT_TYPE_LABELS, LEDGER_ACCOUNT_TYPES } from "@/lib/ledger-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ChartOfAccountsPage() {
  const actor = await requireOpsPage("finance.read");
  const canWrite = actorMay(actor, "finance.write");
  const accounts = listLedgerAccounts();

  return (
    <div className="space-y-8">
      <FinanceSubnav current="/ops/finance/coa" />
      <div>
        <h1 className="text-2xl font-bold text-forest">ผังบัญชี</h1>
        <p className="mt-1 text-sm text-ink/70">
          ผังสำหรับกิจการสั่งผลิตของขวัญจากจีน นำเข้าแล้วขายในไทย — ลงรายการได้เฉพาะบัญชีที่ไม่ใช่หัวข้อ
        </p>
      </div>

      {canWrite ? (
        <div className="rounded-xl border border-forest/15 bg-paper p-5">
          <h2 className="font-semibold text-forest">เพิ่มหรือแก้บัญชีลงรายการได้</h2>
          <div className="mt-4">
            <OpsCycleForm action={upsertAccountAction} submitLabel="บันทึกบัญชี">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm">
                  <span className="block text-xs text-ink/55">รหัส 4 หลัก</span>
                  <input
                    name="code"
                    required
                    pattern="\d{4}"
                    className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="block text-xs text-ink/55">ชื่อบัญชี</span>
                  <input
                    name="nameTh"
                    required
                    className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-xs text-ink/55">ประเภท</span>
                  <select name="type" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
                    {LEDGER_ACCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {LEDGER_ACCOUNT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <input type="hidden" name="nameEn" value="" />
            </OpsCycleForm>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2">รหัส</th>
              <th className="px-2 py-2">ชื่อ</th>
              <th className="px-2 py-2">ประเภท</th>
              <th className="px-2 py-2">ยอดปกติ</th>
              <th className="px-2 py-2">ลงรายการ</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((row) => (
              <tr
                key={row.code}
                className={`border-b border-forest/10 ${row.isHeader ? "bg-forest/5 font-medium" : ""}`}
              >
                <td className="px-2 py-2 font-mono text-xs">{row.code}</td>
                <td className="px-2 py-2">
                  {row.isPostable ? (
                    <Link
                      href={`/ops/finance/ledger?account=${row.code}`}
                      className="text-forest underline-offset-2 hover:underline"
                    >
                      {row.nameTh}
                    </Link>
                  ) : (
                    row.nameTh
                  )}
                </td>
                <td className="px-2 py-2">{LEDGER_ACCOUNT_TYPE_LABELS[row.type]}</td>
                <td className="px-2 py-2">{row.normalBalance === "credit" ? "เครดิต" : "เดบิต"}</td>
                <td className="px-2 py-2">{row.isPostable ? "ได้" : "หัวข้อ"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
