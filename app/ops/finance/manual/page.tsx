import { FinanceSubnav } from "@/components/FinanceSubnav";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { postManualJournalAction } from "@/app/actions/ops-finance";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listLedgerAccounts } from "@/lib/ledger-repository";
import { defaultFinanceRange } from "@/lib/finance-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManualJournalPage() {
  const actor = await requireOpsPage("finance.read");
  const canWrite = actorMay(actor, "finance.write");
  const accounts = listLedgerAccounts({ postableOnly: true });
  const today = defaultFinanceRange().toDate;

  return (
    <div className="space-y-6">
      <FinanceSubnav current="/ops/finance/manual" />
      <div>
        <h1 className="text-2xl font-bold text-forest">ใบสำคัญทั่วไป</h1>
        <p className="mt-1 text-sm text-ink/70">
          สำหรับผู้ทำบัญชี — ยอดยกมา ทุนจดทะเบียน ภาษีซื้อ กำไร/ขาดทุนอัตราแลกเปลี่ยน และรายการปรับปรุง
        </p>
      </div>
      {canWrite ? (
        <div className="rounded-xl border border-forest/15 bg-paper p-5">
          <OpsCycleForm action={postManualJournalAction} submitLabel="ลงบัญชี">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="block text-xs text-ink/55">วันที่</span>
                <input
                  type="date"
                  name="entryDate"
                  required
                  defaultValue={today}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-1">
                <span className="block text-xs text-ink/55">คำอธิบาย</span>
                <input
                  name="memo"
                  required
                  placeholder="เช่น ลงทุนจดทะเบียน / ยอดยกมา"
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-forest">
                    <th className="py-2">บัญชี</th>
                    <th className="py-2">เดบิต</th>
                    <th className="py-2">เครดิต</th>
                    <th className="py-2">หมายเหตุบรรทัด</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }, (_, index) => (
                    <tr key={index}>
                      <td className="py-1 pr-2">
                        <select
                          name={`account_${index}`}
                          className="w-full rounded border border-forest/20 px-2 py-1.5"
                          defaultValue=""
                        >
                          <option value="">—</option>
                          {accounts.map((account) => (
                            <option key={account.code} value={account.code}>
                              {account.code} {account.nameTh}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          name={`debit_${index}`}
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full rounded border border-forest/20 px-2 py-1.5 text-right"
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input
                          name={`credit_${index}`}
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full rounded border border-forest/20 px-2 py-1.5 text-right"
                        />
                      </td>
                      <td className="py-1">
                        <input
                          name={`line_memo_${index}`}
                          className="w-full rounded border border-forest/20 px-2 py-1.5"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </OpsCycleForm>
        </div>
      ) : (
        <p className="text-sm text-ink/60">ดูได้อย่างเดียว — ให้ผู้ทำบัญชีหรือผู้ดูแลลงรายการ</p>
      )}
    </div>
  );
}
