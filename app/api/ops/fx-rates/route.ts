import { NextResponse } from "next/server";
import { requireOpsActor } from "@/lib/ops-auth";
import { getFxGuide } from "@/lib/fx-rates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireOpsActor("factory.read");
  if (!actor) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const guide = await getFxGuide();
  return NextResponse.json({
    ok: true,
    cnyThb: guide.cnyThb,
    usdThb: guide.usdThb,
    source: guide.source,
    fetchedAt: guide.fetchedAt,
    live: guide.live,
  });
}
