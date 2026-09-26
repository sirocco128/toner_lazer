import { NotifyPaymentForm } from "@/components/OrderLookupForm";
import { PayeeDetailsBlock } from "@/components/PayeeDetailsBlock";
import {
  PAYMENT_KIND_LABELS,
  PAYMENT_RECORD_STATUS_LABELS,
  type PaymentRecord,
} from "@/lib/order-types";
import { getPayeeDetails } from "@/lib/payee";
import { SLIP_CHECK_STATUS_LABELS, type SlipCheckStatus } from "@/lib/slip-verify";
import { formatThb, formatThaiDateTime } from "@/lib/th-billing";

export function PromptPayPanel({
  qrDataUrl,
  amount,
  payment,
  orderId,
  token,
  showNotify,
  slipStatus,
  rejectReason,
}: {
  qrDataUrl: string | null;
  amount: number;
  payment: PaymentRecord;
  orderId: string;
  token: string;
  showNotify: boolean;
  slipStatus?: SlipCheckStatus | null;
  rejectReason?: string | null;
}) {
  const payee = getPayeeDetails();
  const waitingForAccounting = payment.status === "submitted";
  const canUpload =
    showNotify && (payment.status === "pending" || payment.status === "rejected");
  return (
    <section className="rounded-2xl border border-forest/15 bg-paper p-6">
      <h2 className="text-lg font-semibold text-forest">ชำระผ่านพร้อมเพย์</h2>
      <p className="mt-1 text-sm text-ink/70">
        {PAYMENT_KIND_LABELS[payment.kind]} {formatThb(amount)} ·{" "}
        {PAYMENT_RECORD_STATUS_LABELS[payment.status]}
      </p>
      {payment.status === "rejected" && (rejectReason || payment.rejectReason) ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          บัญชีปฏิเสธสลิป: {rejectReason || payment.rejectReason}
          <span className="mt-1 block text-xs">กรุณาโอนใหม่หรือแนบสลิปที่ถูกต้อง</span>
        </p>
      ) : null}
      {waitingForAccounting ? (
        <p className="mt-2 rounded-lg border border-forest/20 bg-forest-mist/50 px-3 py-2 text-sm text-forest">
          รับสลิปแล้ว รอบัญชีตรวจสอบและอนุมัติยอด — ยังไม่ถือว่าชำระสำเร็จ
        </p>
      ) : null}
      {slipStatus && payment.status !== "rejected" ? (
        <p className="mt-2 text-sm text-forest">{SLIP_CHECK_STATUS_LABELS[slipStatus]}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="คิวอาร์โค้ดพร้อมเพย์"
              width={220}
              height={220}
              className="mx-auto h-52 w-52"
            />
          ) : (
            <p className="text-sm text-red-700">
              ยังตั้งค่าพร้อมเพย์ไม่ครบ กรุณาโอนตามที่ทีมขายแจ้ง
            </p>
          )}
          <p className="mt-2 text-center text-xs text-ink/55">
            สแกนด้วยแอปธนาคาร ยอดต้องตรงกับที่ระบุ
          </p>
        </div>
        <PayeeDetailsBlock payee={payee} />
      </div>
      {canUpload ? (
        <NotifyPaymentForm
          orderId={orderId}
          token={token}
          paymentId={payment.paymentId}
        />
      ) : null}
      {payment.confirmedAt ? (
        <p className="mt-3 text-xs text-ink/60">
          รับชำระเมื่อ {formatThaiDateTime(payment.confirmedAt)}
        </p>
      ) : null}
    </section>
  );
}
