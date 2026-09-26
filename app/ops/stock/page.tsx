import Link from "next/link";
import { WmsNav } from "@/components/WmsNav";
import { requireOpsPage } from "@/lib/ops-auth";
import { FULFILLMENT_LABELS } from "@/lib/order-types";
import { locationDisplay, locationLabelTh } from "@/lib/wms-location-labels";
import {
  listInTransitPos,
  listReadyPackRows,
  listXdockBalances,
} from "@/lib/wms-ops-queues";
import {
  listBalances,
  listQcBalances,
  stockDashboard,
} from "@/lib/wms-repository";
import { XDOCK_LOCATION_CODE } from "@/lib/wms-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{
  q?: string;
  location?: string;
  sort?: string;
  low?: string;
  qc?: string;
  xdock?: string;
  view?: string;
}>;

export default async function StockPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("stock.read");
  const sp = await searchParams;
  const view = (sp.view || "work").trim() === "balances" ? "balances" : "work";
  const q = (sp.q || "").trim().toUpperCase();
  const location = (sp.location || "all").trim();
  const sort = (sp.sort || "available").trim();
  const lowOnly = sp.low === "1";
  const qcOnly = sp.qc === "1";
  const xdockOnly = sp.xdock === "1";

  const dash = stockDashboard();
  let balances = listBalances({ limit: 500 });

  if (q) {
    balances = balances.filter((b) => b.productKey.includes(q));
  }
  if (location !== "all") {
    balances = balances.filter((b) => b.locationCode === location);
  }
  if (qcOnly) {
    balances = balances.filter((b) => b.locationCode === "BIN-QC");
  }
  if (xdockOnly) {
    balances = balances.filter((b) => b.locationCode === XDOCK_LOCATION_CODE);
  }
  if (lowOnly) {
    balances = balances.filter(
      (b) => b.qtyAvailable > 0 && b.qtyAvailable <= 5,
    );
  }

  if (sort === "sku") {
    balances = [...balances].sort((a, b) =>
      a.productKey.localeCompare(b.productKey),
    );
  } else if (sort === "updated") {
    balances = [...balances].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  } else {
    balances = [...balances].sort((a, b) => a.qtyAvailable - b.qtyAvailable);
  }

  const inTransit = listInTransitPos();
  const xdockRows = listXdockBalances(20);
  const readyPack = listReadyPackRows(12);
  const qcRows = listQcBalances(20);
  const xdockUnits = xdockRows.reduce((sum, row) => sum + row.qtyOnHand, 0);

  const locations = [
    ...new Set(
      listBalances({ limit: 500 })
        .map((b) => b.locationCode)
        .filter(Boolean) as string[],
    ),
  ].sort();

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">คลังสินค้า</h1>
      <p className="mt-1 text-sm text-ink/70">
        งานวันนี้: ระหว่างทาง → รับเข้า → จุดแพ็ก → พร้อมส่ง
      </p>
      <WmsNav pathname="/ops/stock" />

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/ops/stock"
          className={
            view === "work"
              ? "rounded-lg bg-forest px-3 py-2 font-medium text-paper"
              : "rounded-lg border border-forest/25 bg-paper px-3 py-2 text-forest hover:border-forest/50"
          }
        >
          คิวงาน
        </Link>
        <Link
          href="/ops/stock?view=balances"
          className={
            view === "balances"
              ? "rounded-lg bg-forest px-3 py-2 font-medium text-paper"
              : "rounded-lg border border-forest/25 bg-paper px-3 py-2 text-forest hover:border-forest/50"
          }
        >
          ตารางคงเหลือ
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "ระหว่างทาง",
            value: inTransit.length,
            href: "/ops/inbound",
            hint: "รอรับเข้า",
          },
          {
            label: "จุดแพ็ก",
            value: xdockUnits,
            href: "/ops/stock?view=balances&xdock=1",
            hint: locationLabelTh(XDOCK_LOCATION_CODE),
          },
          {
            label: "พร้อมส่ง",
            value: readyPack.length,
            href: "/ops/stock#ready-pack",
            hint: "ชำระครบ + จองค้าง",
          },
          {
            label: "ใน QC",
            value: dash.qcUnits,
            href: "/ops/stock?view=balances&qc=1",
            hint: "กักกัน",
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-forest/15 bg-paper px-4 py-3 hover:border-forest/40"
          >
            <p className="text-xs text-ink/60">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-forest">
              {card.value.toLocaleString("th-TH")}
            </p>
            <p className="mt-0.5 text-xs text-ink/50">{card.hint}</p>
          </Link>
        ))}
      </div>

      {view === "work" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-forest/15 bg-paper p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-forest">
                1. ระหว่างทาง
              </h2>
              <Link
                href="/ops/inbound"
                className="text-xs text-forest underline-offset-2 hover:underline"
              >
                ไปรับเข้า
              </Link>
            </div>
            <ul className="mt-2 space-y-2 text-sm">
              {inTransit.slice(0, 8).map((po) => (
                <li key={po.poId}>
                  <Link
                    href={`/ops/inbound?poId=${encodeURIComponent(po.poId)}`}
                    className="font-mono text-xs text-forest underline-offset-2 hover:underline"
                  >
                    {po.poId}
                  </Link>
                  <span className="text-ink/60">
                    {" "}
                    · ค้าง {Math.max(0, po.quantity - po.receivedQty)}
                    {po.asnEta ? ` · ETA ${po.asnEta.slice(0, 10)}` : ""}
                    {po.asnContainer ? ` · ${po.asnContainer}` : ""}
                  </span>
                </li>
              ))}
              {inTransit.length === 0 ? (
                <li className="text-ink/55">
                  ยังไม่มีของระหว่างทาง — เมื่อใบสั่งโรงงานเป็น shipped /
                  inbound จะโผล่ที่นี่
                </li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-amber-950">
                2. จุดแพ็ก
              </h2>
              <span className="font-mono text-[10px] text-ink/45">
                {XDOCK_LOCATION_CODE}
              </span>
            </div>
            <ul className="mt-2 space-y-2 text-sm">
              {xdockRows.slice(0, 8).map((row) => (
                <li key={`${row.productKey}-${row.locationId}`}>
                  <Link
                    href={`/ops/stock/${encodeURIComponent(row.productKey)}`}
                    className="font-mono text-xs text-forest underline-offset-2 hover:underline"
                  >
                    {row.productKey}
                  </Link>
                  <span className="tabular-nums text-ink/70">
                    {" "}
                    · {row.qtyOnHand} ชิ้น · จอง {row.qtyReserved}
                  </span>
                </li>
              ))}
              {xdockRows.length === 0 ? (
                <li className="text-ink/55">
                  ว่าง — รับเข้าแบบจุดแพ็กแล้วของจะโผล่ที่นี่ ก่อนไปแพ็กส่ง
                </li>
              ) : null}
            </ul>
          </section>

          <section
            id="ready-pack"
            className="rounded-xl border border-forest/15 bg-paper p-4 lg:col-span-2"
          >
            <h2 className="text-sm font-semibold text-forest">
              3. พร้อมส่ง (พิมพ์ใบปะหน้า → ยืนยันส่ง)
            </h2>
            <ul className="mt-2 space-y-3 text-sm">
              {readyPack.map((row) => (
                <li
                  key={row.reservationId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-forest/10 pb-2 last:border-0"
                >
                  <Link
                    href={`/ops/orders/${encodeURIComponent(row.order.orderId)}`}
                    className="font-mono text-xs font-medium text-forest underline-offset-2 hover:underline"
                  >
                    {row.order.orderId}
                  </Link>
                  <span className="text-ink/60">
                    {row.productKey} × {row.qtyReserved}
                    {row.locationCode === XDOCK_LOCATION_CODE
                      ? " · จุดแพ็ก"
                      : ` · ${locationLabelTh(row.locationCode)}`}
                    {" · "}
                    {FULFILLMENT_LABELS[row.order.fulfillmentStatus]}
                  </span>
                  <Link
                    href={`/ops/orders/${encodeURIComponent(row.order.orderId)}/pack`}
                    className="rounded bg-forest px-2.5 py-1 text-xs font-medium text-paper"
                  >
                    ใบปะหน้า
                  </Link>
                  <Link
                    href={`/ops/orders/${encodeURIComponent(row.order.orderId)}`}
                    className="text-xs text-amber-800 underline-offset-2 hover:underline"
                  >
                    ยืนยันส่ง
                  </Link>
                </li>
              ))}
              {readyPack.length === 0 ? (
                <li className="text-ink/55">
                  ยังไม่มีคิวพร้อมส่ง — รับของเข้าจุดแพ็กและให้ลูกค้าชำระครบก่อน
                </li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-xl border border-forest/15 bg-paper p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-forest">กักกัน QC</h2>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {qcRows.slice(0, 8).map((row) => (
                <li key={`${row.productKey}-${row.locationId}`}>
                  <Link
                    href={`/ops/stock/${encodeURIComponent(row.productKey)}`}
                    className="font-mono text-xs text-forest underline-offset-2 hover:underline"
                  >
                    {row.productKey}
                  </Link>
                  <span className="tabular-nums text-ink/70">
                    {" "}
                    · {row.qtyOnHand}
                  </span>
                </li>
              ))}
              {qcRows.length === 0 ? (
                <li className="text-ink/55">
                  ไม่มีของใน QC — ของเสียตอนรับจะถูกย้ายมากักกันอัตโนมัติ
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      ) : (
        <>
          <form
            method="get"
            className="mt-6 grid gap-3 rounded-xl border border-forest/15 bg-paper p-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            <input type="hidden" name="view" value="balances" />
            <label className="block text-sm lg:col-span-2">
              <span className="font-medium">ค้นหา SKU</span>
              <input
                name="q"
                defaultValue={sp.q || ""}
                placeholder="B00001"
                className="mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">ที่เก็บ</span>
              <select
                name="location"
                defaultValue={location}
                className="mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
              >
                <option value="all">ทั้งหมด</option>
                {locations.map((code) => (
                  <option key={code} value={code}>
                    {locationDisplay(code)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">เรียง</span>
              <select
                name="sort"
                defaultValue={sort}
                className="mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
              >
                <option value="available">พร้อมขายน้อย→มาก</option>
                <option value="sku">รหัส SKU</option>
                <option value="updated">อัปเดตล่าสุด</option>
              </select>
            </label>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  name="low"
                  value="1"
                  defaultChecked={lowOnly}
                />
                สต็อกต่ำ (≤5)
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  name="qc"
                  value="1"
                  defaultChecked={qcOnly}
                />
                เฉพาะ QC
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  name="xdock"
                  value="1"
                  defaultChecked={xdockOnly}
                />
                เฉพาะจุดแพ็ก
              </label>
              <button
                type="submit"
                className="min-h-11 rounded-lg bg-forest px-3 py-2 text-paper"
              >
                กรอง
              </button>
            </div>
          </form>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-forest/15 text-forest">
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">ที่เก็บ</th>
                  <th className="px-2 py-2 text-right">บนมือ</th>
                  <th className="px-2 py-2 text-right">จอง</th>
                  <th className="px-2 py-2 text-right">พร้อมขาย</th>
                  <th className="px-2 py-2">อัปเดต</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((row) => {
                  const low = row.qtyAvailable > 0 && row.qtyAvailable <= 5;
                  const reservedFull =
                    row.qtyOnHand > 0 && row.qtyReserved >= row.qtyOnHand;
                  const isXdock = row.locationCode === XDOCK_LOCATION_CODE;
                  return (
                    <tr
                      key={`${row.productKey}-${row.locationId}`}
                      className={
                        isXdock
                          ? "border-b border-forest/10 bg-amber-50/70"
                          : reservedFull
                            ? "border-b border-forest/10 bg-amber-50/60"
                            : low
                              ? "border-b border-forest/10 bg-amber-50/30"
                              : "border-b border-forest/10"
                      }
                    >
                      <td className="px-2 py-2 font-mono text-xs">
                        <Link
                          href={`/ops/stock/${encodeURIComponent(row.productKey)}`}
                          className="text-forest underline-offset-2 hover:underline"
                        >
                          {row.productKey}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        {locationDisplay(row.locationCode, row.locationName)}
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
                      <td className="px-2 py-2 text-xs text-ink/60">
                        {row.updatedAt.slice(0, 16).replace("T", " ")}
                      </td>
                    </tr>
                  );
                })}
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-8 text-ink/55">
                      ไม่พบรายการตามตัวกรอง —{" "}
                      <Link href="/ops/inbound" className="text-forest underline">
                        รับสินค้าเข้า
                      </Link>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
