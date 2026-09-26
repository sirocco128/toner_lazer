import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSkuUploadSize,
  classifySkuUpload,
  isAllowedSkuRemoteImageUrl,
  isSkuFileServePath,
  skuFileServePath,
} from "../lib/sku-files";

describe("sku files", () => {
  it("classifies jpeg as a public photo", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const classified = classifySkuUpload({
      originalName: "cover.jpg",
      bytes: jpeg,
    });
    assert.equal(classified.kind, "photo");
    assert.equal(classified.objectKind, "images");
    assert.equal(classified.contentType, "image/jpeg");
  });

  it("classifies PDF as a private document", () => {
    const pdf = Buffer.from("%PDF-1.4 test", "latin1");
    const classified = classifySkuUpload({
      originalName: "spec.pdf",
      bytes: pdf,
    });
    assert.equal(classified.kind, "document");
    assert.equal(classified.objectKind, "documents");
  });

  it("rejects unknown types and oversize photos", () => {
    assert.throws(
      () =>
        classifySkuUpload({
          originalName: "payload.exe",
          bytes: Buffer.from("MZ"),
        }),
      /unsupported_file/,
    );
    assert.throws(() => assertSkuUploadSize("photo", 5_000_000), /file_too_large/);
    assert.doesNotThrow(() => assertSkuUploadSize("document", 5_000_000));
  });

  it("only fetches cover images from allowlisted hosts", () => {
    assert.equal(
      isAllowedSkuRemoteImageUrl(
        "https://smartgiftthailand.com/assets/products/catalog-2026/as00-2.webp",
      ),
      true,
    );
    assert.equal(isAllowedSkuRemoteImageUrl("https://evil.example/x.jpg"), false);
    assert.equal(isAllowedSkuRemoteImageUrl("file:///etc/passwd"), false);
    assert.equal(skuFileServePath(12), "/api/sku-files/12");
    assert.equal(isSkuFileServePath("/api/sku-files/12"), true);
    assert.equal(isSkuFileServePath("https://smartgiftthailand.com/x.webp"), false);
  });
});
