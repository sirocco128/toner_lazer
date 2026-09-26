import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeUpload, sniffBytes } from "../lib/object-scan";

describe("object scan", () => {
  it("sniffs common document and image magic bytes", () => {
    assert.equal(sniffBytes(Buffer.from([0xff, 0xd8, 0xff, 0xd9])), "jpeg");
    assert.equal(sniffBytes(Buffer.from("%PDF-1.4 x", "latin1")), "pdf");
    assert.equal(sniffBytes(Buffer.from('{"ok":true}', "utf8")), "json");
    assert.equal(sniffBytes(Buffer.from("name,qty\nA,1", "utf8")), "csv");
  });

  it("allows slips as jpeg and documents as pdf", () => {
    assert.equal(
      assertSafeUpload({
        kind: "slips",
        bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        contentType: "image/jpeg",
      }),
      "jpeg",
    );
    assert.equal(
      assertSafeUpload({
        kind: "documents",
        bytes: Buffer.from("%PDF-1.4 minimal", "latin1"),
        contentType: "application/pdf",
      }),
      "pdf",
    );
  });

  it("rejects executables, tiny files, and mime mismatch", () => {
    assert.throws(
      () =>
        assertSafeUpload({
          kind: "documents",
          bytes: Buffer.from("MZ"),
          contentType: "application/pdf",
        }),
      /file_too_small|executable_rejected/,
    );
    assert.throws(
      () =>
        assertSafeUpload({
          kind: "documents",
          bytes: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(8)]),
          contentType: "application/pdf",
        }),
      /executable_rejected/,
    );
    assert.throws(
      () =>
        assertSafeUpload({
          kind: "slips",
          bytes: Buffer.from("%PDF-1.4 xxxx", "latin1"),
          contentType: "application/pdf",
        }),
      /file_type_rejected/,
    );
    assert.throws(
      () =>
        assertSafeUpload({
          kind: "slips",
          bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
          contentType: "image/png",
        }),
      /mime_mismatch/,
    );
  });
});
