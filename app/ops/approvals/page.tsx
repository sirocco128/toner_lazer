import Link from "next/link";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listApprovalQueue } from "@/lib/payment-approval";
import { SLIP_CHECK_STATUS_LABELS } from "@/lib/slip-verify";
import { formatThaiDateTime, formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsApprovalsPage() {
  const actor = await requireOpsPage("orders.read");
  const canWrite = actorMay(actor, "orders.write");
  const items = listApprovalQueue();

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/cycle" className="text-forest underline-offset-2 hover:underline">
          วงจรปฏิบัติการ
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-bold text-forest">รอบัญชีอนุมัติยอด</h1>
      <p className="mt-1 text-sm text-ink/70">
        ลูกค้าส่งสลิปแล้ว — ดูรูป เทียบยอด แล้วอนุมัติรับเงิน หรือปฏิเสธพร้อมเหตุผล
      </p>

      {items.length === 0 ? (
        <p className="mt-8 rounded-xl border border-forest/15 bg-paper px-4 py-6 text-sm text-ink/70">
          ไม่มียอดรออนุมัติ
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-forest/10 overflow-hidden rounded-xl border border-forest/15 bg-paper">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center gap-4 p-4">
              {item.slip ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/ops/slips/${encodeURIComponent(item.slip.slipId)}`}
                  alt=""
                  className="h-20 w-16 rounded border border-forest/15 object-cover"
                />
              ) : (
                <div className="flex h-20 w-16 items-center justify-center rounded border border-dashed border-forest/20 text-[10px] text-ink/45">
                  ไม่มีรูป
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-forest">{item.title}</p>
                <p className="text-sm text-ink/75">
                  {item.payer} · {formatThb(item.amount)}
                  {item.orderId ? ` · ${item.orderId}` : ""}
                </p>
                <p className="text-xs text-ink/55">
                  {item.checkStatus
                    ? SLIP_CHECK_STATUS_LABELS[item.checkStatus]
                    : "ยังไม่มีสลิป"}
                  {" · "}
                  {formatThaiDateTime(item.updatedAt)}
                </p>
              </div>
              <Link
                href={item.href}
                className="rounded bg-forest px-3 py-2 text-sm font-medium text-paper"
              >
                {canWrite ? "ดูสลิป / อนุมัติ" : "ดูสลิป"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
