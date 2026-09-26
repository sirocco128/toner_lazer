import { NextResponse } from "next/server";
import { recordObjectAccess } from "@/lib/object-access";
import { readSkuFileBytes } from "@/lib/sku-files";
import { requireOpsActor } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ fileId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { fileId: raw } = await params;
  const fileId = Number(raw);
  if (!Number.isInteger(fileId) || fileId < 1) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const packed = await readSkuFileBytes(fileId);
  if (!packed) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  if (packed.file.fileKind !== "photo") {
    const actor = await requireOpsActor("documents.read");
    if (!actor) {
      recordObjectAccess({
        action: "object.deny",
        status: "denied",
        kind: "documents",
        key: packed.file.objectKey,
        resourceId: String(packed.file.id),
        request,
        errorMessage: "unauthorized",
      });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    recordObjectAccess({
      actor,
      action: "object.download",
      status: "ok",
      kind: "documents",
      key: packed.file.objectKey,
      resourceId: String(packed.file.id),
      purpose: "sku_document",
      request,
    });
  }

  const disposition = packed.file.fileKind === "photo" ? "inline" : "attachment";
  const safeName = packed.file.originalName.replace(/[\r\n"]/g, "_");
  return new NextResponse(new Uint8Array(packed.bytes), {
    status: 200,
    headers: {
      "Content-Type": packed.file.contentType,
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control":
        packed.file.fileKind === "photo"
          ? "public, max-age=86400"
          : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
