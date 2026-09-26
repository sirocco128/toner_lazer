import { NextResponse } from "next/server";
import { getOpsActor, isOpsAuthConfigured } from "@/lib/ops-auth";
import { ROLE_LABELS } from "@/lib/ops-roles";
import {
  OPS_MANUAL_GROUP_LABELS,
  OPS_MANUAL_GROUPS,
} from "@/lib/ops-manual-catalog";
import {
  buildManualToc,
  loadManualDocument,
} from "@/lib/ops-manual-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isOpsAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่า Ops auth" },
      { status: 503 },
    );
  }

  const actor = await getOpsActor();
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "ต้องเข้าสู่ระบบ Ops" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const docId = (searchParams.get("doc") || "").trim();

  if (!docId) {
    const toc = buildManualToc(actor);
    return NextResponse.json({
      ok: true,
      actor: {
        email: actor.email,
        name: actor.name,
        role: actor.role,
        roleLabel: ROLE_LABELS[actor.role],
      },
      groups: OPS_MANUAL_GROUPS.map((id) => ({
        id,
        label: OPS_MANUAL_GROUP_LABELS[id],
      })),
      toc,
    });
  }

  const loaded = loadManualDocument(docId, actor);
  if ("error" in loaded) {
    return NextResponse.json(
      { ok: false, error: loaded.error },
      { status: loaded.status },
    );
  }

  return NextResponse.json({
    ok: true,
    actor: {
      email: actor.email,
      name: actor.name,
      role: actor.role,
      roleLabel: ROLE_LABELS[actor.role],
    },
    doc: {
      id: loaded.id,
      title: loaded.title,
      summary: loaded.summary,
      group: loaded.group,
      file: loaded.file,
      html: loaded.html,
      sections: loaded.sections.map((s) => ({
        id: s.id,
        title: s.title,
        html: s.html,
      })),
    },
  });
}
