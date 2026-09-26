import { ROLE_LABELS } from "@/lib/ops-roles";
import {
  opsAuditActionLabel,
} from "@/lib/ops-audit-labels";
import type { OpsAuditRow } from "@/lib/ops-audit";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function whereFrom(row: OpsAuditRow): string {
  const bits = [row.geoLabel, row.ipAddress].filter(Boolean);
  return bits.join(" · ") || "ไม่ทราบที่มา";
}

function machineFrom(row: OpsAuditRow): string {
  const bits = [
    row.deviceLabel,
    row.machineHint ? `รหัส ${row.machineHint}` : null,
  ].filter(Boolean);
  return bits.join(" · ") || "ไม่ทราบเครื่อง";
}

function reportFrom(row: OpsAuditRow): string | null {
  if (!row.reportName && !row.reportFilters) return null;
  const filters = row.reportFilters
    ? row.reportFilters.replace(/[{}"]/g, " ").replace(/,/g, " · ")
    : "";
  return [row.reportName, filters.trim()].filter(Boolean).join(" — ");
}

export function OpsAuditTable({ rows }: { rows: OpsAuditRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-forest/25 bg-paper px-4 py-10 text-center text-sm text-ink/60">
        ไม่พบบันทึกตามตัวกรองนี้
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-forest/15 bg-paper">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-forest/15 bg-forest-mist/50 text-forest">
            <th className="px-3 py-2.5 font-semibold">เมื่อ</th>
            <th className="px-3 py-2.5 font-semibold">ผู้ใช้</th>
            <th className="px-3 py-2.5 font-semibold">จากที่ไหน</th>
            <th className="px-3 py-2.5 font-semibold">เครื่อง</th>
            <th className="px-3 py-2.5 font-semibold">ทำอะไร</th>
            <th className="px-3 py-2.5 font-semibold">ผล / รายการที่กระทบ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const report = reportFrom(row);
            return (
              <tr key={row.id} className="border-b border-forest/10 align-top">
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink/70">
                  {formatWhen(row.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-ink">
                    {row.actorName || row.actorEmail || "—"}
                  </div>
                  <div className="text-xs text-ink/55">
                    {[row.actorEmail, row.role ? ROLE_LABELS[row.role] : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-ink/80">{whereFrom(row)}</td>
                <td className="px-3 py-2.5 text-xs text-ink/80">{machineFrom(row)}</td>
                <td className="px-3 py-2.5">
                  <div>{opsAuditActionLabel(row.action)}</div>
                  <div className="font-mono text-[11px] text-ink/45">{row.action}</div>
                  <div
                    className={
                      row.status === "ok"
                        ? "mt-1 text-xs text-emerald-800"
                        : "mt-1 text-xs text-red-800"
                    }
                  >
                    {row.status === "ok" ? "สำเร็จ" : "ปฏิเสธ"}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-ink/80">
                  <div>{row.impact || "—"}</div>
                  {row.resourceId ? (
                    <div className="mt-1 text-ink/50">
                      {row.resourceType ? `${row.resourceType} · ` : ""}
                      {row.resourceId}
                    </div>
                  ) : null}
                  {report ? (
                    <div className="mt-1 rounded bg-brass/10 px-2 py-1 text-forest">
                      รายงาน: {report}
                    </div>
                  ) : null}
                  {row.errorMessage ? (
                    <div className="mt-1 text-red-800">{row.errorMessage}</div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
