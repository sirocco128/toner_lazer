import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";
import { PromptPayPanel } from "@/components/PromptPayPanel";
import { RememberRecentOrder } from "@/components/RememberRecentOrder";
import { issueHrefForOrder } from "@/lib/customer-session";
import {
  BILLING_DOCUMENT_LABELS,
  PAYMENT_KIND_LABELS,
  PAYMENT_RECORD_STATUS_LABELS,
} from "@/lib/order-types";
import {
  currentDueAmount,
  ensureCurrentPayment,
  getPublicOrder,
  paymentStatusLabelForOrder,
} from "@/lib/order-service";
import { promptPayQrDataUrl } from "@/lib/qr-svg";
import { getLatestSlipForPayment } from "@/lib/payment-slips";
import { formatThb, formatThaiDateTime } from "@/lib/th-billing";
import {
  ACCOUNT_HUB_TITLE,
  REPORT_ISSUE_FOR_ORDER,
} from "@/lib/ux-copy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "รายละเอียดออเดอร์",
  robots: { index: false, follow: false },
};

type Params = Promise<{ orderId: string }>;
type Search = Promise<{ t?: string }>;

export default async function PublicOrderPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { orderId } = await params;
  const { t: token } = await searchParams;
  if (!token) notFound();

  const allowed = getPublicOrder(orderId, token);
  if (!allowed) notFound();
  ensureCurrentPayment(orderId);
  const bundle = getPublicOrder(orderId, token);
  if (!bundle) notFound();

  const { order, payments, documents, events } = bundle;
  const due =
    payments.find(
      (p) => p.status === "pending" || p.status === "submitted" || p.status === "rejected",
    ) ?? null;

  let qrDataUrl: string | null = null;
  if (due?.qrPayload) {
    try {
      qrDataUrl = await promptPayQrDataUrl(due.qrPayload);
    } catch {
      qrDataUrl = null;
    }
  }

  return (
    <div className="mx-auto max-w-content px-page py-12 sm:py-16">
      <RememberRecentOrder orderId={order.orderId} token={token} />
      <Breadcrumbs
        items={[
          { href: "/account", label: ACCOUNT_HUB_TITLE },
          { href: "/orders", label: "ออเดอร์ของฉัน" },
          { label: order.orderId },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-forest">{order.orderId}</h1>
          <p className="mt-2 text-sm text-ink/70">
            {order.company} · {paymentStatusLabelForOrder(order)}
          </p>
        </div>
        <Link
          href={issueHrefForOrder(order.orderId, token)}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/25 bg-paper px-5 text-sm font-semibold text-forest transition hover:border-brass/50 hover:bg-forest-mist/50"
        >
          {REPORT_ISSUE_FOR_ORDER}
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-forest/15 bg-paper p-6">
          <h2 className="text-lg font-semibold text-forest">ยอดเงิน</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>มูลค่าสินค้า</dt>
              <dd>{formatThb(order.subtotalExVat)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>ภาษีมูลค่าเพิ่ม {order.vatRate}%</dt>
              <dd>{formatThb(order.vatAmount)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>รวมทั้งสิ้น</dt>
              <dd>{formatThb(order.totalAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>มัดจำ</dt>
              <dd>{formatThb(order.depositAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>ชำระแล้ว</dt>
              <dd>{formatThb(order.paidAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>คงเหลือ</dt>
              <dd>{formatThb(order.remainingAmount)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-forest/15 bg-paper p-6">
          <h2 className="text-lg font-semibold text-forest">สถานะสินค้า</h2>
          <p className="mt-1 text-xs text-ink/60">
            ตั้งแต่จอง รอผลิต ขนส่งจากจีน เข้าประเทศ เข้าคลัง จนจัดส่งถึงคุณ
          </p>
          <div className="mt-4">
            <OrderStatusTimeline current={order.fulfillmentStatus} />
          </div>
        </section>
      </div>

      {due && currentDueAmount(order) > 0 ? (
        <div className="mt-8">
          <PromptPayPanel
            qrDataUrl={qrDataUrl}
            amount={due.amount}
            payment={due}
            orderId={order.orderId}
            token={token}
            showNotify
            slipStatus={getLatestSlipForPayment(due.paymentId)?.checkStatus ?? null}
            rejectReason={due.rejectReason}
          />
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-forest/15 bg-forest-mist/40 px-4 py-3 text-sm text-forest">
          ไม่มียอดค้างชำระ
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-forest">ประวัติการรับชำระเงิน</h2>
        <ul className="mt-3 divide-y divide-forest/10 border-t border-forest/10">
          {payments.length === 0 ? (
            <li className="py-4 text-sm text-ink/60">ยังไม่มีรายการชำระเงิน</li>
          ) : (
            payments.map((p) => (
              <li key={p.paymentId} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>
                  {PAYMENT_KIND_LABELS[p.kind]} · {formatThb(p.amount)}
                </span>
                <span className="text-ink/65">
                  {PAYMENT_RECORD_STATUS_LABELS[p.status]} ·{" "}
                  {formatThaiDateTime(p.createdAt)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-forest">เอกสารทางบัญชี</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {documents.length === 0 ? (
            <li className="text-ink/60">ยังไม่มีเอกสาร</li>
          ) : (
            documents.map((doc) => (
              <li key={doc.documentId}>
                <Link
                  href={`/orders/${order.orderId}/documents/${doc.documentId}?t=${token}`}
                  className="text-forest underline-offset-2 hover:underline"
                >
                  {BILLING_DOCUMENT_LABELS[doc.documentType]} {doc.documentId}
                  <span className="text-ink/55"> · พรีวิว / PDF</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-forest">ประวัติออเดอร์</h2>
        <ol className="mt-3 space-y-3 border-l border-forest/20 pl-4">
          {events.map((ev) => (
            <li key={ev.id} className="text-sm">
              <p>{ev.message}</p>
              <p className="text-xs text-ink/55">{formatThaiDateTime(ev.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
