import { NextResponse } from "next/server";
import {
  archivePdfDocument,
  DOCUMENT_MAX_BYTES,
} from "@/lib/document-archive";
import { recordObjectAccess } from "@/lib/object-access";
import { requireOpsActor } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireOpsActor("documents.write");
  if (!actor) {
    recordObjectAccess({
      action: "object.deny",
      status: "denied",
      kind: "documents",
      request,
      errorMessage: "unauthorized",
    });
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > DOCUMENT_MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileName = String(form.get("fileName") || file.name || "document.pdf");
  try {
    const stored = await archivePdfDocument({ fileName, bytes });
    recordObjectAccess({
      actor,
      action: "object.upload",
      status: "ok",
      kind: "documents",
      key: stored.key,
      resourceId: stored.key,
      purpose: "archive_pdf",
      request,
    });
    return NextResponse.json({
      ok: true,
      key: stored.key,
      backend: stored.backend,
      bucket: stored.bucket,
      sha256: stored.sha256,
      classification: stored.classification,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "archive_failed";
    const status = message === "not_pdf" || message === "too_large" ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
