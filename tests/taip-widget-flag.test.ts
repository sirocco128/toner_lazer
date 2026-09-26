import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTaipWidgetEnabled } from "../lib/feature-flags.js";

describe("TAIP widget flag", () => {
  it("treats only explicit true/1/on as enabled", () => {
    const raw = String(process.env.NEXT_PUBLIC_TAIP_WIDGET || "")
      .trim()
      .toLowerCase();
    const expected = raw === "1" || raw === "true" || raw === "on";
    assert.equal(isTaipWidgetEnabled(), expected);
  });
});
