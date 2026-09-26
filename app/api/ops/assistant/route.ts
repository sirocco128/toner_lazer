import { NextResponse } from "next/server";
import { runOpsAssistant } from "@/lib/assistant-ops";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditContextFromHeaders } from "@/lib/ops-request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireOpsActor("assistant.use");
  if (!actor) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { message?: string };
  try {
    body = (await request.json()) as { message?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const result = await runOpsAssistant({
    actor,
    message: String(body.message || ""),
  });

  writeOpsAudit({
    actor,
    action: "assistant.ops",
    status: result.refused ? "denied" : "ok",
    toolName: result.tools.map((item) => item.tool).join(",") || null,
    prompt: String(body.message || ""),
    detail: { tools: result.tools },
    ...opsAuditContextFromHeaders(request.headers),
    errorMessage: result.refused ? "refused" : null,
  });

  return NextResponse.json({
    ok: true,
    reply: result.reply,
    tools: result.tools,
    refused: result.refused,
  });
}
