import { NextResponse } from "next/server";
import { draftPageSeo } from "@/lib/seo-draft";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditContextFromHeaders } from "@/lib/ops-request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireOpsActor("seo.write");
  if (!actor) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { path?: string; brief?: string };
  try {
    body = (await request.json()) as { path?: string; brief?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const result = await draftPageSeo({
    path: String(body.path || ""),
    brief: String(body.brief || ""),
  });
  writeOpsAudit({
    actor,
    action: "seo.draft",
    status: result.ok ? "ok" : "denied",
    resourceType: "page",
    resourceId: String(body.path || ""),
    toolName: "seo.draft",
    prompt: String(body.brief || ""),
    ...opsAuditContextFromHeaders(request.headers),
    errorMessage: result.ok ? null : result.error,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, draft: result.draft, path: result.page.path });
}
