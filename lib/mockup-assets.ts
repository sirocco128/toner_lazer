/**
 * Persist mockup master files in MinIO (or .data/objects) for ops + factory handoff.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { getSqlitePath } from "@/lib/database";
import {
  estimateDataUrlBytes,
  isJpegOrPngDataUrl,
  MOCKUP_PACKAGE_MAX_FILE_BYTES,
  type MockupPackage,
  type MockupPackageRole,
} from "@/lib/mockup-package";
import { localObjectsDir, putObject } from "@/lib/object-storage";

export type PersistedMockupAsset = {
  role: MockupPackageRole;
  fileName: string;
  absolutePath: string;
  relativePath: string;
  bytes: number;
  label: string;
};

export type PersistMockupResult = {
  requestId: string;
  dirRelative: string;
  assets: PersistedMockupAsset[];
  manifestRelative: string;
};

function dataDirRoot(): string {
  return path.dirname(getSqlitePath());
}

export function mockupAssetsDir(requestId: string): string {
  const safe = requestId.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(dataDirRoot(), "mockup-assets", safe);
}

function mockupObjectDir(requestId: string): string {
  const safe = requestId.replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(localObjectsDir(), "mockups", safe);
}

function resolveMockupDir(requestId: string): string {
  const objectDir = mockupObjectDir(requestId);
  if (existsSync(objectDir)) return objectDir;
  return mockupAssetsDir(requestId);
}

function decodeDataUrl(dataUrl: string): { ext: "jpg" | "png"; buffer: Buffer } {
  const match = /^data:image\/(jpeg|jpg|png);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error("Invalid mockup data URL");
  const kind = match[1]!.toLowerCase();
  const ext = kind === "png" ? "png" : "jpg";
  return { ext, buffer: Buffer.from(match[2]!, "base64") };
}

function uploadSecret(): string {
  const secret =
    (process.env.ADMIN_SESSION_SECRET || "").trim() ||
    (process.env.IP_HASH_SECRET || "").trim();
  if (secret.length >= 16) return secret;
  return "dev-only-mockup-upload-secret";
}

export function createMockupUploadToken(
  requestId: string,
  now = Date.now(),
): string {
  const exp = now + 15 * 60 * 1000;
  const payload = `${requestId}.${exp}`;
  const sig = createHmac("sha256", uploadSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyMockupUploadToken(
  requestId: string,
  token: string,
  now = Date.now(),
): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [id, expRaw, sig] = parts;
  if (id !== requestId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < now) return false;
  const payload = `${id}.${expRaw}`;
  const expected = createHmac("sha256", uploadSecret()).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig!, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function persistMockupPackage(
  requestId: string,
  pkg: MockupPackage,
): Promise<PersistMockupResult> {
  const safe = requestId.replace(/[^A-Za-z0-9._-]/g, "_");
  const dir = mockupObjectDir(requestId);

  const assets: PersistedMockupAsset[] = [];
  for (const file of pkg.files) {
    if (!isJpegOrPngDataUrl(file.dataUrl)) {
      throw new Error(`Invalid image for ${file.role}`);
    }
    const bytes = estimateDataUrlBytes(file.dataUrl);
    if (bytes <= 0 || bytes > MOCKUP_PACKAGE_MAX_FILE_BYTES) {
      throw new Error(`Image too large for ${file.role}`);
    }
    const decoded = decodeDataUrl(file.dataUrl);
    const fileName =
      file.role === "customer_master"
        ? `customer-master.${decoded.ext}`
        : `factory-prep.${decoded.ext}`;
    await putObject({
      kind: "mockups",
      fileName: `${safe}/${fileName}`,
      bytes: decoded.buffer,
      contentType: decoded.ext === "png" ? "image/png" : "image/jpeg",
    });
    const absolutePath = path.join(dir, fileName);
    assets.push({
      role: file.role,
      fileName,
      absolutePath,
      relativePath: path.relative(process.cwd(), absolutePath),
      bytes: decoded.buffer.length,
      label: file.label,
    });
  }

  const manifest = {
    requestId,
    savedAt: new Date().toISOString(),
    productName: pkg.productName,
    surfaceLabel: pkg.surfaceLabel,
    colorLabel: pkg.colorLabel,
    brief: pkg.brief,
    files: assets.map((a) => ({
      role: a.role,
      fileName: a.fileName,
      bytes: a.bytes,
      label: a.label,
    })),
  };
  const manifestPath = path.join(dir, "manifest.json");
  await putObject({
    kind: "mockups",
    fileName: `${safe}/manifest.json`,
    bytes: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    contentType: "application/json",
  });

  return {
    requestId,
    dirRelative: path.relative(process.cwd(), dir),
    assets,
    manifestRelative: path.relative(process.cwd(), manifestPath),
  };
}

export function listMockupAssets(requestId: string): PersistedMockupAsset[] {
  const dir = resolveMockupDir(requestId);
  if (!existsSync(dir)) return [];
  const manifestPath = path.join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return readdirSync(dir)
      .filter((name) => /\.(jpe?g|png)$/i.test(name))
      .map((fileName) => ({
        role: fileName.startsWith("factory")
          ? ("factory_prep" as const)
          : ("customer_master" as const),
        fileName,
        absolutePath: path.join(dir, fileName),
        relativePath: path.relative(process.cwd(), path.join(dir, fileName)),
        bytes: 0,
        label: fileName,
      }));
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    files?: Array<{
      role: MockupPackageRole;
      fileName: string;
      bytes: number;
      label: string;
    }>;
  };
  return (manifest.files || []).map((file) => ({
    role: file.role,
    fileName: file.fileName,
    absolutePath: path.join(dir, file.fileName),
    relativePath: path.relative(process.cwd(), path.join(dir, file.fileName)),
    bytes: file.bytes,
    label: file.label,
  }));
}

export function readMockupAssetFile(
  requestId: string,
  fileName: string,
): { absolutePath: string; contentType: string } | null {
  if (!/^(customer-master|factory-prep)\.(jpe?g|png)$/i.test(fileName)) {
    return null;
  }
  const absolutePath = path.join(resolveMockupDir(requestId), fileName);
  if (!existsSync(absolutePath)) return null;
  const lower = fileName.toLowerCase();
  const contentType = lower.endsWith(".png") ? "image/png" : "image/jpeg";
  return { absolutePath, contentType };
}

export function salesNotesForMockupAssets(result: PersistMockupResult): string {
  const lines = [
    "— ไฟล์ต้นแบบ mockup —",
    `โฟลเดอร์: ${result.dirRelative}`,
  ];
  for (const asset of result.assets) {
    lines.push(`${asset.label}: ${asset.fileName}`);
  }
  lines.push("ลูกค้า: ใช้ไฟล์ customer-master แนบใบเสนอราคา");
  lines.push("โรงงาน: ใช้ไฟล์ factory-prep เป็นต้นฉบับงานสกรีน (ยังต้องตรวจไฟล์โลโก้จริง)");
  return lines.join("\n");
}
