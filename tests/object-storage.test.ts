import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archivePdfDocument, isPdfBuffer } from "../lib/document-archive";
import {
  allowPublicBucket,
  appUsesMinioRoot,
  assertDeletableObject,
  bucketForObject,
  createPresignedGetUrl,
  getObject,
  isMinioConfigured,
  objectClassForKind,
  objectKey,
  objectSha256,
  objectStorageBackend,
  publicObjectUrl,
  putObject,
  retentionUntilIso,
  signedUrlTtlSeconds,
} from "../lib/object-storage";

describe("object storage", { concurrency: false }, () => {
describe("local fallback", () => {
  let dataDir = "";
  let previousSqlite = "";
  let previousEndpoint = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-objects-"));
    previousSqlite = process.env.SQLITE_PATH || "";
    previousEndpoint = process.env.MINIO_ENDPOINT || "";
    process.env.SQLITE_PATH = join(dataDir, "leads.sqlite");
    delete process.env.MINIO_ENDPOINT;
  });

  after(() => {
    if (previousSqlite) process.env.SQLITE_PATH = previousSqlite;
    else delete process.env.SQLITE_PATH;
    if (previousEndpoint) process.env.MINIO_ENDPOINT = previousEndpoint;
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it("sanitizes keys and rejects empty names", () => {
    assert.equal(objectKey("slips", "SLP-1.jpg"), "slips/SLP-1.jpg");
    assert.equal(objectKey("images", "../etc/passwd"), "images/etc/passwd");
    assert.equal(
      objectKey("mockups", "REQ-1/customer-master.png"),
      "mockups/REQ-1/customer-master.png",
    );
    assert.equal(objectKey("images", "B00001/cover.jpg"), "images/B00001/cover.jpg");
    assert.equal(objectKey("documents", "B00001/spec.pdf"), "documents/B00001/spec.pdf");
    assert.throws(() => objectKey("documents", ""), /invalid_object_key/);
    assert.throws(() => objectKey("documents", ".."), /invalid_object_key/);
  });

  it("classifies customer files away from the public bucket", () => {
    assert.equal(allowPublicBucket("images"), true);
    assert.equal(allowPublicBucket("slips"), false);
    assert.equal(allowPublicBucket("documents"), false);
    assert.equal(objectClassForKind("slips", true), "restricted");
    assert.equal(objectClassForKind("documents", true), "confidential");
    assert.equal(objectClassForKind("mockups"), "internal");
    assert.equal(objectClassForKind("images", true), "public");
    assert.equal(publicObjectUrl("slips/SLP-1.jpg"), null);
    assert.equal(signedUrlTtlSeconds(9999), 600);
    assert.equal(signedUrlTtlSeconds(10), 30);
    const previousDays = process.env.MINIO_RETENTION_DAYS;
    process.env.MINIO_RETENTION_DAYS = "7";
    assert.equal(
      retentionUntilIso(new Date("2026-09-06T00:00:00.000Z")),
      "2026-09-13T00:00:00Z",
    );
    process.env.MINIO_RETENTION_DAYS = "1825";
    assert.equal(
      retentionUntilIso(new Date("2026-09-06T00:00:00.000Z")),
      "2031-09-05T00:00:00Z",
    );
    if (previousDays === undefined) delete process.env.MINIO_RETENTION_DAYS;
    else process.env.MINIO_RETENTION_DAYS = previousDays;
  });

  it("writes and reads files beside sqlite when MinIO is unset", async () => {
    assert.equal(isMinioConfigured(), false);
    assert.equal(objectStorageBackend(), "local");
    const stored = await putObject({
      kind: "slips",
      fileName: "SLP-TEST.jpg",
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      contentType: "image/jpeg",
      publicBucket: true,
    });
    assert.equal(stored.backend, "local");
    assert.equal(stored.classification, "restricted");
    assert.equal(stored.bucket, "local");
    assert.equal(stored.key, "slips/SLP-TEST.jpg");
    assert.equal(stored.sha256, objectSha256(Buffer.from([0xff, 0xd8, 0xff, 0xd9])));
    const roundTrip = await getObject(stored.key);
    assert.ok(roundTrip);
    assert.equal(roundTrip.equals(Buffer.from([0xff, 0xd8, 0xff, 0xd9])), true);
    assert.equal(existsSync(join(dataDir, "objects", "slips", "SLP-TEST.jpg")), true);
  });

  it("archives PDF documents under documents/YYYY-MM-DD/", async () => {
    const pdf = Buffer.from("%PDF-1.4 minimal", "latin1");
    assert.equal(isPdfBuffer(pdf), true);
    assert.equal(isPdfBuffer(Buffer.from("not-pdf")), false);
    const stored = await archivePdfDocument({
      fileName: "ใบเสร็จ RV/1",
      bytes: pdf,
    });
    assert.equal(stored.backend, "local");
    assert.equal(stored.classification, "confidential");
    assert.match(stored.key, /^documents\/\d{4}-\d{2}-\d{2}\/RV_1\.pdf$/);
    const got = await getObject(stored.key);
    assert.ok(got);
    assert.equal(got.subarray(0, 5).toString("latin1"), "%PDF-");
  });
});

describe("MinIO signing without a live server", () => {
  const previous: Record<string, string | undefined> = {};
  const keys = [
    "MINIO_ENDPOINT",
    "MINIO_ACCESS_KEY",
    "MINIO_SECRET_KEY",
    "MINIO_ROOT_USER",
    "MINIO_BUCKET_PRIVATE",
    "MINIO_BUCKET_PUBLIC",
    "MINIO_BUCKET_CONFIDENTIAL",
    "MINIO_BUCKET_RESTRICTED",
    "MINIO_PUBLIC_BASE_URL",
    "MINIO_ALLOW_RESTRICTED_DELETE",
  ];

  before(() => {
    for (const key of keys) previous[key] = process.env[key];
    process.env.MINIO_ENDPOINT = "http://127.0.0.1:9000";
    process.env.MINIO_ACCESS_KEY = "giftset-app";
    process.env.MINIO_SECRET_KEY = "giftsetAppDevKey1";
    process.env.MINIO_ROOT_USER = "terabis";
    process.env.MINIO_BUCKET_PRIVATE = "terabis-private";
    process.env.MINIO_BUCKET_PUBLIC = "terabis-public";
    process.env.MINIO_BUCKET_CONFIDENTIAL = "terabis-confidential";
    process.env.MINIO_BUCKET_RESTRICTED = "terabis-restricted";
    process.env.MINIO_PUBLIC_BASE_URL = "http://127.0.0.1:9000/terabis-public";
    delete process.env.MINIO_ALLOW_RESTRICTED_DELETE;
  });

  after(() => {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("routes slips and PDFs to vault buckets and refuses public URLs", () => {
    assert.equal(isMinioConfigured(), true);
    assert.equal(appUsesMinioRoot(), false);
    assert.equal(bucketForObject("slips"), "terabis-restricted");
    assert.equal(bucketForObject("documents"), "terabis-confidential");
    assert.equal(bucketForObject("mockups"), "terabis-private");
    assert.equal(bucketForObject("images", true), "terabis-public");
    assert.equal(publicObjectUrl("documents/2026-09-06/RV.pdf"), null);
    assert.throws(() => assertDeletableObject("slips/SLP-1.jpg"), /restricted_delete_denied/);
  });

  it("issues a short-lived GET signature that never points at the public bucket", () => {
    const url = createPresignedGetUrl({
      key: "slips/SLP-1.jpg",
      ttlSeconds: 300,
      now: new Date("2026-09-06T05:00:00.000Z"),
    });
    assert.match(url, /^http:\/\/127\.0\.0\.1:9000\/terabis-restricted\/slips\/SLP-1\.jpg\?/);
    assert.match(url, /X-Amz-Expires=300/);
    assert.match(url, /X-Amz-Algorithm=AWS4-HMAC-SHA256/);
    assert.match(url, /X-Amz-Signature=[0-9a-f]{64}/);
    assert.doesNotMatch(url, /terabis-public/);
  });
});
});
