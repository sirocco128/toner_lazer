import type {
  FactoryPoCostBuckets,
  FactoryPoMoneyInput,
  FactoryPoRecord,
} from "@/lib/factory-po-types";
import { roundSatang } from "@/lib/th-billing";

export function computePoCost(input: FactoryPoMoneyInput): FactoryPoCostBuckets {
  const qty = Math.max(0, Math.floor(input.quantity));
  const unit = Math.max(0, input.factoryUnitCny);
  const fx = input.fxCnyThb > 0 ? input.fxCnyThb : 5;
  const amountCny =
    input.factoryAmountCny && input.factoryAmountCny > 0
      ? roundSatang(input.factoryAmountCny)
      : roundSatang(unit * qty);
  const factoryThb = roundSatang(amountCny * fx);
  const inlandThb = roundSatang(Math.max(0, input.inlandThb));
  const freightThb = roundSatang(Math.max(0, input.freightThb));
  const importDutyThb = roundSatang(Math.max(0, input.importDutyThb));
  const customsFeeThb = roundSatang(Math.max(0, input.customsFeeThb));
  const packingThb = roundSatang(Math.max(0, input.packingThb));
  const lastMileThb = roundSatang(Math.max(0, input.lastMileThb));
  const productCostThb = roundSatang(factoryThb + inlandThb);
  const cogsThb = roundSatang(
    productCostThb + freightThb + importDutyThb + customsFeeThb,
  );
  const sellingExpenseThb = roundSatang(packingThb + lastMileThb);
  const landedTotalThb = roundSatang(cogsThb + sellingExpenseThb);

  return {
    factoryThb,
    inlandThb,
    freightThb,
    importDutyThb,
    customsFeeThb,
    packingThb,
    lastMileThb,
    factoryAmountCny: amountCny,
    factoryThbComputed: factoryThb,
    productCostThb,
    cogsThb,
    sellingExpenseThb,
    landedTotalThb,
  };
}

export function costFromPo(po: FactoryPoRecord): FactoryPoCostBuckets {
  return computePoCost({
    quantity: po.quantity,
    factoryUnitCny: po.factoryUnitCny,
    factoryAmountCny: po.factoryAmountCny,
    fxCnyThb: po.fxCnyThb,
    inlandThb: po.inlandThb,
    freightThb: po.freightThb,
    importDutyThb: po.importDutyThb,
    customsFeeThb: po.customsFeeThb,
    packingThb: po.packingThb,
    lastMileThb: po.lastMileThb,
  });
}

export function gpPercent(revenue: number, grossProfit: number): number {
  if (revenue <= 0) return 0;
  return roundSatang((grossProfit / revenue) * 100);
}
