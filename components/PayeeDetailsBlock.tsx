import { PromptPayMark } from "@/components/PromptPayMark";
import type { PayeeDetails } from "@/lib/payee";

export function PayeeDetailsBlock({
  payee,
  compact = false,
}: {
  payee: PayeeDetails;
  compact?: boolean;
}) {
  if (!payee.promptPayId && !payee.bankAccountNo) {
    return (
      <p className="text-sm text-red-700">ยังไม่ได้ตั้งบัญชีรับเงิน กรุณาติดต่อทีมขาย</p>
    );
  }

  return (
    <div className={compact ? "text-xs leading-snug" : "text-sm"}>
      <div className="flex flex-wrap items-center gap-2">
        <PromptPayMark className={compact ? "h-6" : "h-8"} />
        {payee.bankName ? (
          <span className="rounded bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest">
            {payee.bankName}
          </span>
        ) : null}
      </div>
      <dl className={`mt-2 grid gap-x-3 ${compact ? "gap-y-0.5" : "gap-y-1"}`}>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink/55">ประเภท</dt>
          <dd>
            {payee.methodLabel}
            {payee.promptPayTypeLabel ? ` · ${payee.promptPayTypeLabel}` : ""}
          </dd>
        </div>
        {payee.promptPayDisplay ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ink/55">หมายเลขพร้อมเพย์</dt>
            <dd className="font-mono font-semibold">{payee.promptPayDisplay}</dd>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink/55">ชื่อบัญชี</dt>
          <dd>{payee.accountName}</dd>
        </div>
        {payee.bankAccountDisplay ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ink/55">เลขที่บัญชี</dt>
            <dd className="font-mono">{payee.bankAccountDisplay}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
