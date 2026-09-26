import Link from "next/link";
import { InboundScanForm } from "@/components/InboundScanForm";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { WmsNav } from "@/components/WmsNav";
import { voidGoodsReceiptAction } from "@/app/actions/ops-stock";
import { listPos } from "@/lib/factory-po-queries";
import { requireOpsPage } from "@/lib/ops-auth";
import {
  factoryPayableSnapshot,
  getGoodsReceipt,
  listGoodsReceipts,
} from "@/lib/ops-cycle-service";
import { DESTINATION_LABELS } from "@/lib/ops-cycle-types";
import { getWmsSkuKeyOptions } from "@/lib/wms-sku-options";
import { listLocations } from "@/lib/wms-repository";
import {
  DEFAULT_LOCATION_CODE,
  XDOCK_LOCATION_CODE,
} from "@/lib/wms-types";
import { formatThaiDateTime, formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{
  ok?: string;
  poId?: string;
  claim?: string;
  voided?: string;
  orderId?: string;
  mode?: string;
}>;

export default async function InboundPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("factory.write");
  const sp = await searchParams;
  const pos = listPos({ status: "all" }).filter(
    (po) => po.status !== "cancelled" && po.status !== "draft",
  );
  const selectedPoId = (sp.poId || pos[0]?.poId || "").trim();
  const selectedPo = pos.find((p) => p.poId === selectedPoId) || null;
  const snap = selectedPoId ? factoryPayableSnapshot(selectedPoId) : null;
  const receipts = listGoodsReceipts({ limit: 40 });
  const locations = listLocations().filter((l) => l.kind !== "qc");
  const skuOptions = await getWmsSkuKeyOptions();
  const isCrossDock =
    !selectedPo || selectedPo.receiveMode !== "stock";
  const defaultLocation = isCrossDock
    ? XDOCK_LOCATION_CODE
    : DEFAULT_LOCATION_CODE;
  const remainingQty = selectedPo
    ? Math.max(0, selectedPo.quantity - selectedPo.receivedQty)
    : 0;
  const asnQty = selectedPo?.asnQty ?? null;
  const asnMismatch =
    asnQty != null && asnQty > 0 && remainingQty > 0 && asnQty !== remainingQty;

  const okReceipt = sp.ok ? getGoodsReceipt(sp.ok) : null;
  const successOrderId =
    (sp.orderId || okReceipt?.orderId || "").trim() || null;
  const successCrossDock =
    sp.mode === "cross_dock" ||
    (selectedPo?.receiveMode === "cross_dock" && Boolean(sp.ok));

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/stock" className="text-forest underline-offset-2 hover:underline">
          ← คลังสินค้า
        </Link>
        {" · "}
        <Link href="/ops/cycle" className="text-forest underline-offset-2 hover:underline">
          วงจรปฏิบัติการ
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">รับสินค้าเข้า</h1>
      <p className="mt-1 text-sm text-ink/70">
        สแกนหนึ่งจอ — เลือกใบสั่ง · สแกน SKU · จำนวน · บันทึก
      </p>
      <WmsNav pathname="/ops/inbound" />

      {sp.ok ? (
        <div className="mt-4 rounded-xl border border-forest/25 bg-forest/10 px-4 py-3 text-sm text-forest">
          <p className="font-medium">บันทึกใบรับ {sp.ok} แล้ว</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href={`/ops/inbound/${encodeURIComponent(sp.ok)}/print`}
              className="underline-offset-2 hover:underline"
            >
              พรีวิวใบรับ
            </Link>
            {successOrderId && successCrossDock ? (
              <>
                <Link
                  href={`/ops/orders/${encodeURIComponent(successOrderId)}/pack`}
                  className="rounded-lg bg-forest px-3 py-1.5 font-medium text-paper"
                >
                  พิมพ์ใบปะหน้าแพ็ก
                </Link>
                <Link
                  href={`/ops/orders/${encodeURIComponent(successOrderId)}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  ไปยืนยันส่งออเดอร์
                </Link>
              </>
            ) : successOrderId ? (
              <Link
                href={`/ops/orders/${encodeURIComponent(successOrderId)}`}
                className="underline-offset-2 hover:underline"
              >
                เปิดออเดอร์
              </Link>
            ) : null}
            <Link
              href="/ops/stock"
              className="underline-offset-2 hover:underline"
            >
              ดูคิวคลัง
            </Link>
          </div>
          {sp.claim ? (
            <p className="mt-2">
              เปิดเคลมของเสีย{" "}
              <Link
                href={`/ops/claims?ok=${encodeURIComponent(sp.claim)}`}
                className="font-mono underline-offset-2 hover:underline"
              >
                {sp.claim}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      {sp.voided ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ยกเลิกใบรับ {sp.voided} แล้ว
        </p>
      ) : null}

      {selectedPo?.asnContainer || selectedPo?.asnEta || asnQty != null ? (
        <p className="mt-4 rounded-lg border border-forest/15 bg-paper px-3 py-2 text-sm text-ink/80">
          ของระหว่างทาง
          {selectedPo?.asnContainer
            ? ` · ตู้/B/L ${selectedPo.asnContainer}`
            : ""}
          {selectedPo?.asnEta
            ? ` · ETA ${(selectedPo.asnEta || "").slice(0, 10)}`
            : ""}
          {asnQty != null ? ` · ตาม ASN ${asnQty} ชิ้น` : ""}
          {asnMismatch ? (
            <span className="mt-1 block text-amber-800">
              จำนวนตาม ASN ไม่ตรงค้างรับในใบสั่ง ({remainingQty}) — ตรวจก่อนบันทึก
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-6">
        <InboundScanForm
          pos={pos.map((po) => ({
            poId: po.poId,
            productName: po.productName,
            remainingQty: Math.max(0, po.quantity - po.receivedQty),
            receiveMode: po.receiveMode,
            sourceOfferId: po.sourceOfferId,
          }))}
          selectedPoId={selectedPoId}
          selectedProductName={selectedPo?.productName || null}
          snapLine={
            snap
              ? `สั่ง ${snap.orderedQty} · รับแล้ว ${snap.receivedQty} · ค้าง ${snap.remainingQty} · ต้นทุนต่อชิ้น ${formatThb(snap.unitThb)} · ${DESTINATION_LABELS[snap.destination]}`
              : null
          }
          isCrossDock={isCrossDock}
          defaultLocation={defaultLocation}
          defaultDestination={snap?.destination || "warehouse"}
          defaultQty={snap?.remainingQty || ""}
          skuOptions={skuOptions}
          locations={locations.map((l) => ({
            locationCode: l.locationCode,
            name: l.name,
          }))}
          skuDefault={selectedPo?.sourceOfferId || ""}
        />
      </div>

      <h2 className="mt-10 text-lg font-semibold text-forest">ใบรับล่าสุด</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2">ใบรับ</th>
              <th className="px-2 py-2">SKU</th>
              <th className="px-2 py-2">PO</th>
              <th className="px-2 py-2">ปลายทาง</th>
              <th className="px-2 py-2 text-right">จำนวน</th>
              <th className="px-2 py-2 text-right">ยอดตามรับ</th>
              <th className="px-2 py-2">เมื่อ</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {receipts.map((row) => (
              <tr key={row.receiptId} className="border-b border-forest/10">
                <td className="px-2 py-2 font-mono text-xs">{row.receiptId}</td>
                <td className="px-2 py-2 font-mono text-xs">{row.productKey || "—"}</td>
                <td className="px-2 py-2 font-mono text-xs">
                  <Link href={`/ops/factory-po/${row.poId}`} className="underline-offset-2 hover:underline">
                    {row.poId}
                  </Link>
                </td>
                <td className="px-2 py-2">{DESTINATION_LABELS[row.destination]}</td>
                <td className="px-2 py-2 text-right">{row.qtyReceived}</td>
                <td className="px-2 py-2 text-right">{formatThb(row.amountThb)}</td>
                <td className="px-2 py-2 text-ink/70">{formatThaiDateTime(row.receivedAt)}</td>
                <td className="space-y-1 px-2 py-2">
                  <Link
                    href={`/ops/inbound/${encodeURIComponent(row.receiptId)}/print`}
                    className="block text-forest underline-offset-2 hover:underline"
                  >
                    พรีวิว
                  </Link>
                  {row.status === "posted" ? (
                    <OpsCycleForm action={voidGoodsReceiptAction} submitLabel="ยกเลิกใบรับ">
                      <input type="hidden" name="receiptId" value={row.receiptId} />
                    </OpsCycleForm>
                  ) : null}
                  {row.qtyDamaged > 0 ? (
                    <span className="text-xs text-ink/60">เสีย {row.qtyDamaged}</span>
                  ) : null}
                </td>
              </tr>
            ))}
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-ink/55">
                  ยังไม่มีใบรับ — เมื่อมีใบสั่งสถานะ shipped / inbound ให้รับที่ฟอร์มด้านบน
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
