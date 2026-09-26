import { NextResponse } from "next/server";
import { readCatalogSourceImageFile } from "@/lib/catalog-source-images";
import { requireOpsSession } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ imageId: string }> };

export async function GET(_request: Request, { params }: Params) {
  if (!(await requireOpsSession())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { imageId } = await params;
  if (!/^CSI-[A-F0-9]{12}$/.test(imageId)) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const file = await readCatalogSourceImageFile(imageId);
  if (!file) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": file.record.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
