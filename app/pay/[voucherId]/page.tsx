import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NotifyPaymentForm } from "@/components/OrderLookupForm";
import { PayeeDetailsBlock } from "@/components/PayeeDetailsBlock";
import { getCashReceiptByAccessToken } from "@/lib/ops-cycle-service";
import { getLatestSlipForVoucher } from "@/lib/payment-slips";
import { getPayeeDetails } from "@/lib/payee";
import { promptPayQrDataUrl } from "@/lib/qr-svg";
import { SLIP_CHECK_STATUS_LABELS } from "@/lib/slip-verify";
import { formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "แจ้งโอนเงิน",
  robots: { index: false, follow: false },
};

type Params = Promise<{ voucherId: string }>;
type Search = Promise<{ t?: string }>;

export default async function PublicVoucherPayPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { voucherId } = await params;
  const { t: token } = await searchParams;
  if (!token) notFound();
  const voucher = getCashReceiptByAccessToken(token);
  if (!voucher || voucher.voucherId !== voucherId) notFound();

  const payee = getPayeeDetails();
  const slip = getLatestSlipForVoucher(voucher.voucherId);
  const qr = voucher.qrPayload ? await promptPayQrDataUrl(voucher.qrPayload) : null;

  return (
    <div className="mx-auto max-w-xl px-page py-12">
      <h1 className="text-2xl font-bold text-forest">แจ้งโอนเงิน</h1>
      <p className="mt-1 font-mono text-sm">{voucher.voucherId}</p>
      <p className="mt-1 text-sm text-ink/70">
        {voucher.payerName} · {formatThb(voucher.totalAmount)}
      </p>

      <div className="mt-6 rounded-2xl border border-forest/15 bg-paper p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR พร้อมเพย์" width={200} height={200} className="mx-auto" />
          ) : null}
          <PayeeDetailsBlock payee={payee} />
        </div>
        {voucher.status === "open" ? (
          voucher.rejectReason ? (
            <div className="mt-4 space-y-3">
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                บัญชีปฏิเสธสลิป: {voucher.rejectReason}
                <span className="mt-1 block text-xs">กรุณาแนบสลิปใหม่</span>
              </p>
              <NotifyPaymentForm voucherId={voucher.voucherId} token={token} />
            </div>
          ) : slip ? (
            <p className="mt-4 text-sm text-forest">
              รับสลิปแล้ว · {SLIP_CHECK_STATUS_LABELS[slip.checkStatus]}
              {slip.notes ? ` — ${slip.notes}` : ""}
              <span className="mt-1 block text-xs text-ink/60">
                รอบัญชีตรวจสอบและอนุมัติยอด — ยังไม่ถือว่าชำระสำเร็จ
              </span>
            </p>
          ) : (
            <NotifyPaymentForm voucherId={voucher.voucherId} token={token} />
          )
        ) : (
          <p className="mt-4 text-sm text-forest">ยืนยันรับเงินแล้ว</p>
        )}
      </div>
    </div>
  );
}
