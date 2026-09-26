import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SMARTGIFT_FX_USD_THB,
  FACTORY_MARKET_FX_USD_THB,
} from "../lib/alibaba/rates";
import {
  SMALL_ORDER_PROFIT_FLOOR,
  STANDARD_PROFIT_FLOOR,
  computeForcedMinQty,
  evaluateForcedMinStep,
  factoryUsdToThb,
  markupForProfile,
  profitFloorForQty,
  assertMeetsForcedMinQty,
} from "../lib/alibaba/forced-min-qty";
import { markupForLandedCost, smallOrderFactor } from "../lib/alibaba/landed-cost";

describe("forced min qty", () => {
  it("uses catalog USD 32.50 separate from factory market fallback", () => {
    assert.equal(SMARTGIFT_FX_USD_THB, 32.5);
    assert.equal(FACTORY_MARKET_FX_USD_THB, 33);
    assert.equal(factoryUsdToThb(2), 65);
  });

  it("uses small-order then standard profit floors", () => {
    assert.equal(profitFloorForQty(50), SMALL_ORDER_PROFIT_FLOOR);
    assert.equal(profitFloorForQty(500), STANDARD_PROFIT_FLOOR);
    assert.equal(profitFloorForQty(100, "corporate"), 20_000);
  });

  it("picks the lowest ladder qty that meets SOF × markup profit", () => {
    const unitLanded = 50;
    const result = computeForcedMinQty({ unitLandedCostThb: unitLanded });
    const step10 = evaluateForcedMinStep(unitLanded, 10);
    assert.equal(step10.sof, smallOrderFactor(10));
    assert.equal(step10.markup, markupForLandedCost(unitLanded));
    assert.equal(step10.sellThb, Math.round(50 * 1.5 * 3));
    assert.equal(step10.packageProfitThb, (step10.sellThb - 50) * 10);
    assert.equal(step10.meetsFloor, false);
    assert.equal(result.forcedMinQty, 50);
    assert.equal(result.steps.find((step) => step.qty === 50)?.meetsFloor, true);
  });

  it("uses corporate markup 1.47 and 20000 package floor", () => {
    assert.equal(markupForProfile(400, "corporate"), 1.47);
    const result = computeForcedMinQty({
      unitLandedCostThb: 50,
      profile: "corporate",
    });
    assert.ok(result.forcedMinQty >= 100);
    assert.ok(result.steps.every((step) => [100, 300, 500, 1000].includes(step.qty)));
    const hit = result.steps.find((step) => step.qty === result.forcedMinQty);
    assert.ok(hit);
    assert.equal(hit.meetsFloor, true);
    assert.ok(hit.packageProfitThb >= 20_000);
  });

  it("rejects qty below the stored forced minimum", () => {
    assert.doesNotThrow(() => assertMeetsForcedMinQty(50, 50));
    assert.throws(() => assertMeetsForcedMinQty(49, 50), /qty_below_forced_min/);
  });
});
