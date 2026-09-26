import Link from "next/link";
import { notFound } from "next/navigation";
import { VoucherReviewForm } from "@/components/AccountingDecisionForms";
import { SlipPreview } from "@/components/SlipPreview";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { getCashReceipt } from "@/lib/ops-cycle-service";
import { CASH_LINE_KIND_LABELS } from "@/lib/ops-cycle-types";
import { getLatestSlipForVoucher } from "@/lib/payment-slips";
import { formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ voucherId: string }>;

export default async function OpsVoucherApprovalPage({
  params,
}: {
  params: Params;
}) {
  const actor = await requireOpsPage("orders.read");
  const { voucherId } = await params;
  const voucher = getCashReceipt(voucherId);
  if (!voucher) notFound();
  const slip = getLatestSlipForVoucher(voucher.voucherId);
  const canWrite = actorMay(actor, "orders.write");

  return (
    <div className="max-w-3xl">
      <p className="text-sm">
        <Link href="/ops/approvals" className="text-forest underline-offset-2 hover:underline">
          รอบัญชีอนุมัติยอด
        </Link>
        {" · "}
        <Link href="/ops/receipts" className="text-forest underline-offset-2 hover:underline">
          ใบรับเงิน
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold text-forest">ตรวจสลิปและอนุมัติยอด</h1>
      <p className="mt-1 font-mono text-sm">{voucher.voucherId}</p>
      <p className="mt-1 text-sm text-ink/70">
        {voucher.payerName} · {formatThb(voucher.totalAmount)}
        {voucher.orderId ? ` · ${voucher.orderId}` : ""}
      </p>
      <ul className="mt-3 text-sm text-ink/75">
        {voucher.lines.map((line) => (
          <li key={line.id}>
            {CASH_LINE_KIND_LABELS[line.kind]} {formatThb(line.amount)}
            {line.description ? ` — ${line.description}` : ""}
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-forest/15 bg-paper p-4">
        {slip ? (
          <SlipPreview slip={slip} large />
        ) : (
          <p className="text-sm text-ink/70">ยังไม่มีสลิปแนบ</p>
        )}
      </div>

      {voucher.status === "confirmed" ? (
        <p className="mt-6 text-sm text-forest">ยืนยันรับเงินแล้ว</p>
      ) : (
        <div className="mt-6">
          <VoucherReviewForm
            voucherId={voucher.voucherId}
            amount={voucher.totalAmount}
            readOnly={!canWrite}
            rejected={Boolean(voucher.rejectReason)}
            rejectReason={voucher.rejectReason}
            next="/ops/approvals"
          />
        </div>
      )}
    </div>
  );
}
