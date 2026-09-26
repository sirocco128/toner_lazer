/**
 * Persist 1688 / Alibaba listing photos into SQLite + object storage (ops-only).
 * Files live in MinIO (images/) or .data/objects/images and are not public catalog media.
 */

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { getDb, getSqlitePath } from "@/lib/database";
import { extractOfferImages } from "@/lib/alibaba/images";
import {
  normalizeAlibabaListingUrl,
  type SourceImageCandidate,
  type SourcePlatform,
} from "@/lib/alibaba/listing-urls";
import { deleteStoredObject } from "@/lib/object-legal-hold";
import { getObject, objectKey, putObject } from "@/lib/object-storage";

const MAX_IMAGE_BYTES = 4_000_000;
const FETCH_MS = 15_000;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type CatalogSourceImage = {
  id: number;
  imageId: string;
  productSlug: string | null;
  query: string;
  sourcePlatform: SourcePlatform;
  sourcePageUrl: string;
  sourceImageUrl: string;
  localPath: string;
  contentType: string;
  byteSize: number;
  title: string;
  status: "saved";
  createdAt: string;
  createdByEmail: string | null;
  geminiModel: string | null;
};

type Row = {
  id: number;
  image_id: string;
  product_slug: string | null;
  query: string;
  source_platform: string;
  source_page_url: string;
  source_image_url: string;
  local_path: string;
  content_type: string;
  byte_size: number;
  title: string;
  status: string;
  created_at: string;
  created_by_email: string | null;
  gemini_model: string | null;
};

function mapRow(row: Row): CatalogSourceImage {
  return {
    id: row.id,
    imageId: row.image_id,
    productSlug: row.product_slug,
    query: row.query,
    sourcePlatform: row.source_platform === "alibaba" ? "alibaba" : "1688",
    sourcePageUrl: row.source_page_url,
    sourceImageUrl: row.source_image_url,
    localPath: row.local_path,
    contentType: row.content_type,
    byteSize: row.byte_size,
    title: row.title,
    status: "saved",
    createdAt: row.created_at,
    createdByEmail: row.created_by_email,
    geminiModel: row.gemini_model,
  };
}

export function catalogImagesDir(): string {
  return path.join(path.dirname(getSqlitePath()), "catalog-images");
}

export function absoluteCatalogImagePath(localPath: string): string {
  const base = catalogImagesDir();
  const resolved = path.resolve(base, path.basename(localPath));
  if (!resolved.startsWith(base)) {
    throw new Error("Invalid catalog image path");
  }
  return resolved;
}

function sniffImage(buf: Buffer): { ext: string; contentType: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { ext: "gif", contentType: "image/gif" };
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

export async function downloadAllowlistedImage(
  imageUrl: string,
  pageUrl: string,
): Promise<{ buffer: Buffer; contentType: string; ext: string } | null> {
  const allowed = extractOfferImages(imageUrl).at(0);
  const listing = normalizeAlibabaListingUrl(pageUrl);
  if (!allowed || !listing) return null;
  try {
    const response = await fetch(allowed, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent": BROWSER_UA,
        Referer: listing,
      },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (!response.ok) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength < 32 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    const sniffed = sniffImage(buf);
    if (!sniffed) return null;
    return { buffer: buf, contentType: sniffed.contentType, ext: sniffed.ext };
  } catch {
    return null;
  }
}

export function listCatalogSourceImages(limit = 40): CatalogSourceImage[] {
  try {
    const rows = getDb()
      .prepare(
        `SELECT id, image_id, product_slug, query, source_platform, source_page_url,
                source_image_url, local_path, content_type, byte_size, title, status,
                created_at, created_by_email, gemini_model
         FROM catalog_source_images
         WHERE status = 'saved'
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as Row[];
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

export function getCatalogSourceImageByImageId(imageId: string): CatalogSourceImage | null {
  try {
    const row = getDb()
      .prepare(
        `SELECT id, image_id, product_slug, query, source_platform, source_page_url,
                source_image_url, local_path, content_type, byte_size, title, status,
                created_at, created_by_email, gemini_model
         FROM catalog_source_images WHERE image_id = ?`,
      )
      .get(imageId) as Row | undefined;
    return row ? mapRow(row) : null;
  } catch {
    return null;
  }
}

export async function readCatalogSourceImageFile(imageId: string): Promise<{
  record: CatalogSourceImage;
  bytes: Buffer;
} | null> {
  const record = getCatalogSourceImageByImageId(imageId);
  if (!record) return null;
  const stored = await getObject(objectKey("images", record.localPath));
  if (stored) return { record, bytes: stored };
  const abs = absoluteCatalogImagePath(record.localPath);
  if (!existsSync(abs)) return null;
  return { record, bytes: readFileSync(abs) };
}

export type SaveCatalogSourceImageInput = {
  candidate: SourceImageCandidate;
  query: string;
  productSlug?: string | null;
  actorEmail?: string | null;
  geminiModel?: string | null;
};

export async function saveCatalogSourceImage(
  input: SaveCatalogSourceImageInput,
): Promise<CatalogSourceImage | null> {
  const downloaded = await downloadAllowlistedImage(
    input.candidate.imageUrl,
    input.candidate.pageUrl,
  );
  if (!downloaded) return null;

  const imageId = `CSI-${randomBytes(6).toString("hex").toUpperCase()}`;
  const filename = `${imageId}.${downloaded.ext}`;
  await putObject({
    kind: "images",
    fileName: filename,
    bytes: downloaded.buffer,
    contentType: downloaded.contentType,
  });

  const now = new Date().toISOString();
  const checksum = createHash("sha256").update(downloaded.buffer).digest("hex");
  getDb()
    .prepare(
      `INSERT INTO catalog_source_images (
        image_id, product_slug, query, source_platform, source_page_url, source_image_url,
        local_path, content_type, byte_size, checksum_sha256, title, status, created_at,
        created_by_email, gemini_model
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'saved', ?, ?, ?)`,
    )
    .run(
      imageId,
      input.productSlug?.trim() || null,
      input.query.trim().slice(0, 200),
      input.candidate.platform,
      input.candidate.pageUrl,
      input.candidate.imageUrl,
      filename,
      downloaded.contentType,
      downloaded.buffer.byteLength,
      checksum,
      input.candidate.title.slice(0, 240),
      now,
      input.actorEmail ?? null,
      input.geminiModel ?? null,
    );

  return getCatalogSourceImageByImageId(imageId);
}

export async function deleteCatalogSourceImage(imageId: string): Promise<boolean> {
  const record = getCatalogSourceImageByImageId(imageId);
  if (!record) return false;
  try {
    const abs = absoluteCatalogImagePath(record.localPath);
    if (existsSync(abs)) unlinkSync(abs);
  } catch {
    // keep going — row still removed
  }
  try {
    await deleteStoredObject(objectKey("images", record.localPath));
  } catch {
    // keep going — row still removed
  }
  getDb().prepare(`DELETE FROM catalog_source_images WHERE image_id = ?`).run(imageId);
  return true;
}

export function slugLooksSafe(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;
}
