import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentReviewForm } from "@/components/AccountingDecisionForms";
import { SlipPreview } from "@/components/SlipPreview";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { getOrderRepository } from "@/lib/order-repository";
import { PAYMENT_KIND_LABELS, PAYMENT_RECORD_STATUS_LABELS } from "@/lib/order-types";
import { getLatestSlipForPayment } from "@/lib/payment-slips";
import { formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ paymentId: string }>;

export default async function OpsPaymentApprovalPage({
  params,
}: {
  params: Params;
}) {
  const actor = await requireOpsPage("orders.read");
  const { paymentId } = await params;
  const payment = getOrderRepository().getPaymentByPaymentId(paymentId);
  if (!payment) notFound();
  const order = getOrderRepository().getOrderByOrderId(payment.orderId);
  const slip = getLatestSlipForPayment(payment.paymentId);
  const canWrite = actorMay(actor, "orders.write");

  return (
    <div className="max-w-3xl">
      <p className="text-sm">
        <Link href="/ops/approvals" className="text-forest underline-offset-2 hover:underline">
          รอบัญชีอนุมัติยอด
        </Link>
        {" · "}
        <Link
          href={`/ops/orders/${encodeURIComponent(payment.orderId)}`}
          className="text-forest underline-offset-2 hover:underline"
        >
          ออเดอร์
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold text-forest">ตรวจสลิปและอนุมัติยอด</h1>
      <p className="mt-1 font-mono text-sm">{payment.paymentId}</p>
      <p className="mt-1 text-sm text-ink/70">
        {order?.company || payment.orderId} · {PAYMENT_KIND_LABELS[payment.kind]}{" "}
        {formatThb(payment.amount)} · {PAYMENT_RECORD_STATUS_LABELS[payment.status]}
      </p>
      {payment.customerReference ? (
        <p className="mt-1 text-xs text-ink/55">อ้างอิงลูกค้า: {payment.customerReference}</p>
      ) : null}

      <div className="mt-6 rounded-xl border border-forest/15 bg-paper p-4">
        {slip ? (
          <SlipPreview slip={slip} large />
        ) : (
          <p className="text-sm text-ink/70">ยังไม่มีสลิปแนบ — อนุมัติได้ถ้าเห็นเงินเข้าบัญชีแล้ว</p>
        )}
      </div>

      <div className="mt-6">
        <PaymentReviewForm
          payment={payment}
          orderId={payment.orderId}
          readOnly={!canWrite}
          next="/ops/approvals"
        />
      </div>
    </div>
  );
}
