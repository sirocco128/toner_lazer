import { notFound } from "next/navigation";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";
import { PayeeDetailsBlock } from "@/components/PayeeDetailsBlock";
import { COMPANY, formatRegisteredAddress } from "@/lib/company";
import { requireOpsPage } from "@/lib/ops-auth";
import { ensureCashReceiptAccessToken, getCashReceipt } from "@/lib/ops-cycle-service";
import { CASH_LINE_KIND_LABELS } from "@/lib/ops-cycle-types";
import { getOrderRepository } from "@/lib/order-repository";
import { getPayeeDetails } from "@/lib/payee";
import { promptPayQrDataUrl } from "@/lib/qr-svg";
import { bahtText } from "@/lib/th-baht-text";
import { formatThaiDate, formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ voucherId: string }>;

export default async function CashReceiptPrintPage({
  params,
}: {
  params: Params;
}) {
  await requireOpsPage("orders.read");
  const { voucherId } = await params;
  const voucher = getCashReceipt(voucherId);
  if (!voucher) notFound();
  const order = voucher.orderId
    ? getOrderRepository().getOrderByOrderId(voucher.orderId)
    : null;
  const qr = voucher.qrPayload ? await promptPayQrDataUrl(voucher.qrPayload) : null;
  const payee = getPayeeDetails();
  const notifyToken = voucher.status === "open" ? ensureCashReceiptAccessToken(voucher.voucherId) : voucher.accessToken;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const notifyHref = order
    ? `${siteUrl}/orders/${order.orderId}?t=${order.accessToken}`
    : notifyToken
      ? `${siteUrl}/pay/${voucher.voucherId}?t=${notifyToken}`
      : null;
  const statusLabel =
    voucher.status === "confirmed"
      ? "ยืนยันรับเงินแล้ว"
      : voucher.status === "void"
        ? "ยกเลิก"
        : "รอเงินเข้า";

  return (
    <DocumentPreviewShell
      backHref="/ops/receipts"
      backLabel="← กลับใบรับเงิน"
      fileName={voucher.voucherId}
    >
      <article className="max-w-full break-words">
        <header className="border-b border-forest/20 pb-3">
          <p className="text-lg font-bold text-forest">{COMPANY.legalName}</p>
          <p className="mt-1 text-sm text-ink/75">{formatRegisteredAddress()}</p>
          <p className="text-sm">เลขประจำตัวผู้เสียภาษี {COMPANY.taxId} · สำนักงานใหญ่</p>
          <h1 className="mt-3 text-center text-xl font-bold tracking-wide">ใบรับเงิน</h1>
          <p className="text-center text-xs text-ink/60">ตามรายการรับ — ไม่ใช่ใบกำกับภาษี</p>
        </header>

        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink/55">เลขที่</dt>
            <dd className="font-mono font-semibold">{voucher.voucherId}</dd>
          </div>
          <div>
            <dt className="text-ink/55">วันที่</dt>
            <dd>{formatThaiDate(voucher.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-ink/55">ผู้จ่าย</dt>
            <dd className="font-medium">{voucher.payerName}</dd>
          </div>
          <div>
            <dt className="text-ink/55">สถานะ</dt>
            <dd>{statusLabel}</dd>
          </div>
          {order ? (
            <div className="sm:col-span-2">
              <dt className="text-ink/55">ออเดอร์</dt>
              <dd className="font-mono">
                {order.orderId}
                {order.company ? ` · ${order.company}` : ""}
              </dd>
            </div>
          ) : null}
        </dl>

        <table className="mt-4 w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-forest/20 text-left">
              <th className="py-2">#</th>
              <th className="py-2">รายการรับ</th>
              <th className="py-2">ประเภท</th>
              <th className="py-2 text-right">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((line) => (
              <tr key={line.id} className="border-b border-forest/10">
                <td className="py-2">{line.lineNo}</td>
                <td className="py-2">{line.description}</td>
                <td className="py-2">{CASH_LINE_KIND_LABELS[line.kind]}</td>
                <td className="py-2 text-right">{formatThb(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-right text-lg font-semibold">
          รวม {formatThb(voucher.totalAmount)}
        </p>
        <p className="mt-1 text-right text-sm text-ink/70">
          ({bahtText(voucher.totalAmount)})
        </p>
        {voucher.notes ? (
          <p className="mt-4 text-sm">หมายเหตุ: {voucher.notes}</p>
        ) : null}

        {qr && voucher.status === "open" ? (
          <div className="mt-4 grid grid-cols-[96px_1fr] items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR พร้อมเพย์" width={96} height={96} />
            <div>
              <PayeeDetailsBlock payee={payee} compact />
              {notifyHref ? (
                <p className="mt-2 text-[11px] text-ink/70">
                  หลังโอน แจ้งโอนและแนบสลิปที่ {notifyHref}
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-ink/70">สแกนพร้อมเพย์ตามยอดใบนี้ แล้วแจ้งโอนพร้อมแนบสลิป</p>
              )}
            </div>
          </div>
        ) : null}

        <p className="mt-5 text-xs text-ink/50">
          เอกสารภายในสำหรับรับเงินตามรายการ — ใบกำกับภาษีออกเมื่อส่งมอบและชำระครบ
        </p>
      </article>
    </DocumentPreviewShell>
  );
}
