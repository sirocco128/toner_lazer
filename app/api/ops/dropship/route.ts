import { buildDropshipCsv, isDropshipStatus } from "@/lib/dropship";
import { listDropshipOrders } from "@/lib/dropship-repository";
import { requireOpsActor } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ops/dropship?status=draft → CSV of dropship lines for the supplier. */
export async function GET(request: Request) {
  const actor = await requireOpsActor("factory.read");
  if (!actor) return new Response("unauthorized", { status: 401 });
  const statusParam = new URL(request.url).searchParams.get("status") || "";
  const orders = listDropshipOrders({
    status: isDropshipStatus(statusParam) ? statusParam : undefined,
    limit: 500,
  });
  const csv = "﻿" + buildDropshipCsv(orders);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dropship-${statusParam || "all"}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
