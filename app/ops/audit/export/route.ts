import { NextResponse } from "next/server";
import {
  listOpsAudit,
  opsAuditRowsToCsv,
  parseOpsAuditSearch,
  recordOpsReportPull,
} from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditContextFromHeaders } from "@/lib/ops-request-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await requireOpsActor("audit.read");
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const query = parseOpsAuditSearch({
    q: url.searchParams.get("q") || undefined,
    action: url.searchParams.get("action") || undefined,
    user: url.searchParams.get("user") || undefined,
    status: url.searchParams.get("status") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    report: url.searchParams.get("report") || undefined,
  });
  const rows = listOpsAudit({ ...query, limit: 500, offset: 0 });
  recordOpsReportPull({
    actor,
    kind: "export",
    reportName: "ops-audit.csv",
    filters: {
      q: query.q,
      action: query.action,
      user: query.actorEmail,
      status: query.status === "all" ? undefined : query.status,
      from: query.fromDate,
      to: query.toDate,
      report: query.reportName,
    },
    context: opsAuditContextFromHeaders(request.headers),
  });
  const from = query.fromDate || "start";
  const to = query.toDate || "now";
  return new NextResponse(opsAuditRowsToCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ops-audit-${from}-${to}.csv"`,
    },
  });
}
