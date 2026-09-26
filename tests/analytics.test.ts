import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAnalyticsSkippedPath,
  parseGaMeasurementId,
} from "../lib/analytics.js";

describe("parseGaMeasurementId", () => {
  it("accepts a GA4 measurement id", () => {
    assert.equal(parseGaMeasurementId("G-ABC12DEF34"), "G-ABC12DEF34");
  });

  it("trims and uppercases", () => {
    assert.equal(parseGaMeasurementId("  g-abc12def34  "), "G-ABC12DEF34");
  });

  it("rejects empty, UA, GTM, and junk", () => {
    assert.equal(parseGaMeasurementId(""), null);
    assert.equal(parseGaMeasurementId(undefined), null);
    assert.equal(parseGaMeasurementId("UA-123456-1"), null);
    assert.equal(parseGaMeasurementId("GTM-XXXX"), null);
    assert.equal(parseGaMeasurementId("G-"), null);
    assert.equal(parseGaMeasurementId("G-abc_def"), null);
  });
});

describe("isAnalyticsSkippedPath", () => {
  it("skips ops and sop consoles", () => {
    assert.equal(isAnalyticsSkippedPath("/ops"), true);
    assert.equal(isAnalyticsSkippedPath("/ops/quotes"), true);
    assert.equal(isAnalyticsSkippedPath("/sop"), true);
    assert.equal(isAnalyticsSkippedPath("/sop/guide"), true);
  });

  it("tracks public storefront paths", () => {
    assert.equal(isAnalyticsSkippedPath("/"), false);
    assert.equal(isAnalyticsSkippedPath("/contact"), false);
    assert.equal(isAnalyticsSkippedPath("/products/foo"), false);
    assert.equal(isAnalyticsSkippedPath("/ops-not"), false);
  });
});
