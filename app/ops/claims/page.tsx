import Link from "next/link";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { createClaimAction, setClaimStatusAction } from "@/app/actions/ops-cycle";
import { requireOpsPage } from "@/lib/ops-auth";
import { listClaims } from "@/lib/ops-cycle-service";
import {
  CLAIM_AGAINST,
  CLAIM_AGAINST_LABELS,
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
} from "@/lib/ops-cycle-types";
import { formatThaiDateTime, formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ ok?: string }>;

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("factory.write");
  const sp = await searchParams;
  const rows = listClaims(80);

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/cycle" className="text-forest underline-offset-2 hover:underline">
          ← วงจรปฏิบัติการ
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">เคลมสินค้า</h1>
      <p className="mt-1 text-sm text-ink/70">
        เปิดเคลมโรงงาน ลูกค้า หรือขนส่ง จากของเสีย ของขาด หรือโลโก้ไม่ผ่าน
      </p>
      {sp.ok ? (
        <p className="mt-4 rounded-lg bg-forest/10 px-3 py-2 text-sm text-forest">
          บันทึก {sp.ok} แล้ว
        </p>
      ) : null}

      <div className="mt-6 rounded-xl border border-forest/15 bg-paper p-5">
        <OpsCycleForm action={createClaimAction} submitLabel="เปิดใบเคลม">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">คู่กรณี</span>
              <select name="against" defaultValue="factory" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
                {CLAIM_AGAINST.map((a) => (
                  <option key={a} value={a}>
                    {CLAIM_AGAINST_LABELS[a]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">จำนวนชิ้น</span>
              <input name="qty" type="number" min={0} defaultValue={0} className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">ยอดเคลม (บาท)</span>
              <input name="amountThb" type="number" min={0} step="0.01" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">ใบสั่งโรงงาน</span>
              <input name="poId" className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">ออเดอร์ลูกค้า</span>
              <input name="orderId" className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">ใบรับ / เลขเรื่อง</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input name="receiptId" placeholder="GR-…" className="rounded border border-forest/20 px-3 py-2 font-mono text-sm" />
                <input name="issueId" placeholder="ISS-…" className="rounded border border-forest/20 px-3 py-2 font-mono text-sm" />
              </div>
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium">เหตุผล</span>
            <textarea name="reason" required rows={3} className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
        </OpsCycleForm>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2">เลขเคลม</th>
              <th className="px-2 py-2">คู่กรณี</th>
              <th className="px-2 py-2">เหตุผล</th>
              <th className="px-2 py-2 text-right">ยอด</th>
              <th className="px-2 py-2">สถานะ</th>
              <th className="px-2 py-2">เมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.claimId} className="border-b border-forest/10 align-top">
                <td className="px-2 py-2 font-mono text-xs">{row.claimId}</td>
                <td className="px-2 py-2">{CLAIM_AGAINST_LABELS[row.against]}</td>
                <td className="px-2 py-2">{row.reason}</td>
                <td className="px-2 py-2 text-right">{formatThb(row.amountThb)}</td>
                <td className="px-2 py-2">
                  <form action={setClaimStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="claimId" value={row.claimId} />
                    <select
                      name="status"
                      defaultValue={row.status}
                      className="rounded border border-forest/20 px-2 py-1 text-xs"
                    >
                      {CLAIM_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {CLAIM_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="text-xs text-forest underline-offset-2 hover:underline">
                      บันทึก
                    </button>
                  </form>
                </td>
                <td className="px-2 py-2 text-ink/70">{formatThaiDateTime(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
