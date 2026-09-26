import { ROLE_LABELS, type OpsRole } from "@/lib/ops-roles";
import {
  LEAD_STATUS_LABELS,
  type LeadStatus,
  type QuoteSalesTimelineEntry,
} from "@/lib/quote-types";
import { formatThaiDateTime } from "@/lib/th-billing";

function statusLabel(status: LeadStatus | null): string | null {
  if (!status) return null;
  return LEAD_STATUS_LABELS[status] || status;
}

function actorLabel(entry: QuoteSalesTimelineEntry): string {
  const name = entry.actorName?.trim() || entry.actorEmail?.trim();
  if (!name) return "ระบบ";
  const role =
    entry.actorRole && entry.actorRole in ROLE_LABELS
      ? ROLE_LABELS[entry.actorRole as OpsRole]
      : null;
  if (role && role !== name) return `${name} · ${role}`;
  return name;
}

function changeLabel(entry: QuoteSalesTimelineEntry): string {
  const from = statusLabel(entry.fromStatus);
  const to = statusLabel(entry.toStatus) || entry.toStatus;
  if (from && from !== to) return `${from} → ${to}`;
  if (entry.note) return "บันทึกเพิ่ม";
  return to;
}

export function QuoteSalesTimeline({
  entries,
}: {
  entries: QuoteSalesTimelineEntry[];
}) {
  return (
    <section
      className="mt-6 rounded border border-forest/15 bg-paper p-4"
      aria-labelledby="sales-timeline-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="sales-timeline-heading"
          className="text-lg font-semibold text-forest"
        >
          ไทม์ไลน์ฝ่ายขาย
        </h2>
        <p className="text-xs text-ink/55">
          {entries.length === 0
            ? "ยังไม่มีรายการ"
            : `${entries.length} รายการ · ใหม่สุดบนสุด`}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-ink/65">
          ยังไม่มีบันทึกการติดต่อ — เมื่อกดบันทึก สถานะหรือข้อความจะปรากฏที่นี่ตามเวลา
        </p>
      ) : (
        <ol className="mt-4 space-y-0">
          {entries.map((entry, index) => (
            <li key={entry.id} className="flex gap-3">
              <div className="flex w-4 shrink-0 flex-col items-center">
                <span
                  className="mt-1.5 h-2.5 w-2.5 rounded-full bg-forest"
                  aria-hidden
                />
                {index < entries.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-forest/20" aria-hidden />
                ) : null}
              </div>
              <div className={index < entries.length - 1 ? "pb-4" : ""}>
                <p className="font-mono text-[11px] tabular-nums text-ink/55">
                  {formatThaiDateTime(entry.createdAt)}
                </p>
                <p className="mt-0.5 text-sm font-medium text-forest">
                  {changeLabel(entry)}
                </p>
                <p className="text-xs text-ink/55">{actorLabel(entry)}</p>
                {entry.note ? (
                  <p className="mt-1.5 whitespace-pre-wrap rounded bg-forest-mist/50 px-3 py-2 text-sm text-ink/90">
                    {entry.note}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
