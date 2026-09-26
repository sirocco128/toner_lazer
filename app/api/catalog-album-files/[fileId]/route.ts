import { NextResponse } from "next/server";
import { albumFileIsPublic, readAlbumFileBytes } from "@/lib/catalog-album-repository";
import { requireOpsActor } from "@/lib/ops-auth";
import { parseAlbumFileId } from "@/lib/catalog-album";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { fileId: raw } = await params;
  const fileId = parseAlbumFileId(raw);
  if (!fileId) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const packed = await readAlbumFileBytes(fileId);
  if (!packed) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const published = albumFileIsPublic(packed.file);
  if (!published) {
    const actor = await requireOpsActor("catalog.write");
    if (!actor) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const disposition = packed.file.fileKind === "photo" ? "inline" : "inline";
  const safeName = packed.file.originalName.replace(/[\r\n"]/g, "_");
  return new NextResponse(new Uint8Array(packed.bytes), {
    status: 200,
    headers: {
      "Content-Type": packed.file.contentType,
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": published ? "public, max-age=86400" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
