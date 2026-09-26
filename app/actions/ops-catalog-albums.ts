"use server";

import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import {
  buildCatalogBookFromFiles,
} from "@/lib/catalog-album";
import {
  archiveCatalogAlbum,
  createCatalogAlbum,
  deleteInboxAlbumFile,
  fallbackOtherGroup,
  listInboxAlbumFiles,
  toAlbumFileInputs,
} from "@/lib/catalog-album-repository";
import { buildCatalogBook, OTHER_CATALOG_GROUP_SLUG } from "@/lib/catalog-book";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta } from "@/lib/ops-request-context";
import { getCategories, getProducts } from "@/lib/strapi";
import {
  FLIP_CATALOG_CLOSING_BODY,
  FLIP_CATALOG_CLOSING_TITLE,
  FLIP_CATALOG_LEAD,
  FLIP_CATALOG_TITLE,
} from "@/lib/ux-copy";

export type CatalogAlbumCreateResult = OpsActionResult & {
  albumIds?: string[];
};

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

async function groupHints() {
  const categories = await getCategories();
  return fallbackOtherGroup(
    categories.map((category) => ({ slug: category.slug, name: category.name })),
  );
}

function selectedSlugs(formData: FormData, allowed: string[]): string[] {
  const raw = String(formData.get("groupSlugs") || "");
  const picked = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allow = new Set(allowed);
  return [...new Set(picked.filter((slug) => allow.has(slug)))];
}

export async function createAlbumsFromCatalogAction(
  _prev: CatalogAlbumCreateResult | null,
  formData: FormData,
): Promise<CatalogAlbumCreateResult> {
  const actor = await requireOpsActor("catalog.write");
  const meta = await opsAuditRequestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์สร้างสมุด" };

  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const allowed = [
    ...categories.map((category) => category.slug),
    OTHER_CATALOG_GROUP_SLUG,
  ];
  const slugs = selectedSlugs(formData, allowed);
  const layout = String(formData.get("layout") || "merged") === "by_group" ? "by_group" : "merged";
  const customTitle = String(formData.get("title") || "").trim();
  if (!slugs.length) return { ok: false, error: "เลือกอย่างน้อยหนึ่งกลุ่มก่อนสร้างสมุด" };
  const created: string[] = [];

  try {
    if (layout === "by_group") {
      for (const slug of slugs) {
        const category = categories.find((item) => item.slug === slug);
        const book = buildCatalogBook({
          products,
          categories,
          filterSlug: slug,
          title: customTitle || `${FLIP_CATALOG_TITLE} · ${category?.name || slug}`,
          subtitle: FLIP_CATALOG_LEAD,
          closingTitle: FLIP_CATALOG_CLOSING_TITLE,
          closingBody: FLIP_CATALOG_CLOSING_BODY,
        });
        if (book.pages.filter((page) => page.kind === "product").length === 0) continue;
        const album = createCatalogAlbum({
          title: book.pages[0] && book.pages[0].kind === "cover" ? book.pages[0].title : slug,
          subtitle: `${todayLabel()} · จากสินค้าในระบบ`,
          layout: "by_group",
          source: "catalog",
          filterSlug: slug,
          book,
          createdByEmail: actor.email,
        });
        created.push(album.albumId);
      }
    } else {
      const filterSlug = slugs.length === 1 ? slugs[0]! : null;
      const book = buildCatalogBook({
        products,
        categories,
        filterSlug,
        title: customTitle || FLIP_CATALOG_TITLE,
        subtitle: FLIP_CATALOG_LEAD,
        closingTitle: FLIP_CATALOG_CLOSING_TITLE,
        closingBody: FLIP_CATALOG_CLOSING_BODY,
      });
      if (book.pages.filter((page) => page.kind === "product" || page.kind === "file").length === 0) {
        return { ok: false, error: "กลุ่มที่เลือกยังไม่มีสินค้าให้สร้างสมุด" };
      }
      const album = createCatalogAlbum({
        title: customTitle || FLIP_CATALOG_TITLE,
        subtitle: `${todayLabel()} · จากสินค้าในระบบ`,
        layout: "merged",
        source: "catalog",
        filterSlug,
        book,
        createdByEmail: actor.email,
      });
      created.push(album.albumId);
    }
  } catch {
    writeOpsAudit({
      actor,
      action: "catalog.album.create",
      status: "denied",
      resourceType: "catalog_album",
      errorMessage: "create_failed",
      ...meta,
    });
    return { ok: false, error: "สร้างสมุดไม่สำเร็จ" };
  }

  if (!created.length) {
    return { ok: false, error: "กลุ่มที่เลือกยังไม่มีสินค้าให้สร้างสมุด" };
  }

  writeOpsAudit({
    actor,
    action: "catalog.album.create",
    status: "ok",
    resourceType: "catalog_album",
    resourceId: created[0],
    detail: { source: "catalog", layout, albumIds: created, slugs },
    ...meta,
  });
  revalidatePath("/ops/catalog-books");
  revalidatePath("/catalog");
  return { ok: true, albumIds: created };
}

export async function createAlbumsFromFilesAction(
  _prev: CatalogAlbumCreateResult | null,
  formData: FormData,
): Promise<CatalogAlbumCreateResult> {
  const actor = await requireOpsActor("catalog.write");
  const meta = await opsAuditRequestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์สร้างสมุด" };

  const groups = await groupHints();
  const inbox = listInboxAlbumFiles();
  if (!inbox.length) return { ok: false, error: "ยังไม่มีไฟล์ในถังกลุ่ม — วางไฟล์ก่อนแล้วค่อยสร้าง" };

  const allowed = groups.map((group) => group.slug);
  const slugs = selectedSlugs(formData, allowed);
  const layout = String(formData.get("layout") || "merged") === "by_group" ? "by_group" : "merged";
  const customTitle = String(formData.get("title") || "").trim();
  if (!slugs.length) return { ok: false, error: "เลือกอย่างน้อยหนึ่งกลุ่มก่อนสร้างสมุด" };
  const selectedFiles = inbox.filter((file) => slugs.includes(file.groupSlug));
  if (!selectedFiles.length) {
    return { ok: false, error: "กลุ่มที่เลือกยังไม่มีไฟล์ในถัง" };
  }

  const created: string[] = [];
  try {
    if (layout === "by_group") {
      for (const slug of slugs) {
        const files = selectedFiles.filter((file) => file.groupSlug === slug);
        if (!files.length) continue;
        const groupName = groups.find((group) => group.slug === slug)?.name || slug;
        const book = buildCatalogBookFromFiles({
          files: toAlbumFileInputs(files),
          groups,
          filterSlug: slug,
          title: customTitle || `อัลบั้ม ${groupName}`,
          subtitle: "ไฟล์ที่จัดตามกลุ่มบนเว็บแล้ว",
          closingTitle: FLIP_CATALOG_CLOSING_TITLE,
          closingBody: FLIP_CATALOG_CLOSING_BODY,
        });
        const album = createCatalogAlbum({
          title: customTitle || `อัลบั้ม ${groupName}`,
          subtitle: `${todayLabel()} · จากไฟล์ที่จัดกลุ่ม`,
          layout: "by_group",
          source: "files",
          filterSlug: slug,
          book,
          createdByEmail: actor.email,
          assignInboxFileIds: files.map((file) => file.fileId),
        });
        created.push(album.albumId);
      }
    } else {
      const book = buildCatalogBookFromFiles({
        files: toAlbumFileInputs(selectedFiles),
        groups,
        title: customTitle || "อัลบั้มแคตตาล็อก",
        subtitle: "ไฟล์ที่จัดตามกลุ่มบนเว็บแล้ว",
        closingTitle: FLIP_CATALOG_CLOSING_TITLE,
        closingBody: FLIP_CATALOG_CLOSING_BODY,
      });
      const album = createCatalogAlbum({
        title: customTitle || "อัลบั้มแคตตาล็อก",
        subtitle: `${todayLabel()} · จากไฟล์ที่จัดกลุ่ม`,
        layout: "merged",
        source: "files",
        book,
        createdByEmail: actor.email,
        assignInboxFileIds: selectedFiles.map((file) => file.fileId),
      });
      created.push(album.albumId);
    }
  } catch {
    writeOpsAudit({
      actor,
      action: "catalog.album.create",
      status: "denied",
      resourceType: "catalog_album",
      errorMessage: "create_from_files_failed",
      ...meta,
    });
    return { ok: false, error: "สร้างสมุดจากไฟล์ไม่สำเร็จ" };
  }

  if (!created.length) return { ok: false, error: "กลุ่มที่เลือกยังไม่มีไฟล์ในถัง" };

  writeOpsAudit({
    actor,
    action: "catalog.album.create",
    status: "ok",
    resourceType: "catalog_album",
    resourceId: created[0],
    detail: { source: "files", layout, albumIds: created, slugs },
    ...meta,
  });
  revalidatePath("/ops/catalog-books");
  return { ok: true, albumIds: created };
}

export async function deleteInboxAlbumFileAction(formData: FormData): Promise<void> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return;
  const fileId = String(formData.get("fileId") || "");
  await deleteInboxAlbumFile(fileId);
  revalidatePath("/ops/catalog-books");
}

export async function archiveCatalogAlbumAction(formData: FormData): Promise<void> {
  const actor = await requireOpsActor("catalog.write");
  const meta = await opsAuditRequestMeta();
  if (!actor) return;
  const albumId = String(formData.get("albumId") || "");
  const ok = archiveCatalogAlbum(albumId);
  writeOpsAudit({
    actor,
    action: "catalog.album.archive",
    status: ok ? "ok" : "denied",
    resourceType: "catalog_album",
    resourceId: albumId,
    ...meta,
  });
  revalidatePath("/ops/catalog-books");
  revalidatePath(`/ops/catalog-books/${albumId}`);
  revalidatePath(`/album/${albumId}`);
}
