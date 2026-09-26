import { NextResponse } from "next/server";
import { searchAlibabaImagesWithGemini } from "@/lib/alibaba/gemini-image-search";
import { requireOpsSession } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await requireOpsSession())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { query?: string };
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const query = String(body.query || "");
  const result = await searchAlibabaImagesWithGemini(query);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    query: result.query,
    model: result.model,
    candidates: result.candidates,
  });
}
