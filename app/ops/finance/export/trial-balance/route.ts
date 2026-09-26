import { NextResponse } from "next/server";
import { recordOpsReportPull } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditContextFromHeaders } from "@/lib/ops-request-context";
import { trialBalance } from "@/lib/ledger-repository";
import { defaultFinanceRange } from "@/lib/finance-report";
import { csvEscape } from "@/lib/ledger-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await requireOpsActor("finance.read");
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const fallback = defaultFinanceRange();
  const fromDate = url.searchParams.get("from") || fallback.fromDate;
  const toDate = url.searchParams.get("to") || fallback.toDate;
  const rows = trialBalance({ fromDate, toDate }).filter(
    (row) => row.debit > 0.009 || row.credit > 0.009,
  );
  const lines = [
    "รหัสบัญชี,ชื่อบัญชี,ประเภท,เดบิต,เครดิต,สุทธิเดบิต,สุทธิเครดิต",
    ...rows.map((row) =>
      [
        csvEscape(row.accountCode),
        csvEscape(row.nameTh),
        csvEscape(row.type),
        csvEscape(row.debit.toFixed(2)),
        csvEscape(row.credit.toFixed(2)),
        csvEscape(row.netDebit.toFixed(2)),
        csvEscape(row.netCredit.toFixed(2)),
      ].join(","),
    ),
  ];
  recordOpsReportPull({
    actor,
    kind: "export",
    reportName: "trial-balance.csv",
    filters: { from: fromDate, to: toDate },
    context: opsAuditContextFromHeaders(request.headers),
  });
  return new NextResponse(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="trial-balance-${fromDate}-${toDate}.csv"`,
    },
  });
}
