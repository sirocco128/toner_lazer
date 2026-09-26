/**
 * SQLite publications for ops-created catalog albums.
 */

import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/database";
import { deleteStoredObject } from "@/lib/object-legal-hold";
import { getObject, putObject } from "@/lib/object-storage";
import { sniffBytes } from "@/lib/object-scan";
import {
  ALBUM_FILE_ID_RE,
  ALBUM_ID_RE,
  ALBUM_INBOX_MAX_FILES,
  ALBUM_PDF_MAX_BYTES,
  ALBUM_PHOTO_MAX_BYTES,
  albumFileServePath,
  allowedGroupSlug,
  parseAlbumFileId,
  parseAlbumId,
  parseCatalogBookSnapshot,
  type AlbumFileInput,
  type AlbumGroupHint,
  type AlbumLayout,
  type AlbumSource,
  type AlbumStatus,
} from "@/lib/catalog-album";
import type { CatalogBook } from "@/lib/catalog-book";
import { OTHER_CATALOG_GROUP_SLUG } from "@/lib/catalog-book";

export type CatalogAlbumRecord = {
  albumId: string;
  title: string;
  subtitle: string;
  layout: AlbumLayout;
  source: AlbumSource;
  status: AlbumStatus;
  filterSlug: string | null;
  pageCount: number;
  createdAt: string;
  createdByEmail: string | null;
  archivedAt: string | null;
};

export type CatalogAlbumFileRecord = {
  fileId: string;
  albumId: string | null;
  groupSlug: string;
  originalName: string;
  objectKey: string;
  contentType: string;
  fileKind: "photo" | "pdf";
  byteSize: number;
  sortOrder: number;
  createdAt: string;
  createdByEmail: string | null;
};

type AlbumRow = {
  album_id: string;
  title: string;
  subtitle: string;
  layout: string;
  source: string;
  status: string;
  filter_slug: string | null;
  page_count: number;
  snapshot_json: string;
  created_at: string;
  created_by_email: string | null;
  archived_at: string | null;
};

type FileRow = {
  file_id: string;
  album_id: string | null;
  group_slug: string;
  original_name: string;
  object_key: string;
  content_type: string;
  file_kind: string;
  byte_size: number;
  sort_order: number;
  created_at: string;
  created_by_email: string | null;
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS catalog_albums (
  album_id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  layout TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  filter_slug TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by_email TEXT,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_catalog_albums_created
  ON catalog_albums (created_at DESC);
CREATE TABLE IF NOT EXISTS catalog_album_files (
  file_id TEXT PRIMARY KEY NOT NULL,
  album_id TEXT,
  group_slug TEXT NOT NULL,
  original_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_kind TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by_email TEXT
);
CREATE INDEX IF NOT EXISTS idx_catalog_album_files_inbox
  ON catalog_album_files (album_id, group_slug, sort_order);
`;

let schemaReady = false;

export function ensureCatalogAlbumSchema(): void {
  if (schemaReady) return;
  getDb().exec(SCHEMA_SQL);
  schemaReady = true;
}

function newId(prefix: "CAB" | "CAF"): string {
  return `${prefix}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function mapAlbum(row: AlbumRow): CatalogAlbumRecord {
  return {
    albumId: row.album_id,
    title: row.title,
    subtitle: row.subtitle,
    layout: row.layout === "by_group" ? "by_group" : "merged",
    source: row.source === "files" ? "files" : "catalog",
    status: row.status === "archived" ? "archived" : "published",
    filterSlug: row.filter_slug,
    pageCount: Number(row.page_count) || 0,
    createdAt: row.created_at,
    createdByEmail: row.created_by_email,
    archivedAt: row.archived_at,
  };
}

function mapFile(row: FileRow): CatalogAlbumFileRecord {
  return {
    fileId: row.file_id,
    albumId: row.album_id,
    groupSlug: row.group_slug,
    originalName: row.original_name,
    objectKey: row.object_key,
    contentType: row.content_type,
    fileKind: row.file_kind === "pdf" ? "pdf" : "photo",
    byteSize: Number(row.byte_size) || 0,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    createdByEmail: row.created_by_email,
  };
}

export function listCatalogAlbums(limit = 40): CatalogAlbumRecord[] {
  ensureCatalogAlbumSchema();
  const rows = getDb()
    .prepare(
      `SELECT album_id, title, subtitle, layout, source, status, filter_slug,
              page_count, snapshot_json, created_at, created_by_email, archived_at
       FROM catalog_albums
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(Math.min(Math.max(limit, 1), 100)) as AlbumRow[];
  return rows.map(mapAlbum);
}

export function getCatalogAlbum(albumId: string): CatalogAlbumRecord | null {
  ensureCatalogAlbumSchema();
  const id = parseAlbumId(albumId);
  if (!id) return null;
  const row = getDb()
    .prepare(
      `SELECT album_id, title, subtitle, layout, source, status, filter_slug,
              page_count, snapshot_json, created_at, created_by_email, archived_at
       FROM catalog_albums WHERE album_id = ?`,
    )
    .get(id) as AlbumRow | undefined;
  return row ? mapAlbum(row) : null;
}

export function getCatalogAlbumBook(albumId: string): CatalogBook | null {
  ensureCatalogAlbumSchema();
  const id = parseAlbumId(albumId);
  if (!id) return null;
  const row = getDb()
    .prepare(`SELECT snapshot_json FROM catalog_albums WHERE album_id = ?`)
    .get(id) as { snapshot_json: string } | undefined;
  if (!row) return null;
  return parseCatalogBookSnapshot(row.snapshot_json);
}

export function listInboxAlbumFiles(): CatalogAlbumFileRecord[] {
  ensureCatalogAlbumSchema();
  const rows = getDb()
    .prepare(
      `SELECT file_id, album_id, group_slug, original_name, object_key, content_type,
              file_kind, byte_size, sort_order, created_at, created_by_email
       FROM catalog_album_files
       WHERE album_id IS NULL
       ORDER BY group_slug ASC, sort_order ASC, created_at ASC`,
    )
    .all() as FileRow[];
  return rows.map(mapFile);
}

export function countInboxAlbumFiles(): number {
  ensureCatalogAlbumSchema();
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM catalog_album_files WHERE album_id IS NULL`)
    .get() as { n: number } | undefined;
  return Number(row?.n) || 0;
}

export function toAlbumFileInputs(files: CatalogAlbumFileRecord[]): AlbumFileInput[] {
  return files.map((file) => ({
    fileId: file.fileId,
    groupSlug: file.groupSlug,
    originalName: file.originalName,
    fileKind: file.fileKind,
    servePath: albumFileServePath(file.fileId),
  }));
}

function classifyUpload(bytes: Buffer, originalName: string, contentType: string): {
  fileKind: "photo" | "pdf";
  ext: string;
  mime: string;
  objectKind: "images" | "documents";
} | null {
  const sniffed = sniffBytes(bytes);
  if (sniffed === "jpeg") return { fileKind: "photo", ext: "jpg", mime: "image/jpeg", objectKind: "images" };
  if (sniffed === "png") return { fileKind: "photo", ext: "png", mime: "image/png", objectKind: "images" };
  if (sniffed === "gif") return { fileKind: "photo", ext: "gif", mime: "image/gif", objectKind: "images" };
  if (sniffed === "webp") return { fileKind: "photo", ext: "webp", mime: "image/webp", objectKind: "images" };
  if (sniffed === "pdf") return { fileKind: "pdf", ext: "pdf", mime: "application/pdf", objectKind: "documents" };
  const name = originalName.toLowerCase();
  const mime = contentType.toLowerCase();
  if (name.endsWith(".pdf") || mime.includes("pdf")) return null;
  return null;
}

export async function saveInboxAlbumFile(input: {
  bytes: Buffer;
  originalName: string;
  contentType: string;
  groupSlug: string;
  groups: AlbumGroupHint[];
  createdByEmail: string | null;
}): Promise<CatalogAlbumFileRecord> {
  ensureCatalogAlbumSchema();
  if (countInboxAlbumFiles() >= ALBUM_INBOX_MAX_FILES) {
    throw new Error("inbox_full");
  }
  const classified = classifyUpload(input.bytes, input.originalName, input.contentType);
  if (!classified) throw new Error("file_type_rejected");
  const maxBytes = classified.fileKind === "pdf" ? ALBUM_PDF_MAX_BYTES : ALBUM_PHOTO_MAX_BYTES;
  if (input.bytes.length > maxBytes) throw new Error("too_large");

  const fileId = newId("CAF");
  const groupSlug = allowedGroupSlug(input.groupSlug, input.groups);
  const fileName = `${fileId}.${classified.ext}`;
  const stored = await putObject({
    kind: classified.objectKind,
    fileName: `catalog-albums/${fileName}`,
    bytes: input.bytes,
    contentType: classified.mime,
  });

  const now = new Date().toISOString();
  const sortRow = getDb()
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) AS n
       FROM catalog_album_files WHERE album_id IS NULL AND group_slug = ?`,
    )
    .get(groupSlug) as { n: number } | undefined;

  getDb()
    .prepare(
      `INSERT INTO catalog_album_files (
        file_id, album_id, group_slug, original_name, object_key, content_type,
        file_kind, byte_size, sort_order, created_at, created_by_email
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      fileId,
      groupSlug,
      String(input.originalName || fileName).slice(0, 200),
      stored.key,
      classified.mime,
      classified.fileKind,
      input.bytes.length,
      (Number(sortRow?.n) || 0) + 1,
      now,
      input.createdByEmail,
    );

  const saved = getDb()
    .prepare(
      `SELECT file_id, album_id, group_slug, original_name, object_key, content_type,
              file_kind, byte_size, sort_order, created_at, created_by_email
       FROM catalog_album_files WHERE file_id = ?`,
    )
    .get(fileId) as FileRow;
  return mapFile(saved);
}

export async function deleteInboxAlbumFile(fileId: string): Promise<boolean> {
  ensureCatalogAlbumSchema();
  const id = parseAlbumFileId(fileId);
  if (!id) return false;
  const row = getDb()
    .prepare(
      `SELECT file_id, album_id, group_slug, original_name, object_key, content_type,
              file_kind, byte_size, sort_order, created_at, created_by_email
       FROM catalog_album_files WHERE file_id = ? AND album_id IS NULL`,
    )
    .get(id) as FileRow | undefined;
  if (!row) return false;
  getDb().prepare(`DELETE FROM catalog_album_files WHERE file_id = ?`).run(id);
  try {
    await deleteStoredObject(row.object_key);
  } catch {
    // Keep the inbox row gone even if object cleanup fails.
  }
  return true;
}

export function createCatalogAlbum(input: {
  title: string;
  subtitle: string;
  layout: AlbumLayout;
  source: AlbumSource;
  filterSlug?: string | null;
  book: CatalogBook;
  createdByEmail: string | null;
  assignInboxFileIds?: string[];
}): CatalogAlbumRecord {
  ensureCatalogAlbumSchema();
  const albumId = newId("CAB");
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO catalog_albums (
        album_id, title, subtitle, layout, source, status, filter_slug,
        page_count, snapshot_json, created_at, created_by_email
      ) VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`,
    )
    .run(
      albumId,
      input.title.slice(0, 160),
      input.subtitle.slice(0, 400),
      input.layout,
      input.source,
      input.filterSlug || null,
      input.book.pages.length,
      JSON.stringify(input.book),
      now,
      input.createdByEmail,
    );

  const assign = (input.assignInboxFileIds || [])
    .map((id) => parseAlbumFileId(id))
    .filter((id): id is string => Boolean(id));
  if (assign.length) {
    const stmt = getDb().prepare(
      `UPDATE catalog_album_files SET album_id = ? WHERE file_id = ? AND album_id IS NULL`,
    );
    for (const fileId of assign) {
      stmt.run(albumId, fileId);
    }
  }

  const created = getCatalogAlbum(albumId);
  if (!created) throw new Error("album_create_failed");
  return created;
}

export function archiveCatalogAlbum(albumId: string): boolean {
  ensureCatalogAlbumSchema();
  const id = parseAlbumId(albumId);
  if (!id) return false;
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE catalog_albums
       SET status = 'archived', archived_at = ?
       WHERE album_id = ? AND status = 'published'`,
    )
    .run(now, id);
  return Number(result.changes) > 0;
}

export async function readAlbumFileBytes(fileId: string): Promise<{
  file: CatalogAlbumFileRecord;
  bytes: Buffer;
} | null> {
  ensureCatalogAlbumSchema();
  const id = parseAlbumFileId(fileId);
  if (!id) return null;
  const row = getDb()
    .prepare(
      `SELECT file_id, album_id, group_slug, original_name, object_key, content_type,
              file_kind, byte_size, sort_order, created_at, created_by_email
       FROM catalog_album_files WHERE file_id = ?`,
    )
    .get(id) as FileRow | undefined;
  if (!row) return null;
  const bytes = await getObject(row.object_key);
  if (!bytes) return null;
  return { file: mapFile(row), bytes };
}

export function albumFileIsPublic(file: CatalogAlbumFileRecord): boolean {
  if (!file.albumId) return false;
  const album = getCatalogAlbum(file.albumId);
  return Boolean(album && album.status === "published");
}

export function isAlbumId(value: string): boolean {
  return ALBUM_ID_RE.test(value);
}

export function isAlbumFileId(value: string): boolean {
  return ALBUM_FILE_ID_RE.test(value);
}

export function fallbackOtherGroup(groups: AlbumGroupHint[]): AlbumGroupHint[] {
  if (groups.some((group) => group.slug === OTHER_CATALOG_GROUP_SLUG)) return groups;
  return [
    ...groups,
    { slug: OTHER_CATALOG_GROUP_SLUG, name: "กลุ่มอื่น" },
  ];
}
