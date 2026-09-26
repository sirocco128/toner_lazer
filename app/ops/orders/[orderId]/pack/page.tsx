import { notFound } from "next/navigation";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";
import { COMPANY, formatRegisteredAddress } from "@/lib/company";
import { requireOpsPage } from "@/lib/ops-auth";
import { getOrderBundle } from "@/lib/order-service";
import { FULFILLMENT_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-types";
import { promptPayQrDataUrl } from "@/lib/qr-svg";
import { formatThaiDate, formatThb } from "@/lib/th-billing";
import { listOpenReservationsForOrder } from "@/lib/wms-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ orderId: string }>;

export default async function OrderPackLabelPage({
  params,
}: {
  params: Params;
}) {
  await requireOpsPage("orders.read");
  const { orderId } = await params;
  const bundle = getOrderBundle(orderId);
  if (!bundle) notFound();
  const { order } = bundle;
  const reservations = listOpenReservationsForOrder(order.orderId);
  const shipName = order.shipToName || order.contactName;
  const shipPhone = order.shipToPhone || order.phone;
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await promptPayQrDataUrl(order.orderId);
  } catch {
    qrDataUrl = null;
  }

  return (
    <DocumentPreviewShell
      backHref={`/ops/orders/${encodeURIComponent(order.orderId)}`}
      backLabel="← กลับออเดอร์"
      fileName={`pack-${order.orderId}`}
      emphasizePrint
    >
      <article className="max-w-full break-words">
        <header className="border-b border-forest/20 pb-4">
          <p className="text-lg font-bold text-forest">{COMPANY.legalName}</p>
          <p className="mt-1 text-sm text-ink/75">{formatRegisteredAddress()}</p>
          <p className="text-sm">เลขประจำตัวผู้เสียภาษี {COMPANY.taxId}</p>
          <h1 className="mt-4 text-center text-2xl font-bold tracking-wide">
            ใบปะหน้าแพ็ก / จัดส่ง
          </h1>
        </header>

        <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-start">
          <div className="w-full flex-1 rounded-lg border-2 border-forest px-4 py-5 text-center">
            <p className="text-xs text-ink/55">เลขออเดอร์</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-wider text-forest sm:text-4xl">
              {order.orderId}
            </p>
            <p className="mt-2 text-sm text-ink/70">
              {PAYMENT_STATUS_LABELS[order.paymentStatus]} ·{" "}
              {FULFILLMENT_LABELS[order.fulfillmentStatus]}
            </p>
          </div>
          {qrDataUrl ? (
            <div className="shrink-0 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`QR ${order.orderId}`}
                width={160}
                height={160}
                className="mx-auto h-40 w-40"
              />
              <p className="mt-1 font-mono text-xs text-ink/60">{order.orderId}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-8 rounded-lg border border-forest/20 bg-ink/[0.02] px-4 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            ผู้รับ
          </p>
          <p className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
            {shipName}
          </p>
          <p className="mt-3 text-xl font-semibold tabular-nums text-ink">
            {shipPhone || "—"}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-ink/90">
            {order.shipToAddress || "—"}
            {order.shipToProvince ? `\n${order.shipToProvince}` : ""}
          </p>
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink/55">รายการ</dt>
            <dd className="text-base font-medium">
              {order.productSummary} × {order.quantity}
            </dd>
          </div>
          <div>
            <dt className="text-ink/55">มูลค่ารวม</dt>
            <dd className="text-base font-semibold">{formatThb(order.totalAmount)}</dd>
          </div>
          <div>
            <dt className="text-ink/55">วันที่พิมพ์</dt>
            <dd>{formatThaiDate(new Date().toISOString())}</dd>
          </div>
          <div>
            <dt className="text-ink/55">ผู้ติดต่อสั่งซื้อ</dt>
            <dd>
              {order.contactName} · {order.email}
            </dd>
          </div>
        </dl>

        <h2 className="mt-8 text-sm font-semibold text-forest">
          สต็อกที่จอง (ตัดตอนยืนยันส่ง)
        </h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-forest/20 text-left">
              <th className="py-2">SKU</th>
              <th className="py-2 text-right">จำนวนจอง</th>
              <th className="py-2">รหัสจอง</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-3 text-ink/55">
                  ไม่มีจองค้าง — ตรวจรับเข้าคลังก่อนแพ็ก
                </td>
              </tr>
            ) : (
              reservations.map((r) => (
                <tr key={r.reservationId} className="border-b border-forest/10">
                  <td className="py-2 font-mono">{r.productKey}</td>
                  <td className="py-2 text-right tabular-nums">{r.qty}</td>
                  <td className="py-2 font-mono text-xs text-ink/70">
                    {r.reservationId}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <p className="mt-8 text-xs text-ink/55">
          หลังแพ็กแล้ว กลับหน้าออเดอร์ กด 「2. ยืนยันส่ง」 เพื่อตัดสต็อก
        </p>
      </article>
    </DocumentPreviewShell>
  );
}