import {
  FULFILLMENT_LABELS,
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
} from "@/lib/order-types";

const TRACK = FULFILLMENT_STATUSES.filter((s) => s !== "cancelled");

export function OrderStatusTimeline({
  current,
}: {
  current: FulfillmentStatus;
}) {
  const currentIdx =
    current === "cancelled" ? -1 : TRACK.indexOf(current);
  const cancelled = current === "cancelled";

  return (
    <ol className="space-y-3">
      {cancelled ? (
        <li className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          ออเดอร์นี้ถูกยกเลิก
        </li>
      ) : null}
      {TRACK.map((status, index) => {
        const done = !cancelled && currentIdx >= index;
        const active = !cancelled && current === status;
        return (
          <li key={status} className="flex gap-3">
            <span
              className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done ? "bg-forest text-paper" : "bg-forest/10 text-ink/45"
              }`}
            >
              {index + 1}
            </span>
            <div>
              <p
                className={`text-sm font-medium ${
                  active ? "text-forest" : done ? "text-ink" : "text-ink/45"
                }`}
              >
                {FULFILLMENT_LABELS[status]}
              </p>
              {active ? (
                <p className="text-xs text-ink/60">สถานะปัจจุบัน</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
