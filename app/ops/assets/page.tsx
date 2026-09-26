import Link from "next/link";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { createAssetAction } from "@/app/actions/ops-cycle";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listAssets } from "@/lib/ops-cycle-service";
import { formatThaiDateTime, formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ ok?: string }>;

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOpsPage("finance.read");
  const canWrite = actorMay(actor, "finance.write");
  const sp = await searchParams;
  const rows = listAssets(80);

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/cycle" className="text-forest underline-offset-2 hover:underline">
          ← วงจรปฏิบัติการ
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">ทะเบียนทรัพย์</h1>
      <p className="mt-1 text-sm text-ink/70">
        ล็อตสินค้าจากใบรับเข้าคลัง และทรัพย์สินสำนักงาน
      </p>
      {sp.ok ? (
        <p className="mt-4 rounded-lg bg-forest/10 px-3 py-2 text-sm text-forest">
          ลงทะเบียน {sp.ok} แล้ว
        </p>
      ) : null}

      {canWrite ? (
        <div className="mt-6 rounded-xl border border-forest/15 bg-paper p-5">
          <h2 className="font-semibold text-forest">เพิ่มทรัพย์สินสำนักงาน</h2>
          <div className="mt-4">
            <OpsCycleForm action={createAssetAction} submitLabel="บันทึกทรัพย์สิน">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium">ชื่อ</span>
                  <input name="name" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">จำนวน</span>
                  <input
                    name="qty"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={1}
                    className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">หน่วย</span>
                  <input name="unit" defaultValue="ชิ้น" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">มูลค่า (บาท)</span>
                  <input
                    name="valueThb"
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">ที่เก็บ</span>
                  <input name="location" defaultValue="office" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
                </label>
              </div>
              <label className="block text-sm">
                <span className="font-medium">หมายเหตุ</span>
                <input name="notes" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
              </label>
            </OpsCycleForm>
          </div>
        </div>
      ) : null}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2">รหัส</th>
              <th className="px-2 py-2">ชื่อ</th>
              <th className="px-2 py-2">ชนิด</th>
              <th className="px-2 py-2 text-right">จำนวน</th>
              <th className="px-2 py-2 text-right">มูลค่า</th>
              <th className="px-2 py-2">เมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.assetCode} className="border-b border-forest/10">
                <td className="px-2 py-2 font-mono text-xs">{row.assetCode}</td>
                <td className="px-2 py-2">{row.name}</td>
                <td className="px-2 py-2">
                  {row.kind === "inventory_lot" ? "ล็อตสินค้า" : "ทรัพย์สิน"}
                </td>
                <td className="px-2 py-2 text-right">
                  {row.qty} {row.unit}
                </td>
                <td className="px-2 py-2 text-right">{formatThb(row.valueThb)}</td>
                <td className="px-2 py-2 text-ink/70">{formatThaiDateTime(row.createdAt)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-ink/55">
                  ยังไม่มีรายการในทะเบียน
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
