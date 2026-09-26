import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatOpsDeskStamp,
  isOpsDeskContextMenuTarget,
  opsDeskUserLine,
  opsDeskWatermarkBand,
  opsDeskWatermarkLine,
} from "../lib/ops-desk-guard";

describe("ops desk guard", () => {
  it("prefers display name with email for the watermark user line", () => {
    assert.equal(
      opsDeskUserLine({ name: "สมชาย", email: "somchai@local" }),
      "สมชาย · somchai@local",
    );
    assert.equal(
      opsDeskUserLine({ name: "admin@local", email: "admin@local" }),
      "admin@local",
    );
    assert.equal(opsDeskUserLine({ name: "  ", email: "viewer@local" }), "viewer@local");
  });

  it("stamps Bangkok date and time onto the watermark", () => {
    const now = new Date("2026-09-07T12:31:00+07:00");
    const stamp = formatOpsDeskStamp(now);
    assert.match(stamp, /2569/);
    assert.match(stamp, /12:31/);
    assert.equal(
      opsDeskWatermarkLine("สมชาย · somchai@local", now),
      `สมชาย · somchai@local · ${stamp}`,
    );
    const band = opsDeskWatermarkBand("สมชาย · somchai@local", now, 3);
    assert.equal(band.split("   ·   ").length, 3);
    assert.ok(band.includes(stamp));
  });

  it("lets form fields keep the native context menu", () => {
    assert.equal(isOpsDeskContextMenuTarget(null), false);
    assert.equal(isOpsDeskContextMenuTarget({} as EventTarget), false);
  });
});
