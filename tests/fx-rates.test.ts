import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computePoCost } from "../lib/po-cost";
import {
  fallbackFxGuide,
  getFxGuide,
  rateForCurrency,
  resetFxGuideCache,
} from "../lib/fx-rates";
import { FACTORY_MARKET_FX_USD_THB, SMARTGIFT_FX_CNY_THB } from "../lib/alibaba/rates";
import {
  factoryCurrencyNoun,
  factoryFxPairCode,
  factoryFxPairLabel,
  isFactoryCurrency,
} from "../lib/factory-po-types";

describe("factory FX guide", () => {
  it("accepts CNY and USD and labels the pair", () => {
    assert.equal(isFactoryCurrency("CNY"), true);
    assert.equal(isFactoryCurrency("USD"), true);
    assert.equal(isFactoryCurrency("EUR"), false);
    assert.equal(factoryCurrencyNoun("CNY"), "หยวน");
    assert.equal(factoryCurrencyNoun("USD"), "ดอลลาร์");
    assert.equal(factoryFxPairLabel("CNY"), "หยวน→บาท");
    assert.equal(factoryFxPairLabel("USD"), "ดอลลาร์→บาท");
    assert.equal(factoryFxPairCode("CNY"), "CNY→THB");
    assert.equal(factoryFxPairCode("USD"), "USD→THB");
  });

  it("computes factory THB from a dollar rate", () => {
    const cost = computePoCost({
      quantity: 10,
      factoryUnitCny: 2,
      fxCnyThb: 33,
      inlandThb: 0,
      freightThb: 0,
      importDutyThb: 0,
      customsFeeThb: 0,
      packingThb: 0,
      lastMileThb: 0,
    });
    assert.equal(cost.factoryAmountCny, 20);
    assert.equal(cost.factoryThb, 660);
  });

  it("returns fallback CNY/USD rates when fetch fails", async () => {
    resetFxGuideCache();
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const guide = await getFxGuide({ fetchImpl, bypassCache: true });
    assert.equal(guide.live, false);
    assert.equal(guide.cnyThb, SMARTGIFT_FX_CNY_THB);
    assert.equal(guide.usdThb, FACTORY_MARKET_FX_USD_THB);
    assert.equal(rateForCurrency(guide, "CNY"), SMARTGIFT_FX_CNY_THB);
    assert.equal(rateForCurrency(fallbackFxGuide(), "USD"), FACTORY_MARKET_FX_USD_THB);
  });

  it("parses frankfurter payloads into a live guide", async () => {
    resetFxGuideCache();
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      const thb = url.includes("from=USD") ? 32.5 : 4.72;
      return {
        ok: true,
        json: async () => ({ rates: { THB: thb } }),
      } as Response;
    }) as unknown as typeof fetch;
    const guide = await getFxGuide({ fetchImpl, bypassCache: true });
    assert.equal(guide.live, true);
    assert.equal(guide.source, "frankfurter.app");
    assert.equal(guide.cnyThb, 4.72);
    assert.equal(guide.usdThb, 32.5);
  });
});