import { formatThb } from "@/lib/th-billing";
import type { PaymentSlipRecord } from "@/lib/payment-slips";
import { SLIP_CHECK_STATUS_LABELS } from "@/lib/slip-verify";

export function SlipPreview({
  slip,
  large = false,
}: {
  slip: PaymentSlipRecord;
  large?: boolean;
}) {
  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/ops/slips/${encodeURIComponent(slip.slipId)}`}
        alt="สลิปโอนเงิน"
        className={
          large
            ? "max-h-[70vh] w-auto max-w-full rounded-lg border border-forest/15 bg-white"
            : "max-h-52 w-auto max-w-full rounded-lg border border-forest/15 bg-white"
        }
      />
      <figcaption className="text-xs text-ink/70">
        <p>
          ผลตรวจสลิป: {SLIP_CHECK_STATUS_LABELS[slip.checkStatus]}
          {slip.notes ? ` — ${slip.notes}` : ""}
        </p>
        <p>
          ยอดที่ต้องได้ {formatThb(slip.expectedAmount)}
          {slip.extractedAmount != null
            ? ` · ยอดในสลิป ${formatThb(slip.extractedAmount)}`
            : " · อ่านยอดจากสลิปไม่ได้"}
        </p>
        {slip.extractedPayee || slip.extractedPromptPay ? (
          <p>
            บัญชีในสลิป: {[slip.extractedPayee, slip.extractedPromptPay].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
