import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  issueHrefForOrder,
  parseRecentOrderHint,
  recentOrderHref,
} from "@/lib/customer-session";

describe("customer-session", () => {
  it("parses a fresh recent-order hint", () => {
    const raw = JSON.stringify({
      orderId: "ORD-1",
      token: "abc",
      savedAt: Date.now(),
    });
    const hint = parseRecentOrderHint(raw);
    assert.ok(hint);
    assert.equal(hint?.orderId, "ORD-1");
    assert.equal(recentOrderHref(hint!), "/orders/ORD-1?t=abc");
  });

  it("rejects expired hints", () => {
    const raw = JSON.stringify({
      orderId: "ORD-1",
      token: "abc",
      savedAt: Date.now() - 48 * 60 * 60 * 1000,
    });
    assert.equal(parseRecentOrderHint(raw), null);
  });

  it("builds issue href with order and token", () => {
    assert.equal(
      issueHrefForOrder("ORD-2", "tok"),
      "/issues?orderId=ORD-2&t=tok",
    );
  });
});
