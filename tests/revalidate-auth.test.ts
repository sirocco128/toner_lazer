import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isUtf8PayloadTooLarge,
  REVALIDATE_MAX_PAYLOAD_BYTES,
  verifyBearerToken,
} from "../lib/security";

describe("revalidate-auth (§31 optional)", () => {
  const secret = "test-revalidate-secret-at-least-32-chars!!";

  it("rejects missing or invalid bearer tokens", () => {
    assert.equal(verifyBearerToken(null, secret), false);
    assert.equal(verifyBearerToken("", secret), false);
    assert.equal(verifyBearerToken("Basic xyz", secret), false);
    assert.equal(verifyBearerToken("Bearer wrong-token-value-zzzzzzzzzz", secret), false);
  });

  it("accepts a matching bearer token", () => {
    assert.equal(verifyBearerToken(`Bearer ${secret}`, secret), true);
  });

  it("rejects oversized payloads beyond the revalidate limit", () => {
    assert.equal(REVALIDATE_MAX_PAYLOAD_BYTES, 65_536);
    assert.equal(isUtf8PayloadTooLarge("{}", REVALIDATE_MAX_PAYLOAD_BYTES), false);
    const oversized = "a".repeat(REVALIDATE_MAX_PAYLOAD_BYTES + 1);
    assert.equal(isUtf8PayloadTooLarge(oversized), true);
  });
});
