/**
 * Group files into the same catalog categories used on /catalog.
 * Pure helpers — safe to import from client studio UI.
 */

import {
  OTHER_CATALOG_GROUP_SLUG,
  type CatalogBook,
  type CatalogBookGroup,
  type CatalogBookPage,
  type CatalogFilePage,
} from "@/lib/catalog-book";

export const ALBUM_ID_RE = /^CAB-[A-F0-9]{12}$/;
export const ALBUM_FILE_ID_RE = /^CAF-[A-F0-9]{12}$/;
export const ALBUM_PHOTO_MAX_BYTES = 4_000_000;
export const ALBUM_PDF_MAX_BYTES = 8_000_000;
export const ALBUM_INBOX_MAX_FILES = 80;
export const ALBUM_MAX_PAGES = 200;

export type AlbumLayout = "merged" | "by_group";
export type AlbumSource = "catalog" | "files";
export type AlbumStatus = "published" | "archived";

export type AlbumGroupHint = {
  slug: string;
  name: string;
};

export type AlbumFileInput = {
  fileId: string;
  groupSlug: string;
  originalName: string;
  fileKind: "photo" | "pdf";
  servePath: string;
};

function folderToken(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-");
}

/** First folder in a relative path, ignoring `.` / `..`. */
export function firstFolderName(relativePath: string): string | null {
  const parts = String(relativePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..");
  if (parts.length < 2) return null;
  return parts[0] || null;
}

/**
 * Map a dropped folder name onto a fixed catalog group.
 * Unmatched folders land in `other`.
 */
export function inferGroupSlug(
  relativePath: string,
  groups: AlbumGroupHint[],
): string {
  const folder = firstFolderName(relativePath);
  if (!folder) return OTHER_CATALOG_GROUP_SLUG;
  const token = folderToken(folder);
  if (!token) return OTHER_CATALOG_GROUP_SLUG;
  if (token === OTHER_CATALOG_GROUP_SLUG) return OTHER_CATALOG_GROUP_SLUG;

  const exact = groups.find((group) => group.slug.toLowerCase() === token);
  if (exact) return exact.slug;

  const byName = groups.find(
    (group) => folderToken(group.name) === token || group.name.trim().toLowerCase() === folder.trim().toLowerCase(),
  );
  if (byName) return byName.slug;

  return OTHER_CATALOG_GROUP_SLUG;
}

export function allowedGroupSlug(
  raw: string,
  groups: AlbumGroupHint[],
): string {
  const slug = String(raw || "").trim();
  if (slug === OTHER_CATALOG_GROUP_SLUG) return OTHER_CATALOG_GROUP_SLUG;
  if (groups.some((group) => group.slug === slug)) return slug;
  return OTHER_CATALOG_GROUP_SLUG;
}

export function albumPublicPath(albumId: string): string {
  return `/album/${albumId}`;
}

export function albumFileServePath(fileId: string): string {
  return `/api/catalog-album-files/${fileId}`;
}

export function parseAlbumId(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim().toUpperCase();
  return ALBUM_ID_RE.test(value) ? value : null;
}

export function parseAlbumFileId(raw: string | null | undefined): string | null {
  const value = String(raw || "").trim().toUpperCase();
  return ALBUM_FILE_ID_RE.test(value) ? value : null;
}

function groupLabelFor(
  slug: string,
  groups: AlbumGroupHint[],
): string {
  if (slug === OTHER_CATALOG_GROUP_SLUG) return "กลุ่มอื่น";
  return groups.find((group) => group.slug === slug)?.name || slug;
}

export function groupAlbumFiles(
  files: AlbumFileInput[],
  groups: AlbumGroupHint[],
): CatalogBookGroup[] {
  const buckets = new Map<string, AlbumFileInput[]>();
  for (const file of files) {
    const slug = allowedGroupSlug(file.groupSlug, groups);
    const list = buckets.get(slug) ?? [];
    list.push(file);
    buckets.set(slug, list);
  }

  const ordered: CatalogBookGroup[] = [];
  for (const group of groups) {
    const list = buckets.get(group.slug);
    buckets.delete(group.slug);
    if (!list?.length) continue;
    ordered.push({
      slug: group.slug,
      name: group.name,
      description: `${list.length} ไฟล์ในกลุ่มนี้`,
      heroImage: list.find((item) => item.fileKind === "photo")?.servePath || "",
      products: [],
    });
  }

  const leftover = buckets.get(OTHER_CATALOG_GROUP_SLUG) ?? [];
  if (leftover.length) {
    ordered.push({
      slug: OTHER_CATALOG_GROUP_SLUG,
      name: "กลุ่มอื่น",
      description: "ไฟล์ที่โฟลเดอร์ไม่ตรงกลุ่มที่ fix ไว้",
      heroImage: leftover.find((item) => item.fileKind === "photo")?.servePath || "",
      products: [],
    });
  }

  return ordered;
}

export function buildCatalogBookFromFiles(options: {
  files: AlbumFileInput[];
  groups: AlbumGroupHint[];
  title: string;
  subtitle: string;
  closingTitle: string;
  closingBody: string;
  filterSlug?: string | null;
}): CatalogBook {
  const filterSlug = String(options.filterSlug || "").trim() || null;
  const wanted = filterSlug
    ? options.files.filter((file) => allowedGroupSlug(file.groupSlug, options.groups) === filterSlug)
    : options.files;
  const bookGroups = groupAlbumFiles(wanted, options.groups);
  const fileCount = wanted.length;
  const coverImage =
    wanted.find((file) => file.fileKind === "photo")?.servePath ||
    bookGroups[0]?.heroImage ||
    "";
  const groupLabel =
    filterSlug && bookGroups.length === 1 ? bookGroups[0]!.name : "ทุกกลุ่มสินค้า";

  const pages: CatalogBookPage[] = [
    {
      kind: "cover",
      title: options.title,
      subtitle: options.subtitle,
      image: coverImage,
      groupLabel,
      productCount: fileCount,
    },
  ];

  const filesByGroup = new Map<string, AlbumFileInput[]>();
  for (const file of wanted) {
    const slug = allowedGroupSlug(file.groupSlug, options.groups);
    const list = filesByGroup.get(slug) ?? [];
    list.push(file);
    filesByGroup.set(slug, list);
  }

  for (const group of bookGroups) {
    if (!filterSlug || bookGroups.length > 1) {
      pages.push({
        kind: "section",
        slug: group.slug,
        name: group.name,
        description: group.description,
        image: group.heroImage || coverImage,
        count: filesByGroup.get(group.slug)?.length || 0,
      });
    }
    for (const file of filesByGroup.get(group.slug) ?? []) {
      pages.push(toFilePage(file, groupLabelFor(group.slug, options.groups)));
    }
  }

  pages.push({
    kind: "closing",
    title: options.closingTitle,
    body: options.closingBody,
  });

  return { groups: bookGroups, pages, filterSlug };
}

function toFilePage(file: AlbumFileInput, groupName: string): CatalogFilePage {
  const title = file.originalName.replace(/\.[A-Za-z0-9]+$/, "") || file.originalName;
  if (file.fileKind === "pdf") {
    return {
      kind: "file",
      title,
      groupName,
      originalName: file.originalName,
      fileKind: "pdf",
      href: file.servePath,
    };
  }
  return {
    kind: "file",
    title,
    groupName,
    originalName: file.originalName,
    fileKind: "photo",
    image: file.servePath,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function parseCatalogBookSnapshot(raw: string | unknown): CatalogBook | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(value) || !Array.isArray(value.pages)) return null;
  const pages = value.pages.filter(isCatalogBookPage);
  if (pages.length === 0) return null;
  const groups = Array.isArray(value.groups)
    ? value.groups.filter(isCatalogBookGroup)
    : [];
  const filterSlug =
    typeof value.filterSlug === "string" && value.filterSlug.trim()
      ? value.filterSlug.trim()
      : null;
  return { groups, pages, filterSlug };
}

function isCatalogBookGroup(value: unknown): value is CatalogBookGroup {
  if (!isRecord(value)) return false;
  return (
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.products)
  );
}

function isCatalogBookPage(value: unknown): value is CatalogBookPage {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "cover") {
    return typeof value.title === "string";
  }
  if (value.kind === "section") {
    return typeof value.slug === "string" && typeof value.name === "string";
  }
  if (value.kind === "product") {
    return isRecord(value.product) && typeof value.product.slug === "string";
  }
  if (value.kind === "file") {
    return typeof value.title === "string" && (value.fileKind === "photo" || value.fileKind === "pdf");
  }
  if (value.kind === "closing") {
    return typeof value.title === "string";
  }
  return false;
}
