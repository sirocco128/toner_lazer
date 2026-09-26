import Link from "next/link";
import { notFound } from "next/navigation";
import { WmsNav } from "@/components/WmsNav";
import { requireOpsPage } from "@/lib/ops-auth";
import {
  formatWmsDelta,
  wmsDeltaClass,
  wmsMovementLabel,
} from "@/lib/wms-labels";
import {
  listBalances,
  listMovements,
  listOpenReservationsForProduct,
  sumAvailable,
  sumOnHand,
} from "@/lib/wms-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ productKey: string }>;

export default async function StockSkuDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireOpsPage("stock.read");
  const { productKey: raw } = await params;
  const productKey = decodeURIComponent(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!productKey) notFound();

  const balances = listBalances({ productKey, limit: 50 });
  const movements = listMovements({ productKey, limit: 80 });
  const reservations = listOpenReservationsForProduct(productKey);
  if (balances.length === 0 && movements.length === 0) notFound();

  const onHand = sumOnHand(productKey);
  const available = sumAvailable(productKey);

  return (
    <div>
      <p className="text-sm">
        <Link
          href="/ops/stock"
          className="text-forest underline-offset-2 hover:underline"
        >
          ← คลังสินค้า
        </Link>
      </p>
      <h1 className="mt-3 font-mono text-2xl font-bold text-forest">
        {productKey}
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        บนมือ {onHand.toLocaleString("th-TH")} · พร้อมขาย{" "}
        {available.toLocaleString("th-TH")} · จองค้าง {reservations.length}{" "}
        รายการ
      </p>
      <WmsNav pathname={`/ops/stock/${productKey}`} />

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link
          href={`/ops/stock/${encodeURIComponent(productKey)}/card`}
          className="rounded-lg bg-forest px-3 py-2 text-paper"
        >
          บัตรคุมสินค้า (พิมพ์)
        </Link>
        <Link
          href={`/ops/stock/adjust?productKey=${encodeURIComponent(productKey)}`}
          className="rounded-lg border border-forest/25 px-3 py-2 text-forest"
        >
          ปรับ / โอน
        </Link>
        <Link
          href={`/ops/stock/counts?productKey=${encodeURIComponent(productKey)}`}
          className="rounded-lg border border-forest/25 px-3 py-2 text-forest"
        >
          ตรวจนับ
        </Link>
        <Link
          href={`/ops/stock/movements?q=${encodeURIComponent(productKey)}`}
          className="rounded-lg border border-forest/25 px-3 py-2 text-forest"
        >
          เคลื่อนไหวทั้งหมด
        </Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-forest">ยอดตามที่เก็บ</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2">ที่เก็บ</th>
              <th className="px-2 py-2 text-right">บนมือ</th>
              <th className="px-2 py-2 text-right">จอง</th>
              <th className="px-2 py-2 text-right">พร้อมขาย</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((row) => (
              <tr
                key={row.locationId}
                className="border-b border-forest/10"
              >
                <td className="px-2 py-2">
                  {row.locationCode}
                  {row.locationName ? ` · ${row.locationName}` : ""}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {row.qtyOnHand}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {row.qtyReserved}
                </td>
                <td className="px-2 py-2 text-right font-medium tabular-nums text-forest">
                  {row.qtyAvailable}
                </td>
              </tr>
            ))}
            {balances.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-6 text-ink/55">
                  ไม่มียอดคงเหลือ
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-forest">
        ออเดอร์ที่จองค้าง
      </h2>
      <ul className="mt-3 divide-y divide-forest/10 border-t border-forest/10 text-sm">
        {reservations.map((r) => (
          <li
            key={r.reservationId}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <Link
              href={`/ops/orders/${encodeURIComponent(r.orderId)}`}
              className="font-mono text-forest underline-offset-2 hover:underline"
            >
              {r.orderId}
            </Link>
            <span className="tabular-nums">
              {r.qty} ชิ้น · {r.reservationId}
            </span>
          </li>
        ))}
        {reservations.length === 0 ? (
          <li className="py-4 text-ink/55">ไม่มีการจองค้าง</li>
        ) : null}
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-forest">
        ประวัติเคลื่อนไหวล่าสุด
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2">เมื่อ</th>
              <th className="px-2 py-2">ชนิด</th>
              <th className="px-2 py-2 text-right">Δ บนมือ</th>
              <th className="px-2 py-2 text-right">Δ จอง</th>
              <th className="px-2 py-2">อ้างอิง</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((row) => (
              <tr key={row.movementKey} className="border-b border-forest/10">
                <td className="px-2 py-2 text-xs text-ink/70">
                  {row.createdAt.slice(0, 19).replace("T", " ")}
                </td>
                <td className="px-2 py-2">{wmsMovementLabel(row.kind)}</td>
                <td
                  className={`px-2 py-2 text-right tabular-nums ${wmsDeltaClass(row.qtyDelta)}`}
                >
                  {formatWmsDelta(row.qtyDelta)}
                </td>
                <td
                  className={`px-2 py-2 text-right tabular-nums ${wmsDeltaClass(row.qtyReservedDelta)}`}
                >
                  {formatWmsDelta(row.qtyReservedDelta)}
                </td>
                <td className="px-2 py-2 text-xs text-ink/70">
                  {[row.orderId, row.receiptId, row.memo]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
