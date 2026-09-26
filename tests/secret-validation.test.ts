import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  timingSafeEqualString,
  verifyBearerToken,
} from "../lib/security";

describe("secret-validation (§31 required)", () => {
  const secret = "test-revalidate-secret-at-least-32-chars!!";

  it("passes when bearer token equals configured secret", () => {
    assert.equal(timingSafeEqualString(secret, secret), true);
    assert.equal(
      verifyBearerToken(`Bearer ${secret}`, secret),
      true,
    );
  });

  it("fails when values differ or lengths differ", () => {
    assert.equal(timingSafeEqualString(secret, `${secret}x`), false);
    assert.equal(timingSafeEqualString(secret, secret.slice(0, -1)), false);
    assert.equal(
      verifyBearerToken(`Bearer ${secret.slice(0, -1)}`, secret),
      false,
    );
    assert.equal(
      verifyBearerToken("Bearer totally-wrong-token-value-here!!", secret),
      false,
    );
  });

  it("fails closed when configured secret is empty", () => {
    assert.equal(verifyBearerToken(`Bearer ${secret}`, ""), false);
    assert.equal(verifyBearerToken(`Bearer ${secret}`, "   "), false);
    assert.equal(timingSafeEqualString("", secret), false);
  });
});
