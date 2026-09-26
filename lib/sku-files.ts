/**
 * SKU / ori attachments in MinIO (or .data/objects fallback).
 * Photos may go to the public bucket; PDFs/Excel/other stay confidential.
 */

import { randomBytes } from "node:crypto";
import { isAllowlistedAlicdnHost } from "@/lib/alibaba/images";
import { isPdfBuffer } from "@/lib/document-archive";
import { recordObjectAccess } from "@/lib/object-access";
import { deleteStoredObject } from "@/lib/object-legal-hold";
import {
  isMinioConfigured,
  minioConfig,
  putObject,
  getObject,
  type ObjectKind,
} from "@/lib/object-storage";
import { parseProductId } from "@/lib/sku-master-ids";
import { ensureSkuMasterSchema } from "@/lib/sku-master-schema";
import type { SkuFile, SkuFileKind } from "@/lib/sku-master-types";
import {
  smartgiftExec,
  smartgiftQuery,
} from "@/lib/smartgift-mysql";
import type { RowDataPacket } from "mysql2/promise";

export const SKU_FILE_MAX_BYTES = 8_000_000;
export const SKU_PHOTO_MAX_BYTES = 4_000_000;

const FETCH_MS = 15_000;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const DOCUMENT_EXT = new Set(["pdf", "xls", "xlsx", "csv"]);
const OTHER_EXT = new Set(["zip", "doc", "docx"]);

export function skuFileServePath(fileId: number): string {
  return `/api/sku-files/${fileId}`;
}

export function isSkuFileServePath(src: string | null | undefined): boolean {
  return /^\/api\/sku-files\/\d+$/.test(String(src || "").trim());
}

function extensionOf(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name.trim());
  return match?.[1] ? match[1].toLowerCase() : "";
}

function sniffImage(buf: Buffer): { ext: string; contentType: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
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

export function classifySkuUpload(input: {
  originalName: string;
  bytes: Buffer;
  contentType?: string;
}): { kind: SkuFileKind; ext: string; contentType: string; objectKind: ObjectKind } {
  const sniffed = sniffImage(input.bytes);
  if (sniffed) {
    return {
      kind: "photo",
      ext: sniffed.ext,
      contentType: sniffed.contentType,
      objectKind: "images",
    };
  }
  const ext = extensionOf(input.originalName);
  if (isPdfBuffer(input.bytes) || ext === "pdf") {
    return { kind: "document", ext: "pdf", contentType: "application/pdf", objectKind: "documents" };
  }
  if (DOCUMENT_EXT.has(ext)) {
    const contentType =
      ext === "csv"
        ? "text/csv"
        : ext === "xls"
          ? "application/vnd.ms-excel"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return { kind: "document", ext, contentType, objectKind: "documents" };
  }
  if (OTHER_EXT.has(ext)) {
    return {
      kind: "other",
      ext,
      contentType: input.contentType || "application/octet-stream",
      objectKind: "documents",
    };
  }
  throw new Error("unsupported_file");
}

export function assertSkuUploadSize(kind: SkuFileKind, byteSize: number): void {
  const max = kind === "photo" ? SKU_PHOTO_MAX_BYTES : SKU_FILE_MAX_BYTES;
  if (byteSize < 8 || byteSize > max) throw new Error("file_too_large");
}

function allowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "smartgiftthailand.com" || host.endsWith(".smartgiftthailand.com")) {
    return true;
  }
  if (isAllowlistedAlicdnHost(host)) return true;
  const cfg = minioConfig();
  if (cfg) {
    try {
      if (new URL(cfg.endpoint).hostname.toLowerCase() === host) return true;
    } catch {
      // ignore
    }
  }
  const pub = (process.env.MINIO_PUBLIC_BASE_URL || "").trim();
  if (pub) {
    try {
      if (new URL(pub).hostname.toLowerCase() === host) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export function isAllowedSkuRemoteImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return allowedImageHost(url.hostname);
  } catch {
    return false;
  }
}

function mapFile(row: RowDataPacket): SkuFile {
  const id = Number(row.id);
  return {
    id,
    productId: row.product_id ? String(row.product_id) : null,
    oriProductId: row.ori_product_id == null ? null : Number(row.ori_product_id),
    fileKind: (row.file_kind as SkuFileKind) || "other",
    originalName: String(row.original_name),
    objectKey: String(row.object_key),
    bucket: String(row.bucket),
    contentType: String(row.content_type),
    byteSize: Number(row.byte_size || 0),
    isCover: Number(row.is_cover) === 1,
    createdAt: String(row.created_at),
    servePath: skuFileServePath(id),
  };
}

export async function listSkuFiles(filter: {
  productId?: string;
  oriProductId?: number;
}): Promise<SkuFile[]> {
  await ensureSkuMasterSchema();
  const where: string[] = [];
  const params: Record<string, string | number> = {};
  if (filter.productId) {
    const parsed = parseProductId(filter.productId);
    if (!parsed) return [];
    where.push("product_id = :productId");
    params.productId = parsed.stockClass + String(parsed.runningNo).padStart(5, "0");
  }
  if (filter.oriProductId) {
    where.push("ori_product_id = :oriId");
    params.oriId = filter.oriProductId;
  }
  if (where.length === 0) return [];
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT id, product_id, ori_product_id, file_kind, original_name, object_key,
            bucket, content_type, byte_size, is_cover, created_at
     FROM sg_sku_file
     WHERE ${where.join(" AND ")}
     ORDER BY is_cover DESC, id DESC`,
    params,
  );
  return rows.map(mapFile);
}

export async function getSkuFile(fileId: number): Promise<SkuFile | null> {
  await ensureSkuMasterSchema();
  const id = Number(fileId);
  if (!Number.isInteger(id) || id < 1) return null;
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT id, product_id, ori_product_id, file_kind, original_name, object_key,
            bucket, content_type, byte_size, is_cover, created_at
     FROM sg_sku_file WHERE id = :id LIMIT 1`,
    { id },
  );
  return rows[0] ? mapFile(rows[0]) : null;
}

export async function readSkuFileBytes(fileId: number): Promise<{
  file: SkuFile;
  bytes: Buffer;
} | null> {
  const file = await getSkuFile(fileId);
  if (!file) return null;
  const bytes = await getObject(file.objectKey);
  if (!bytes) return null;
  return { file, bytes };
}

async function insertFileRow(input: {
  productId: string | null;
  oriProductId: number | null;
  kind: SkuFileKind;
  originalName: string;
  objectKey: string;
  bucket: string;
  contentType: string;
  byteSize: number;
  isCover: boolean;
}): Promise<number> {
  const result = await smartgiftExec(
    `INSERT INTO sg_sku_file (
       product_id, ori_product_id, file_kind, original_name, object_key, bucket,
       content_type, byte_size, is_cover
     ) VALUES (
       :product_id, :ori_product_id, :file_kind, :original_name, :object_key, :bucket,
       :content_type, :byte_size, :is_cover
     )`,
    {
      product_id: input.productId,
      ori_product_id: input.oriProductId,
      file_kind: input.kind,
      original_name: input.originalName.slice(0, 255),
      object_key: input.objectKey,
      bucket: input.bucket,
      content_type: input.contentType,
      byte_size: input.byteSize,
      is_cover: input.isCover ? 1 : 0,
    },
  );
  return Number(result.insertId);
}

async function setCoverExclusive(productId: string, fileId: number): Promise<void> {
  await smartgiftExec(
    `UPDATE sg_sku_file SET is_cover = 0 WHERE product_id = :productId`,
    { productId },
  );
  await smartgiftExec(
    `UPDATE sg_sku_file SET is_cover = 1 WHERE id = :id AND product_id = :productId`,
    { id: fileId, productId },
  );
  await smartgiftExec(
    `UPDATE sg_sku SET image_url = :image_url WHERE product_id = :productId`,
    { productId, image_url: skuFileServePath(fileId) },
  );
}

export async function saveSkuUpload(input: {
  productId?: string | null;
  oriProductId?: number | null;
  originalName: string;
  bytes: Buffer;
  contentType?: string;
  setCover?: boolean;
}): Promise<SkuFile> {
  await ensureSkuMasterSchema();
  const parsed = input.productId ? parseProductId(input.productId) : null;
  const productId = parsed
    ? parsed.stockClass + String(parsed.runningNo).padStart(5, "0")
    : null;
  const oriProductId = input.oriProductId && Number(input.oriProductId) > 0
    ? Number(input.oriProductId)
    : null;
  if (!productId && !oriProductId) throw new Error("missing_owner");

  const classified = classifySkuUpload({
    originalName: input.originalName,
    bytes: input.bytes,
    contentType: input.contentType,
  });
  assertSkuUploadSize(classified.kind, input.bytes.length);

  const token = randomBytes(4).toString("hex");
  const owner = productId || `ori${oriProductId}`;
  const fileName = `${owner}/${Date.now()}-${token}.${classified.ext}`;
  const stored = await putObject({
    kind: classified.objectKind,
    fileName,
    bytes: input.bytes,
    contentType: classified.contentType,
    publicBucket: classified.kind === "photo",
  });

  const makeCover = Boolean(input.setCover && classified.kind === "photo" && productId);
  const id = await insertFileRow({
    productId,
    oriProductId,
    kind: classified.kind,
    originalName: input.originalName || fileName,
    objectKey: stored.key,
    bucket: stored.bucket,
    contentType: classified.contentType,
    byteSize: input.bytes.length,
    isCover: makeCover,
  });
  if (makeCover && productId) {
    await setCoverExclusive(productId, id);
  }
  const saved = await getSkuFile(id);
  if (!saved) throw new Error("file_not_created");
  if (classified.kind !== "photo") {
    recordObjectAccess({
      action: "object.upload",
      status: "ok",
      kind: classified.objectKind,
      key: stored.key,
      resourceId: String(id),
      purpose: "sku_file",
    });
  }
  return saved;
}

export async function ingestRemoteSkuImage(input: {
  productId: string;
  imageUrl: string;
}): Promise<SkuFile | null> {
  const url = String(input.imageUrl || "").trim();
  if (!url || isSkuFileServePath(url)) return null;
  if (!isAllowedSkuRemoteImageUrl(url)) throw new Error("image_host_not_allowed");
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "User-Agent": BROWSER_UA,
    },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!response.ok) throw new Error("image_fetch_failed");
  const bytes = Buffer.from(await response.arrayBuffer());
  const name = url.split("?")[0]?.split("/").pop() || "cover.jpg";
  return saveSkuUpload({
    productId: input.productId,
    originalName: name,
    bytes,
    contentType: response.headers.get("content-type") || undefined,
    setCover: true,
  });
}

export async function setSkuFileCover(fileId: number): Promise<void> {
  const file = await getSkuFile(fileId);
  if (!file) throw new Error("file_not_found");
  if (file.fileKind !== "photo") throw new Error("not_a_photo");
  if (!file.productId) throw new Error("photo_needs_sku");
  await setCoverExclusive(file.productId, file.id);
}

export async function deleteSkuFile(fileId: number): Promise<void> {
  const file = await getSkuFile(fileId);
  if (!file) throw new Error("file_not_found");
  await deleteStoredObject(file.objectKey);
  recordObjectAccess({
    action: "object.delete",
    status: "ok",
    kind: file.fileKind === "photo" ? "images" : "documents",
    key: file.objectKey,
    resourceId: String(file.id),
    purpose: "sku_file",
  });
  if (file.isCover && file.productId) {
    await smartgiftExec(
      `UPDATE sg_sku SET image_url = NULL
       WHERE product_id = :productId AND image_url = :image_url`,
      { productId: file.productId, image_url: file.servePath },
    );
  }
  await smartgiftExec(`DELETE FROM sg_sku_file WHERE id = :id`, { id: file.id });
}

export function skuStorageLabel(): string {
  return isMinioConfigured() ? "MinIO" : "ดิสก์เครื่องนี้";
}
