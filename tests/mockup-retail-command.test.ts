import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOCKUP_FINISHES } from "../lib/mockup-studio";
import {
  EMPTY_RETAIL_ADJUSTMENTS,
  applyPrintAdjustments,
  mergeRetailAdjustments,
  nextFinishId,
  parseRetailCommand,
} from "../lib/mockup-retail-command";
import type { PrintBox } from "../lib/mockup-compose";

describe("retail mockup commands", () => {
  it("nudges the logo higher for สูงขึ้นไปอีกนิด", () => {
    const parsed = parseRetailCommand("สูงขึ้นไปอีกนิด", MOCKUP_FINISHES);
    assert.equal(parsed.understood, true);
    assert.ok(parsed.dy < 0);
    assert.match(parsed.summary, /สูงขึ้น/);
  });

  it("changes finish color from Thai command", () => {
    const parsed = parseRetailCommand("เปลี่ยนสีเป็นดำด้าน", MOCKUP_FINISHES);
    assert.equal(parsed.understood, true);
    assert.equal(parsed.finishId, "black");
  });

  it("cycles finish when color is not named", () => {
    const parsed = parseRetailCommand("เปลี่ยนสี", MOCKUP_FINISHES);
    assert.equal(parsed.cycleFinish, true);
    assert.equal(nextFinishId("stainless", MOCKUP_FINISHES), "black");
  });

  it("rejects unknown commands", () => {
    const parsed = parseRetailCommand("ทำอาหารกลางวัน");
    assert.equal(parsed.understood, false);
  });

  it("accumulates position and scale", () => {
    const first = parseRetailCommand("สูงขึ้นไปอีกนิด", MOCKUP_FINISHES);
    const merged = mergeRetailAdjustments(EMPTY_RETAIL_ADJUSTMENTS, parsedOr(first));
    const second = parseRetailCommand("ใหญ่ขึ้น", MOCKUP_FINISHES);
    const again = mergeRetailAdjustments(merged, parsedOr(second));
    assert.ok(again.dy < 0);
    assert.ok(again.scale > 1);

    const box: PrintBox = {
      x: 0.4,
      y: 0.44,
      w: 0.24,
      h: 0.14,
      rotateDeg: 0,
      bend: 0.5,
    };
    const moved = applyPrintAdjustments(box, again);
    assert.ok(moved.y < box.y);
    assert.ok(moved.w > box.w);
  });
});

function parsedOr(
  patch: ReturnType<typeof parseRetailCommand>,
): ReturnType<typeof parseRetailCommand> {
  assert.equal(patch.understood, true);
  return patch;
}
