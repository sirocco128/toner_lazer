/**
 * S3-compatible object store (MinIO in Docker, or local .data/objects fallback).
 *
 * Prefixes: images/ documents/ slips/ mockups/
 * Classification: public / internal / confidential / restricted
 * Customer documents and slips never go to the public bucket.
 */

import { createHash, createHmac } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { scanUpload } from "@/lib/object-scan";

export const OBJECT_KINDS = ["images", "documents", "slips", "mockups"] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

export const OBJECT_CLASSES = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const;
export type ObjectClass = (typeof OBJECT_CLASSES)[number];

export type StoredObject = {
  key: string;
  bucket: string;
  backend: "minio" | "local";
  contentType: string;
  byteSize: number;
  sha256: string;
  classification: ObjectClass;
};

type MinioConfig = {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  region: string;
  bucketPrivate: string;
  bucketPublic: string;
  bucketConfidential: string;
  bucketRestricted: string;
};

function dataRoot(): string {
  const sqlite = (process.env.SQLITE_PATH || ".data/leads.sqlite").trim();
  const abs = path.isAbsolute(sqlite)
    ? sqlite
    : path.join(process.cwd(), sqlite);
  return path.dirname(abs);
}

export function localObjectsDir(): string {
  return path.join(dataRoot(), "objects");
}

export function objectKey(kind: ObjectKind, fileName: string): string {
  const safe = String(fileName || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, "_"))
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  if (!safe) throw new Error("invalid_object_key");
  return `${kind}/${safe}`;
}

export function kindFromObjectKey(key: string): ObjectKind | null {
  const prefix = String(key || "").split("/")[0] ?? "";
  return (OBJECT_KINDS as readonly string[]).includes(prefix)
    ? (prefix as ObjectKind)
    : null;
}

export function allowPublicBucket(kind: ObjectKind): boolean {
  return kind === "images";
}

export function objectClassForKind(
  kind: ObjectKind,
  publicBucket = false,
): ObjectClass {
  if (kind === "slips") return "restricted";
  if (kind === "documents") return "confidential";
  if (kind === "mockups") return "internal";
  if (kind === "images" && publicBucket) return "public";
  return "internal";
}

export function isRestrictedKind(kind: ObjectKind): boolean {
  return objectClassForKind(kind) === "restricted";
}

export function signedUrlTtlSeconds(requested?: number): number {
  const fromEnv = Number(process.env.MINIO_SIGNED_URL_TTL || "300");
  const fallback = Number.isFinite(fromEnv) ? fromEnv : 300;
  const ttl = requested ?? fallback;
  return Math.min(Math.max(Math.trunc(ttl), 30), 600);
}

export function minioConfig(): MinioConfig | null {
  const endpoint = (process.env.MINIO_ENDPOINT || "").trim().replace(/\/+$/, "");
  const accessKey = (process.env.MINIO_ACCESS_KEY || "").trim();
  const secretKey = (process.env.MINIO_SECRET_KEY || "").trim();
  if (!endpoint || !accessKey || !secretKey) return null;
  const bucketPrivate =
    (process.env.MINIO_BUCKET_PRIVATE || "terabis-private").trim() ||
    "terabis-private";
  return {
    endpoint,
    accessKey,
    secretKey,
    region: (process.env.MINIO_REGION || "us-east-1").trim() || "us-east-1",
    bucketPrivate,
    bucketPublic:
      (process.env.MINIO_BUCKET_PUBLIC || "terabis-public").trim() ||
      "terabis-public",
    bucketConfidential:
      (process.env.MINIO_BUCKET_CONFIDENTIAL || "terabis-confidential").trim() ||
      bucketPrivate,
    bucketRestricted:
      (process.env.MINIO_BUCKET_RESTRICTED || "terabis-restricted").trim() ||
      bucketPrivate,
  };
}

export function publicObjectUrl(key: string): string | null {
  const kind = kindFromObjectKey(key);
  if (kind && !allowPublicBucket(kind)) return null;
  const base = (process.env.MINIO_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!base) return null;
  const pathPart = key
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${base}/${pathPart}`;
}

export function isMinioConfigured(): boolean {
  return Boolean(minioConfig());
}

export function appUsesMinioRoot(): boolean {
  const cfg = minioConfig();
  if (!cfg) return false;
  const rootUser = (process.env.MINIO_ROOT_USER || "").trim();
  return Boolean(rootUser) && cfg.accessKey === rootUser;
}

function localPathFor(key: string): string {
  const root = path.resolve(localObjectsDir());
  const resolved = path.resolve(root, key);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("invalid_object_key");
  }
  return resolved;
}

export function objectSha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function amzDate(now: Date): { amz: string; stamp: string } {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { amz: iso, stamp: iso.slice(0, 8) };
}

function awsUriEncode(value: string, encodeSlash: boolean): string {
  let out = "";
  for (const char of value) {
    if (
      (char >= "A" && char <= "Z") ||
      (char >= "a" && char <= "z") ||
      (char >= "0" && char <= "9") ||
      char === "_" ||
      char === "-" ||
      char === "~" ||
      char === "."
    ) {
      out += char;
    } else if (char === "/" && !encodeSlash) {
      out += "/";
    } else {
      out += `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return out;
}

function signingKey(secret: string, stamp: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secret}`, stamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function objectPath(bucket: string, key: string): string {
  return `/${bucket}/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

export function bucketForObject(
  kind: ObjectKind,
  publicBucket = false,
  cfg: MinioConfig | null = minioConfig(),
): string {
  const classification = objectClassForKind(kind, publicBucket && allowPublicBucket(kind));
  if (!cfg) return "local";
  if (classification === "public") return cfg.bucketPublic;
  if (classification === "confidential") return cfg.bucketConfidential;
  if (classification === "restricted") return cfg.bucketRestricted;
  return cfg.bucketPrivate;
}

function bucketsToRead(key: string, cfg: MinioConfig): string[] {
  const kind = kindFromObjectKey(key);
  const ordered: string[] = [];
  const push = (name: string) => {
    if (name && !ordered.includes(name)) ordered.push(name);
  };
  if (kind === "slips") {
    push(cfg.bucketRestricted);
    push(cfg.bucketPrivate);
  } else if (kind === "documents") {
    push(cfg.bucketConfidential);
    push(cfg.bucketPrivate);
  } else if (kind === "images") {
    push(cfg.bucketPublic);
    push(cfg.bucketPrivate);
  } else {
    push(cfg.bucketPrivate);
    push(cfg.bucketConfidential);
  }
  return ordered;
}

function persistLocalCopy(classification: ObjectClass): boolean {
  return classification === "public" || classification === "internal";
}

function sseEnabled(): boolean {
  const raw = (process.env.MINIO_SSE || "AES256").trim().toUpperCase();
  return raw !== "OFF" && raw !== "0" && raw !== "FALSE";
}

export function objectLockEnabled(): boolean {
  const raw = (process.env.MINIO_OBJECT_LOCK || "1").trim().toUpperCase();
  return raw !== "OFF" && raw !== "0" && raw !== "FALSE";
}

export function retentionUntilIso(now = new Date()): string | null {
  const days = Number(process.env.MINIO_RETENTION_DAYS || "0");
  if (!Number.isFinite(days) || days <= 0) return null;
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return until.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function canonicalQueryString(query?: Record<string, string>): string {
  if (!query) return "";
  return Object.keys(query)
    .sort()
    .map((name) => `${awsUriEncode(name, true)}=${awsUriEncode(query[name] ?? "", true)}`)
    .join("&");
}

async function s3Fetch(input: {
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  bucket: string;
  key: string;
  body?: Buffer;
  contentType?: string;
  extraHeaders?: Record<string, string>;
  query?: Record<string, string>;
}): Promise<{ status: number; body: Buffer }> {
  const cfg = minioConfig();
  if (!cfg) throw new Error("minio_not_configured");
  const url = new URL(cfg.endpoint);
  const pathName = objectPath(input.bucket, input.key);
  const qs = canonicalQueryString(input.query);
  const { amz, stamp } = amzDate(new Date());
  const payload = input.body || Buffer.alloc(0);
  const payloadHash = objectSha256(payload);
  const host = url.port ? `${url.hostname}:${url.port}` : url.hostname;
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
    ...(input.extraHeaders || {}),
  };
  if (input.contentType && input.method === "PUT") {
    headers["content-type"] = input.contentType;
  }
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name]}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [
    input.method,
    pathName,
    qs,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${stamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    scope,
    objectSha256(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(cfg.secretKey, stamp, cfg.region))
    .update(stringToSign, "utf8")
    .digest("hex");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`${cfg.endpoint}${pathName}${qs ? `?${qs}` : ""}`, {
    method: input.method,
    headers,
    body: input.method === "PUT" ? new Uint8Array(payload) : undefined,
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { status: response.status, body: bytes };
}

export function createPresignedGetUrl(input: {
  key: string;
  bucket?: string;
  ttlSeconds?: number;
  now?: Date;
}): string {
  const cfg = minioConfig();
  if (!cfg) throw new Error("minio_not_configured");
  const kind = kindFromObjectKey(input.key) || "documents";
  const bucket = input.bucket || bucketForObject(kind, false, cfg);
  const ttl = signedUrlTtlSeconds(input.ttlSeconds);
  const now = input.now || new Date();
  const { amz, stamp } = amzDate(now);
  const url = new URL(cfg.endpoint);
  const host = url.port ? `${url.hostname}:${url.port}` : url.hostname;
  const pathName = objectPath(bucket, input.key);
  const credential = `${cfg.accessKey}/${stamp}/${cfg.region}/s3/aws4_request`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(ttl),
    "X-Amz-SignedHeaders": "host",
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((name) => `${awsUriEncode(name, true)}=${awsUriEncode(query[name]!, true)}`)
    .join("&");
  const canonicalRequest = [
    "GET",
    pathName,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const scope = `${stamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    scope,
    objectSha256(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(cfg.secretKey, stamp, cfg.region))
    .update(stringToSign, "utf8")
    .digest("hex");
  return `${cfg.endpoint}${pathName}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function writeLocal(key: string, bytes: Buffer): void {
  const abs = localPathFor(key);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, bytes);
}

export function readLocalObject(key: string): Buffer | null {
  const abs = localPathFor(key);
  if (!existsSync(abs)) return null;
  return readFileSync(abs);
}

export function objectStorageBackend(): "minio" | "local" {
  return minioConfig() ? "minio" : "local";
}

export function assertDeletableObject(key: string): void {
  const kind = kindFromObjectKey(key);
  if (!kind || !isRestrictedKind(kind)) return;
  if (!minioConfig()) return;
  if ((process.env.MINIO_ALLOW_RESTRICTED_DELETE || "").trim() === "1") return;
  throw new Error("restricted_delete_denied");
}

export async function putObject(input: {
  kind: ObjectKind;
  fileName: string;
  bytes: Buffer;
  contentType: string;
  publicBucket?: boolean;
}): Promise<StoredObject> {
  await scanUpload({
    kind: input.kind,
    bytes: input.bytes,
    contentType: input.contentType,
  });
  const key = objectKey(input.kind, input.fileName);
  const wantPublic = Boolean(input.publicBucket && allowPublicBucket(input.kind));
  const classification = objectClassForKind(input.kind, wantPublic);
  const sha256 = objectSha256(input.bytes);
  const cfg = minioConfig();
  if (!cfg || persistLocalCopy(classification)) {
    writeLocal(key, input.bytes);
  }
  if (cfg) {
    const bucket = bucketForObject(input.kind, wantPublic, cfg);
    const extraHeaders: Record<string, string> = {
      "x-amz-meta-sha256": sha256,
      "x-amz-meta-kind": input.kind,
      "x-amz-meta-class": classification,
    };
    if (sseEnabled()) {
      extraHeaders["x-amz-server-side-encryption"] = "AES256";
    }
    const until = retentionUntilIso();
    if (
      objectLockEnabled() &&
      until &&
      (classification === "confidential" || classification === "restricted")
    ) {
      extraHeaders["x-amz-object-lock-mode"] = "GOVERNANCE";
      extraHeaders["x-amz-object-lock-retain-until-date"] = until;
    }
    const result = await s3Fetch({
      method: "PUT",
      bucket,
      key,
      body: input.bytes,
      contentType: input.contentType,
      extraHeaders,
    });
    if (result.status >= 300) {
      throw new Error(`minio_put_failed_${result.status}`);
    }
    return {
      key,
      bucket,
      backend: "minio",
      contentType: input.contentType,
      byteSize: input.bytes.length,
      sha256,
      classification,
    };
  }
  return {
    key,
    bucket: "local",
    backend: "local",
    contentType: input.contentType,
    byteSize: input.bytes.length,
    sha256,
    classification,
  };
}

export async function setObjectLegalHold(key: string, on: boolean): Promise<void> {
  const cfg = minioConfig();
  if (!cfg) return;
  const kind = kindFromObjectKey(key);
  if (!kind) throw new Error("invalid_object_key");
  const bucket = bucketForObject(kind, false, cfg);
  const status = on ? "ON" : "OFF";
  const xml = `<LegalHold xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Status>${status}</Status></LegalHold>`;
  const body = Buffer.from(xml, "utf8");
  const md5 = createHash("md5").update(body).digest("base64");
  const result = await s3Fetch({
    method: "PUT",
    bucket,
    key,
    body,
    contentType: "application/xml",
    query: { "legal-hold": "" },
    extraHeaders: { "content-md5": md5 },
  });
  if (result.status >= 300) {
    throw new Error(`minio_legal_hold_failed_${result.status}`);
  }
}

export async function getObject(key: string): Promise<Buffer | null> {
  const local = readLocalObject(key);
  if (local) return local;
  const cfg = minioConfig();
  if (!cfg) return null;
  for (const bucket of bucketsToRead(key, cfg)) {
    const result = await s3Fetch({ method: "GET", bucket, key });
    if (result.status === 200) return result.body;
  }
  return null;
}

export async function deleteObject(key: string): Promise<void> {
  assertDeletableObject(key);
  try {
    const abs = localPathFor(key);
    if (existsSync(abs)) unlinkSync(abs);
  } catch {
    // ignore
  }
  const cfg = minioConfig();
  if (!cfg) return;
  const kind = kindFromObjectKey(key);
  const targets = kind
    ? [bucketForObject(kind, kind === "images", cfg), cfg.bucketPrivate]
    : [cfg.bucketPrivate];
  const unique = [...new Set(targets)];
  for (const bucket of unique) {
    if (bucket === cfg.bucketRestricted) continue;
    await s3Fetch({ method: "DELETE", bucket, key });
  }
}

export async function pingMinio(): Promise<boolean> {
  const cfg = minioConfig();
  if (!cfg) return false;
  try {
    const buckets = [
      ...new Set([
        cfg.bucketPrivate,
        cfg.bucketConfidential,
        cfg.bucketRestricted,
      ]),
    ];
    for (const bucket of buckets) {
      const result = await s3Fetch({
        method: "GET",
        bucket,
        key: ".keep",
      });
      if (!(result.status === 200 || result.status === 404)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function pingMinioLive(endpoint: string): Promise<boolean> {
  const base = endpoint.trim().replace(/\/+$/, "");
  if (!base) return false;
  try {
    const response = await fetch(`${base}/minio/health/live`, {
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pingMinioReplica(): Promise<"ok" | "error" | "unset"> {
  const endpoint = (process.env.MINIO_REPLICA_ENDPOINT || "").trim();
  if (!endpoint) return "unset";
  return (await pingMinioLive(endpoint)) ? "ok" : "error";
}
