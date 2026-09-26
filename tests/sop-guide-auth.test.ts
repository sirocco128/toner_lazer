import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  createSopGuideSessionToken,
  isSopGuideConfigured,
  verifySopGuideSessionToken,
  verifySopGuideToken,
} from "@/lib/sop-guide-auth";

describe("sop-guide-auth", () => {
  const prevToken = process.env.SOP_GUIDE_TOKEN;
  const prevSecret = process.env.ADMIN_SESSION_SECRET;

  before(() => {
    process.env.SOP_GUIDE_TOKEN = "test-sop-guide-token-ok";
    process.env.ADMIN_SESSION_SECRET = "a".repeat(32) + "sop-guide-secret-extra";
  });

  after(() => {
    if (prevToken === undefined) delete process.env.SOP_GUIDE_TOKEN;
    else process.env.SOP_GUIDE_TOKEN = prevToken;
    if (prevSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = prevSecret;
  });

  it("requires configured token and session secret", () => {
    assert.equal(isSopGuideConfigured(), true);
  });

  it("verifies the shared read token", () => {
    assert.equal(verifySopGuideToken("test-sop-guide-token-ok"), true);
    assert.equal(verifySopGuideToken("wrong"), false);
  });

  it("signs and verifies a guide session cookie", () => {
    const now = 1_700_000_000_000;
    const token = createSopGuideSessionToken(now);
    assert.equal(verifySopGuideSessionToken(token, now + 1000), true);
    assert.equal(
      verifySopGuideSessionToken(token, now + 13 * 60 * 60 * 1000),
      false,
    );
  });
});
