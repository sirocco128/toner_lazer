import { NextResponse } from "next/server";
import { inferGroupSlug } from "@/lib/catalog-album";
import { fallbackOtherGroup, saveInboxAlbumFile } from "@/lib/catalog-album-repository";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta } from "@/lib/ops-request-context";
import { getCategories } from "@/lib/strapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const actor = await requireOpsActor("catalog.write");
  const meta = await opsAuditRequestMeta();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "อ่านไฟล์ไม่สำเร็จ" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "ไม่มีไฟล์" }, { status: 400 });
  }

  const categories = await getCategories();
  const groups = fallbackOtherGroup(
    categories.map((category) => ({ slug: category.slug, name: category.name })),
  );
  const relativePath = String(form.get("relativePath") || file.name);
  const explicitGroup = String(form.get("groupSlug") || "").trim();
  const groupSlug = explicitGroup || inferGroupSlug(relativePath, groups);

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const saved = await saveInboxAlbumFile({
      bytes,
      originalName: file.name,
      contentType: file.type || "application/octet-stream",
      groupSlug,
      groups,
      createdByEmail: actor.email,
    });
    writeOpsAudit({
      actor,
      action: "catalog.album.upload",
      status: "ok",
      resourceType: "catalog_album_file",
      resourceId: saved.fileId,
      detail: { groupSlug: saved.groupSlug, fileKind: saved.fileKind },
      ...meta,
    });
    return NextResponse.json({
      ok: true,
      file: {
        fileId: saved.fileId,
        groupSlug: saved.groupSlug,
        originalName: saved.originalName,
        fileKind: saved.fileKind,
        byteSize: saved.byteSize,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "upload_failed";
    const message =
      code === "inbox_full"
        ? "ถังไฟล์เต็มแล้ว (สูงสุด 80 ไฟล์) — สร้างสมุดก่อนแล้วค่อยวางต่อ"
        : code === "too_large"
          ? "ไฟล์ใหญ่เกิน รูปไม่เกิน 4MB PDF ไม่เกิน 8MB"
          : code === "file_type_rejected"
            ? "รับเฉพาะ JPG PNG WEBP GIF และ PDF"
            : "อัปโหลดไม่สำเร็จ";
    writeOpsAudit({
      actor,
      action: "catalog.album.upload",
      status: "denied",
      resourceType: "catalog_album_file",
      errorMessage: code,
      ...meta,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
