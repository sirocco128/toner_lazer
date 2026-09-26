import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_MAIN_FLOW,
  BOARD_STATUSES,
  BOARD_TEAM_RULES,
  BOARD_TRANSITIONS,
} from "../lib/board-status-rules";

describe("board status rules", () => {
  it("keeps Thai team rules complete", () => {
    assert.match(BOARD_MAIN_FLOW, /รออนุมัติ/);
    assert.equal(BOARD_STATUSES.length, 8);
    assert.equal(BOARD_TEAM_RULES.length, 7);
    assert.ok(
      BOARD_TEAM_RULES.some((rule) => rule.includes("In Progress")),
    );
  });

  it("only allows Done from pending approval", () => {
    assert.deepEqual(BOARD_TRANSITIONS.pending_approval, [
      "done",
      "rejected",
      "cancelled",
    ]);
    assert.equal(
      Object.values(BOARD_TRANSITIONS).filter((next) => next.includes("done"))
        .length,
      1,
    );
  });
});
