import { NextResponse } from "next/server";
import { recordOpsReportPull } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditContextFromHeaders } from "@/lib/ops-request-context";
import {
  buildRevenueCycleReport,
  defaultFinanceRange,
  revenueCycleToCsv,
  revenueCycleVisibility,
} from "@/lib/revenue-cycle-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await requireOpsActor("reports.read");
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const fallback = defaultFinanceRange();
  const fromDate = url.searchParams.get("from") || fallback.fromDate;
  const toDate = url.searchParams.get("to") || fallback.toDate;
  const report = buildRevenueCycleReport({
    fromDate,
    toDate,
    visibility: revenueCycleVisibility(actor),
  });
  recordOpsReportPull({
    actor,
    kind: "export",
    reportName: "revenue-cycle.csv",
    filters: { from: fromDate, to: toDate },
    context: opsAuditContextFromHeaders(request.headers),
  });
  return new NextResponse(revenueCycleToCsv(report), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="revenue-cycle-${fromDate}-${toDate}.csv"`,
    },
  });
}
