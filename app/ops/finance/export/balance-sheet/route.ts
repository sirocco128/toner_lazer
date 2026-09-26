import { NextResponse } from "next/server";
import { recordOpsReportPull } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditContextFromHeaders } from "@/lib/ops-request-context";
import { buildBalanceSheet, statementToCsv } from "@/lib/ledger-statements";
import { defaultFinanceRange } from "@/lib/finance-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await requireOpsActor("finance.read");
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const fallback = defaultFinanceRange();
  const asOf = url.searchParams.get("asOf") || fallback.toDate;
  const sheet = buildBalanceSheet({ asOf });
  const csv = [
    statementToCsv("สินทรัพย์", sheet.assets, "รวมสินทรัพย์", sheet.assetTotal),
    statementToCsv("หนี้สิน", sheet.liabilities, "รวมหนี้สิน", sheet.liabilityTotal),
    statementToCsv("ส่วนของเจ้าของ", sheet.equity, "รวมส่วนของเจ้าของ", sheet.equityTotal),
  ].join("\n");
  recordOpsReportPull({
    actor,
    kind: "export",
    reportName: "balance-sheet.csv",
    filters: { asOf },
    context: opsAuditContextFromHeaders(request.headers),
  });
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="balance-sheet-${asOf}.csv"`,
    },
  });
}
