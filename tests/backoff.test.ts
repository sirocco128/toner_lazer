import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BACKOFF_CAP_SECONDS,
  computeBackoffSeconds,
} from "../lib/quote-service";

describe("backoff (§31 required)", () => {
  it("grows exponentially from base seconds", () => {
    const base = 60;
    assert.equal(computeBackoffSeconds(1, base), 60);
    assert.equal(computeBackoffSeconds(2, base), 120);
    assert.equal(computeBackoffSeconds(3, base), 240);
    assert.equal(computeBackoffSeconds(4, base), 480);
  });

  it("caps at 21600 seconds (6 hours)", () => {
    assert.equal(BACKOFF_CAP_SECONDS, 21_600);
    const base = 60;
    // 60 * 2^9 = 30720 > 21600
    assert.equal(computeBackoffSeconds(10, base), BACKOFF_CAP_SECONDS);
    assert.equal(computeBackoffSeconds(20, base), BACKOFF_CAP_SECONDS);
    assert.equal(computeBackoffSeconds(100, 10_000), BACKOFF_CAP_SECONDS);
  });

  it("treats attempt < 1 like attempt 1 for exponent floor", () => {
    assert.equal(computeBackoffSeconds(0, 60), 60);
    assert.equal(computeBackoffSeconds(-3, 60), 60);
  });
});
