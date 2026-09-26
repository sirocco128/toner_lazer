import Link from "next/link";
import { requireOpsPage } from "@/lib/ops-auth";
import { listCashReceipts } from "@/lib/ops-cycle-service";
import { getOrderRepository } from "@/lib/order-repository";
import { PAYMENT_KIND_LABELS } from "@/lib/order-types";
import { PayeeDetailsBlock } from "@/components/PayeeDetailsBlock";
import { getPayeeDetails } from "@/lib/payee";
import { promptPayQrDataUrl } from "@/lib/qr-svg";
import { formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function QrPayPage() {
  await requireOpsPage("orders.read");
  const promptPay = getPayeeDetails();
  const openVouchers = listCashReceipts({ status: "open", limit: 40 });
  const openPayments = getOrderRepository().listOpenPayments(40);
  const repo = getOrderRepository();

  const voucherQrs = await Promise.all(
    openVouchers.map(async (v) => ({
      id: v.voucherId,
      label: v.payerName,
      amount: v.totalAmount,
      href: `/ops/receipts?ok=${encodeURIComponent(v.voucherId)}`,
      qr: v.qrPayload ? await promptPayQrDataUrl(v.qrPayload) : null,
    })),
  );

  const paymentQrs = await Promise.all(
    openPayments.map(async (p) => {
      const order = repo.getOrderByOrderId(p.orderId);
      return {
        id: p.paymentId,
        label: `${order?.company || p.orderId} · ${PAYMENT_KIND_LABELS[p.kind]}`,
        amount: p.amount,
        href: `/ops/orders/${p.orderId}`,
        qr: p.qrPayload ? await promptPayQrDataUrl(p.qrPayload) : null,
      };
    }),
  );

  const cards = [...voucherQrs, ...paymentQrs];

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/cycle" className="text-forest underline-offset-2 hover:underline">
          ← วงจรปฏิบัติการ
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">QR พร้อมเพย์</h1>
      <p className="mt-1 text-sm text-ink/70">
        รวม QR พร้อมเพย์ที่ยังรอเงินเข้า
        {promptPay.promptPayId
          ? ` · ${promptPay.promptPayLabel} ${promptPay.promptPayDisplay}`
          : " · ยังไม่ได้ตั้ง PROMPTPAY_ID"}
      </p>
      <div className="mt-4 rounded-xl border border-forest/15 bg-paper p-4">
        <PayeeDetailsBlock payee={promptPay} />
      </div>

      {cards.length === 0 ? (
        <p className="mt-8 text-sm text-ink/60">ยังไม่มี QR ที่รอชำระ</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="rounded-xl border border-forest/15 bg-paper p-4 hover:border-brass/50"
            >
              {card.qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.qr} alt="" width={180} height={180} className="mx-auto" />
              ) : (
                <p className="py-10 text-center text-sm text-ink/50">ไม่มี QR</p>
              )}
              <p className="mt-3 font-mono text-xs text-forest">{card.id}</p>
              <p className="mt-1 text-sm">{card.label}</p>
              <p className="mt-1 font-semibold">{formatThb(card.amount)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
