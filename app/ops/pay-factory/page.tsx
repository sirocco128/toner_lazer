import Link from "next/link";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { payFactoryAction } from "@/app/actions/ops-cycle";
import { listPos } from "@/lib/factory-po-queries";
import { requireOpsPage } from "@/lib/ops-auth";
import {
  factoryPayableSnapshot,
  listSupplierPayments,
} from "@/lib/ops-cycle-service";
import { formatThaiDateTime, formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ ok?: string }>;

export default async function PayFactoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("finance.write");
  const sp = await searchParams;
  const pos = listPos({ status: "all" }).filter((po) => po.status !== "cancelled");
  const snaps = pos
    .map((po) => factoryPayableSnapshot(po.poId))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const defaultPo = snaps.find((s) => s.unpaidAmount > 0) ?? snaps[0];
  const payments = listSupplierPayments();

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/cycle" className="text-forest underline-offset-2 hover:underline">
          ← วงจรปฏิบัติการ
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">จ่ายเจ้าหนี้โรงงานและขนส่ง</h1>
      <p className="mt-1 text-sm text-ink/70">
        จ่ายเจ้าหนี้โรงงานได้ไม่เกินยอดสินค้าที่รับ — จ่ายขนส่ง/นำเข้าได้ตามยอดที่ตั้งค้างในสมุด
      </p>
      {sp.ok ? (
        <p className="mt-4 rounded-lg bg-forest/10 px-3 py-2 text-sm text-forest">
          บันทึกการจ่าย {sp.ok} แล้ว
        </p>
      ) : null}

      <div className="mt-6 rounded-xl border border-forest/15 bg-paper p-5">
        <OpsCycleForm action={payFactoryAction} submitLabel="บันทึกจ่ายโรงงาน">
          <label className="block text-sm">
            <span className="font-medium">ใบสั่งโรงงาน</span>
            <select
              name="poId"
              defaultValue={defaultPo?.poId || ""}
              className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono"
            >
              {snaps.map((s) => (
                <option key={s.poId} value={s.poId}>
                  {s.poId} · โรงงานค้าง {formatThb(s.unpaidAmount)} · ขนส่งค้าง {formatThb(s.unpaidFreight)} · รับแล้ว {s.receivedQty}/{s.orderedQty}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">จ่ายให้</span>
              <select name="payableKind" defaultValue="factory" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
                <option value="factory">เจ้าหนี้โรงงาน (2130)</option>
                <option value="freight">เจ้าหนี้ขนส่งและนำเข้า (2140)</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">ยอดจ่าย (บาท)</span>
              <input
                name="amount"
                type="number"
                min={0.01}
                step="0.01"
                required
                defaultValue={defaultPo?.unpaidAmount || ""}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">วิธีจ่าย</span>
              <input
                name="method"
                defaultValue="bank"
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium">ใบรับสินค้า (ถ้าจ่ายเฉพาะใบ)</span>
            <input name="receiptId" className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">หมายเหตุ</span>
            <input name="notes" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
        </OpsCycleForm>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-forest">ประวัติจ่ายโรงงาน</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2">เลขที่</th>
              <th className="px-2 py-2">PO</th>
              <th className="px-2 py-2">จ่ายให้</th>
              <th className="px-2 py-2 text-right">ยอด</th>
              <th className="px-2 py-2">เมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((row) => (
              <tr key={row.payId} className="border-b border-forest/10">
                <td className="px-2 py-2 font-mono text-xs">{row.payId}</td>
                <td className="px-2 py-2 font-mono text-xs">{row.poId}</td>
                <td className="px-2 py-2">{row.payableKind === "freight" ? "ขนส่ง/นำเข้า" : "โรงงาน"}</td>
                <td className="px-2 py-2 text-right">{formatThb(row.amount)}</td>
                <td className="px-2 py-2 text-ink/70">{formatThaiDateTime(row.paidAt)}</td>
              </tr>
            ))}
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-ink/55">
                  ยังไม่มีการจ่ายโรงงาน
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
