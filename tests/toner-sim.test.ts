import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRng, simulateTonerBusiness, SIM_ASSUMPTIONS } from "../lib/toner-sim";
import { TONER_CATALOG } from "../lib/toner-catalog";

describe("toner business simulation", () => {
  it("is deterministic for a seed", () => {
    const a = simulateTonerBusiness({ seed: 8, startDate: "2025-10-01" });
    const b = simulateTonerBusiness({ seed: 8, startDate: "2025-10-01" });
    assert.deepEqual(a.totals, b.totals);
    const r1 = createRng(42);
    const r2 = createRng(42);
    assert.equal(r1.next(), r2.next());
  });

  it("keeps months, orders and totals consistent", () => {
    const sim = simulateTonerBusiness({ seed: 8, startDate: "2025-10-01" });
    const t = sim.totals;
    assert.equal(sim.months.length, SIM_ASSUMPTIONS.months);
    const sum = (k: "revenueExVat" | "cartridges" | "orders") =>
      sim.months.reduce((s, m) => s + m[k], 0);
    assert.ok(Math.abs(sum("revenueExVat") - t.revenueExVat) <= SIM_ASSUMPTIONS.months);
    assert.equal(sum("cartridges"), t.cartridges);
    assert.equal(sum("orders"), t.orders);
    assert.equal(sim.orders.length, t.orders);
    assert.ok(t.grossMargin > 0.3 && t.grossMargin < 0.7);
    for (const o of sim.orders) {
      assert.ok(o.deliveryDay >= o.orderDay);
      if (o.payDay !== null) assert.ok(o.payDay >= o.orderDay);
      if (o.creditDays > 0 && o.payDay !== null) assert.ok(o.payDay >= o.deliveryDay);
      for (const l of o.lines) assert.ok(TONER_CATALOG.some((t) => t.sku === l.sku), l.sku);
    }
  });

  it("grows with more sales capacity", () => {
    const base = simulateTonerBusiness({ seed: 8 }).totals.revenueExVat;
    const more = simulateTonerBusiness({ seed: 8, acquisitionMultiplier: 2 }).totals.revenueExVat;
    assert.ok(more > base * 1.4);
  });
});
