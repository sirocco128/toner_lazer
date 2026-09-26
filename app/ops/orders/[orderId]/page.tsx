import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyCustomerOrderLink } from "@/components/CopyCustomerOrderLink";
import {
  ConfirmPaymentForm,
  OrderFulfillmentForm,
  ShipConfirmForm,
} from "@/components/OrderOpsForms";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { PromptPayPanel } from "@/components/PromptPayPanel";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import {
  BILLING_DOCUMENT_LABELS,
  PAYMENT_KIND_LABELS,
  PAYMENT_RECORD_STATUS_LABELS,
  type PaymentRecord,
} from "@/lib/order-types";
import {
  currentDueAmount,
  ensureCurrentPayment,
  getOrderBundle,
  paymentStatusLabelForOrder,
} from "@/lib/order-service";
import { getLatestSlipForPayment } from "@/lib/payment-slips";
import { SLIP_CHECK_STATUS_LABELS } from "@/lib/slip-verify";
import { promptPayQrDataUrl } from "@/lib/qr-svg";
import { site } from "@/lib/site";
import { formatThb, formatThaiDateTime } from "@/lib/th-billing";
import { getCustomerById } from "@/lib/customer-repository";
import { draftFromOrder, listPosForOrder } from "@/lib/factory-po-queries";
import { FACTORY_PO_STATUS_LABELS } from "@/lib/factory-po-types";
import { CreateFactoryPoPanel } from "@/components/CreateFactoryPoPanel";
import { listFactoriesForPoForm } from "@/lib/factory-registry-service";
import { EntityTagForm } from "@/components/EntityTagForm";
import { listDistinctOpsTags } from "@/lib/ops-tag-links";
import {
  listOpenReservationsForOrder,
  listReservationsForOrder,
  sumAvailable,
} from "@/lib/wms-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ orderId: string }>;

export default async function OpsOrderDetailPage({
  params,
}: {
  params: Params;
}) {
  const actor = await requireOpsPage("orders.read");
  const canWrite = actorMay(actor, "orders.write");
  const canFactory = actorMay(actor, "factory.read");
  const canFactoryWrite = actorMay(actor, "factory.write");

  const { orderId } = await params;
  ensureCurrentPayment(orderId);
  const bundle = getOrderBundle(orderId);
  if (!bundle) notFound();
  const { order, payments, documents, events } = bundle;
  const due =
    payments.find(
      (p) => p.status === "pending" || p.status === "submitted" || p.status === "rejected",
    ) ?? null;

  const customerUrl = `${site.url}/orders/${order.orderId}?t=${order.accessToken}`;
  const customer = order.customerId ? getCustomerById(order.customerId) : null;
  const factoryPos = canFactory ? listPosForOrder(order.orderId) : [];
  const factoryDraft = canFactoryWrite ? draftFromOrder(order.orderId) : null;
  const tagSuggestions = listDistinctOpsTags();
  const openReservations = listOpenReservationsForOrder(order.orderId);
  const allReservations = listReservationsForOrder(order.orderId);
  const canStockRead = actorMay(actor, "stock.read");
  const stockReadyToShip =
    order.paymentStatus === "paid" &&
    openReservations.length > 0 &&
    (order.fulfillmentStatus === "warehouse" ||
      order.fulfillmentStatus === "inbound");

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/orders" className="text-forest underline-offset-2 hover:underline">
          ← รายการออเดอร์
        </Link>
      </p>
      <h1 className="mt-3 font-mono text-xl font-bold text-forest sm:text-2xl">
        {order.orderId}
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        {paymentStatusLabelForOrder(order)}
        {order.quoteRequestId ? (
          <>
            {" · "}
            <Link
              href={`/ops/quotes/${order.quoteRequestId}`}
              className="text-forest underline-offset-2 hover:underline"
            >
              {order.quoteRequestId}
            </Link>
          </>
        ) : null}
        {customer ? (
          <>
            {" · "}
            <Link
              href={`/ops/customers/${customer.id}`}
              className="text-forest underline-offset-2 hover:underline"
            >
              {customer.company}
            </Link>
          </>
        ) : null}
      </p>

      <CopyCustomerOrderLink
        orderId={order.orderId}
        customerUrl={customerUrl}
        contactName={order.contactName}
      />

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink/55">ผู้ซื้อ / ใบกำกับภาษี</dt>
          <dd className="font-medium">{order.billingName}</dd>
          <dd className="text-sm text-ink/70">
            {order.billingTaxId || "ยังไม่มีเลขผู้เสียภาษีผู้ซื้อ"}
          </dd>
          <dd className="text-sm text-ink/70">{order.billingAddress || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/55">จัดส่ง</dt>
          <dd>
            {order.shipToName || order.contactName}
            {order.shipToProvince ? ` · ${order.shipToProvince}` : ""}
          </dd>
          <dd className="text-sm text-ink/70">{order.shipToAddress || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/55">ผู้ติดต่อ</dt>
          <dd>
            {order.contactName} · {order.email}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink/55">รายการ</dt>
          <dd>
            {order.productSummary} × {order.quantity}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink/55">มูลค่า + VAT {order.vatRate}%</dt>
          <dd>
            {formatThb(order.subtotalExVat)} + {formatThb(order.vatAmount)} ={" "}
            <span className="font-semibold">{formatThb(order.totalAmount)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink/55">มัดจำ / คงเหลือ / ชำระแล้ว</dt>
          <dd>
            {formatThb(order.depositAmount)} / {formatThb(order.remainingAmount)} /{" "}
            {formatThb(order.paidAmount)}
          </dd>
        </div>
      </dl>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {customer ? (
          <EntityTagForm
            entityType="customer"
            entityId={String(customer.id)}
            tags={customer.tags}
            suggestions={tagSuggestions}
            label="แท็กลูกค้า (บัญชี)"
            readOnly
          />
        ) : null}
        <EntityTagForm
          entityType="order"
          entityId={order.orderId}
          tags={order.tags}
          suggestions={tagSuggestions}
          label="แท็กบิลออเดอร์"
          hint="ติดกับบิลนี้เท่านั้น ไม่คัดลอกจากลูกค้า และไม่โชว์บนใบกำกับภาษี"
          readOnly={!canWrite}
        />
      </section>

      {canFactory ? (
        <section
          id="factory-po"
          className="mt-8 rounded-xl border border-forest/15 bg-paper p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-forest">ใบสั่งโรงงานจีน</h2>
            {factoryDraft ? (
              <CreateFactoryPoPanel
                orderId={order.orderId}
                defaults={factoryDraft}
                factories={listFactoriesForPoForm()}
              />
            ) : null}
          </div>
          {factoryPos.length === 0 ? (
            <p className="mt-3 text-sm text-ink/70">
              ยังไม่มีใบสั่งกลับโรงงาน — บันทึกสเปคโลโก้ ต้นทุน ขนส่ง และค่านำเข้าที่นี่
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-forest/10">
              {factoryPos.map((po) => (
                <li key={po.poId} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                  <Link
                    href={`/ops/factory-po/${po.poId}`}
                    className="font-mono text-forest underline-offset-2 hover:underline"
                  >
                    {po.poId}
                  </Link>
                  <span>
                    {FACTORY_PO_STATUS_LABELS[po.status]} · ลงเรือ {formatThb(po.landedTotalThb)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded border border-forest/15 bg-paper p-4">
          <h2 className="text-lg font-semibold text-forest">สถานะสินค้า</h2>
          <div className="mt-3">
            <OrderStatusTimeline current={order.fulfillmentStatus} />
          </div>
          {stockReadyToShip ? (
            <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-4 text-amber-950">
              <p className="text-base font-semibold">พร้อมส่ง — ทำทีละขั้น</p>
              <p className="mt-1 text-sm">
                มีการจองสต็อกค้าง {openReservations.length} รายการ · ชำระครบแล้ว
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href={`/ops/orders/${encodeURIComponent(order.orderId)}/pack`}
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-forest px-4 py-3 text-base font-semibold text-paper"
                >
                  1. พิมพ์ใบปะหน้าแพ็ก
                </Link>
                <ShipConfirmForm
                  orderId={order.orderId}
                  enabled={stockReadyToShip}
                  readOnly={!canWrite}
                />
              </div>
            </div>
          ) : openReservations.length > 0 ? (
            <p className="mt-4 text-sm">
              <Link
                href={`/ops/orders/${encodeURIComponent(order.orderId)}/pack`}
                className="text-forest underline-offset-2 hover:underline"
              >
                พิมพ์ใบปะหน้าแพ็ก
              </Link>
              <span className="text-ink/60">
                {" "}
                — รอชำระครบก่อนยืนยันส่ง
              </span>
            </p>
          ) : null}
          <div className="mt-4">
            <OrderFulfillmentForm
              orderId={order.orderId}
              current={order.fulfillmentStatus}
              readOnly={!canWrite}
              collapsed={stockReadyToShip}
            />
          </div>
        </div>

        {canStockRead ? (
          <div className="rounded border border-forest/15 bg-paper p-4">
            <h2 className="text-lg font-semibold text-forest">สต็อกที่จอง</h2>
            {openReservations.length === 0 && allReservations.length === 0 ? (
              <p className="mt-3 text-sm text-ink/60">
                ยังไม่มีการจอง — รับเข้าคลังด้วยรหัสสินค้าแล้วระบบจะจองให้อัตโนมัติ
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-forest/10 text-sm">
                {(openReservations.length > 0
                  ? openReservations
                  : allReservations.slice(0, 8)
                ).map((r) => {
                  const available = sumAvailable(r.productKey);
                  return (
                    <li
                      key={r.reservationId}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <Link
                          href={`/ops/stock/${encodeURIComponent(r.productKey)}`}
                          className="font-mono text-forest underline-offset-2 hover:underline"
                        >
                          {r.productKey}
                        </Link>
                        <p className="text-xs text-ink/60">
                          {r.status === "open"
                            ? "จองค้าง"
                            : r.status === "consumed"
                              ? "ตัดส่งแล้ว"
                              : "ปล่อยจองแล้ว"}{" "}
                          · {r.reservationId}
                        </p>
                      </div>
                      <div className="text-right tabular-nums">
                        <p className="font-medium">{r.qty} ชิ้น</p>
                        <p className="text-xs text-ink/60">
                          พร้อมขายรวม {available}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink/55">
              <Link
                href="/ops/stock"
                className="text-forest underline-offset-2 hover:underline"
              >
                ไปหน้าคลัง
              </Link>
            </p>
          </div>
        ) : due && currentDueAmount(order) > 0 ? (
          <Suspense fallback={<PromptPayQrFallback />}>
            <OrderPromptPayPanel
              due={due}
              orderId={order.orderId}
              token={order.accessToken}
            />
          </Suspense>
        ) : (
          <p className="rounded border border-forest/15 bg-paper p-4 text-sm">
            ไม่มียอดค้างชำระ
          </p>
        )}
      </div>

      {canStockRead && due && currentDueAmount(order) > 0 ? (
        <div className="mt-8">
          <Suspense fallback={<PromptPayQrFallback />}>
            <OrderPromptPayPanel
              due={due}
              orderId={order.orderId}
              token={order.accessToken}
            />
          </Suspense>
        </div>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-forest">ประวัติการรับชำระเงิน</h2>
          {canWrite ? (
            <Link
              href={`/ops/receipts?orderId=${encodeURIComponent(order.orderId)}`}
              className="text-sm text-forest underline-offset-2 hover:underline"
            >
              ออกใบรับเงินตามรายการ
            </Link>
          ) : null}
        </div>
        <ul className="mt-3 divide-y divide-forest/10 border-t border-forest/10">
          {payments.map((p) => {
            const slip = getLatestSlipForPayment(p.paymentId);
            return (
            <li
              key={p.paymentId}
              className="grid gap-3 py-4 text-sm sm:grid-cols-[1fr_minmax(16rem,20rem)]"
            >
              <div>
                <p className="font-mono text-xs">{p.paymentId}</p>
                <p>
                  {PAYMENT_KIND_LABELS[p.kind]} {formatThb(p.amount)} ·{" "}
                  {PAYMENT_RECORD_STATUS_LABELS[p.status]}
                </p>
                {p.customerReference ? (
                  <p className="text-xs text-ink/60">อ้างอิง: {p.customerReference}</p>
                ) : null}
                {slip ? (
                  <div className="mt-2 flex flex-wrap items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/ops/slips/${encodeURIComponent(slip.slipId)}`}
                      alt="สลิปโอนเงิน"
                      className="h-24 w-auto max-w-[8rem] rounded border border-forest/15 object-contain"
                    />
                    <p className="text-xs">
                      <Link
                        href={`/ops/approvals/pay/${encodeURIComponent(p.paymentId)}`}
                        className="text-forest underline-offset-2 hover:underline"
                      >
                        ดูสลิปเต็ม / อนุมัติ
                      </Link>
                      {" · "}
                      {SLIP_CHECK_STATUS_LABELS[slip.checkStatus]}
                    </p>
                  </div>
                ) : null}
                {p.rejectReason ? (
                  <p className="mt-1 text-xs text-red-800">เหตุผลปฏิเสธ: {p.rejectReason}</p>
                ) : null}
              </div>
              <ConfirmPaymentForm
                payment={p}
                orderId={order.orderId}
                readOnly={!canWrite}
              />
            </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-forest">เอกสารทางบัญชี</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {documents.map((doc) => (
            <li key={doc.documentId}>
              <Link
                href={`/ops/orders/${order.orderId}/documents/${doc.documentId}`}
                className="text-forest underline-offset-2 hover:underline"
              >
                {BILLING_DOCUMENT_LABELS[doc.documentType]} {doc.documentId}
                <span className="text-ink/55"> · พรีวิว / PDF</span>
              </Link>
              <span className="text-ink/55">
                {" "}
                · {formatThaiDateTime(doc.issuedAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-forest">ประวัติออเดอร์</h2>
        <ol className="mt-3 space-y-3 border-l border-forest/20 pl-4">
          {events.map((ev) => (
            <li key={ev.id} className="text-sm">
              <p>{ev.message}</p>
              <p className="text-xs text-ink/55">
                {formatThaiDateTime(ev.createdAt)}
                {ev.actor ? ` · ${ev.actor}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

async function OrderPromptPayPanel({
  due,
  orderId,
  token,
}: {
  due: PaymentRecord;
  orderId: string;
  token: string;
}) {
  let qrDataUrl: string | null = null;
  if (due.qrPayload) {
    try {
      qrDataUrl = await promptPayQrDataUrl(due.qrPayload);
    } catch {
      qrDataUrl = null;
    }
  }
  return (
    <PromptPayPanel
      qrDataUrl={qrDataUrl}
      amount={due.amount}
      payment={due}
      orderId={orderId}
      token={token}
      showNotify={false}
    />
  );
}

function PromptPayQrFallback() {
  return (
    <div
      className="rounded-2xl border border-forest/15 bg-paper p-6"
      role="status"
      aria-label="กำลังสร้างคิวอาร์โค้ด"
    >
      <div className="h-6 w-40 animate-pulse rounded bg-forest/10" />
      <p className="mt-2 text-sm text-ink/70">กำลังสร้างคิวอาร์โค้ดพร้อมเพย์…</p>
      <div className="mx-auto mt-4 h-52 w-52 animate-pulse rounded bg-forest/10" />
    </div>
  );
}
