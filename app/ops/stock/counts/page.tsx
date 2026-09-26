import Link from "next/link";
import { WmsGuardedForm } from "@/components/WmsGuardedForm";
import { WmsNav } from "@/components/WmsNav";
import { WmsSkuKeyField } from "@/components/WmsSkuKeyField";
import { cycleCountAction } from "@/app/actions/ops-stock";
import { requireOpsPage } from "@/lib/ops-auth";
import { getWmsSkuKeyOptions } from "@/lib/wms-sku-options";
import { listBalances, listCycleCounts, listLocations } from "@/lib/wms-repository";
import { wmsDeltaClass, formatWmsDelta } from "@/lib/wms-labels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ ok?: string; productKey?: string }>;

export default async function StockCountsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("stock.write");
  const sp = await searchParams;
  const locations = listLocations();
  const rows = listCycleCounts(40);
  const skuOptions = await getWmsSkuKeyOptions();
  const defaultKey = (sp.productKey || "").trim().toUpperCase();
  const balanceHints = listBalances({ limit: 500 }).map((b) => ({
    productKey: b.productKey,
    locationCode: b.locationCode || "BIN-DEFAULT",
    qtyOnHand: b.qtyOnHand,
  }));

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/stock" className="text-forest underline-offset-2 hover:underline">
          ← คลังสินค้า
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">ตรวจนับสต็อก</h1>
      <p className="mt-1 text-sm text-ink/70">
        นับจริงแล้วระบบจะปรับยอดตามส่วนต่างอัตโนมัติ — ส่วนต่างใหญ่จะมีหน้าต่างยืนยัน
      </p>
      <WmsNav pathname="/ops/stock/counts" />
      {sp.ok ? (
        <p className="mt-4 rounded-lg bg-forest/10 px-3 py-2 text-sm text-forest">
          บันทึกการนับ {sp.ok} แล้ว
        </p>
      ) : null}

      <div className="mt-6 rounded-xl border border-forest/15 bg-paper p-5">
        <WmsGuardedForm
          action={cycleCountAction}
          submitLabel="บันทึกการนับ"
          mode="cycle"
          balanceHints={balanceHints}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <WmsSkuKeyField options={skuOptions} defaultValue={defaultKey} />
            <label className="block text-sm">
              <span className="font-medium">ที่เก็บ</span>
              <select
                name="locationCode"
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              >
                {locations.map((loc) => (
                  <option key={loc.locationCode} value={loc.locationCode}>
                    {loc.locationCode} · {loc.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">จำนวนที่นับได้</span>
              <input
                name="qtyCounted"
                type="number"
                min={0}
                required
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">หมายเหตุ</span>
              <input
                name="memo"
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
          </div>
        </WmsGuardedForm>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-forest">ประวัติการนับ</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2">ใบนับ</th>
              <th className="px-2 py-2">SKU</th>
              <th className="px-2 py-2 text-right">ระบบ</th>
              <th className="px-2 py-2 text-right">นับได้</th>
              <th className="px-2 py-2 text-right">ส่วนต่าง</th>
              <th className="px-2 py-2">เมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.countId} className="border-b border-forest/10">
                <td className="px-2 py-2 font-mono text-xs">{row.countId}</td>
                <td className="px-2 py-2 font-mono text-xs">
                  <Link
                    href={`/ops/stock/${encodeURIComponent(row.productKey)}`}
                    className="text-forest underline-offset-2 hover:underline"
                  >
                    {row.productKey}
                  </Link>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {row.qtySystem}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {row.qtyCounted}
                </td>
                <td
                  className={`px-2 py-2 text-right tabular-nums ${wmsDeltaClass(row.qtyVariance)}`}
                >
                  {formatWmsDelta(row.qtyVariance)}
                </td>
                <td className="px-2 py-2 text-xs text-ink/70">
                  {row.createdAt.slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-ink/55">
                  ยังไม่มีการตรวจนับ
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
