import { listFactoryPosByOrder } from "@/lib/factory-po-repository";
import type { FactoryPoRecord } from "@/lib/factory-po-types";
import { getOrderRepository } from "@/lib/order-repository";
import type { OrderRecord } from "@/lib/order-types";
import { csvEscape } from "@/lib/ledger-service";
import { costFromPo, gpPercent } from "@/lib/po-cost";
import { roundSatang } from "@/lib/th-billing";

export type OrderProfitRow = {
  orderId: string;
  company: string;
  createdAt: string;
  revenueExVat: number;
  vatAmount: number;
  factoryThb: number;
  inlandThb: number;
  freightThb: number;
  importThb: number;
  packingThb: number;
  lastMileThb: number;
  cogsThb: number;
  grossProfit: number;
  gpPct: number;
  sellingExpenseThb: number;
  contribution: number;
  landedTotalThb: number;
  poId: string | null;
  poStatus: string | null;
  missingCost: boolean;
};

export type ExecutivePnl = {
  fromDate: string;
  toDate: string;
  orderCount: number;
  withPoCount: number;
  missingCostCount: number;
  revenueExVat: number;
  vatAmount: number;
  factoryThb: number;
  inlandThb: number;
  freightThb: number;
  importThb: number;
  cogsThb: number;
  packingThb: number;
  lastMileThb: number;
  sellingExpenseThb: number;
  grossProfit: number;
  gpPct: number;
  contribution: number;
  contributionPct: number;
  rows: OrderProfitRow[];
};

function bangkokYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
}

export function defaultFinanceRange(now = new Date()): { fromDate: string; toDate: string } {
  const ymd = bangkokYmd(now);
  const fromDate = `${ymd.slice(0, 7)}-01`;
  return { fromDate, toDate: ymd };
}

function activePos(pos: FactoryPoRecord[]): FactoryPoRecord[] {
  return pos.filter((po) => po.status !== "cancelled");
}

function sumCosts(pos: FactoryPoRecord[]): {
  factoryThb: number;
  inlandThb: number;
  freightThb: number;
  importThb: number;
  packingThb: number;
  lastMileThb: number;
  cogsThb: number;
  sellingExpenseThb: number;
  landedTotalThb: number;
} {
  return pos.reduce(
    (acc, po) => {
      const cost = costFromPo(po);
      acc.factoryThb = roundSatang(acc.factoryThb + cost.factoryThb);
      acc.inlandThb = roundSatang(acc.inlandThb + cost.inlandThb);
      acc.freightThb = roundSatang(acc.freightThb + cost.freightThb);
      acc.importThb = roundSatang(acc.importThb + cost.importDutyThb + cost.customsFeeThb);
      acc.packingThb = roundSatang(acc.packingThb + cost.packingThb);
      acc.lastMileThb = roundSatang(acc.lastMileThb + cost.lastMileThb);
      acc.cogsThb = roundSatang(acc.cogsThb + cost.cogsThb);
      acc.sellingExpenseThb = roundSatang(acc.sellingExpenseThb + cost.sellingExpenseThb);
      acc.landedTotalThb = roundSatang(acc.landedTotalThb + cost.landedTotalThb);
      return acc;
    },
    {
      factoryThb: 0,
      inlandThb: 0,
      freightThb: 0,
      importThb: 0,
      packingThb: 0,
      lastMileThb: 0,
      cogsThb: 0,
      sellingExpenseThb: 0,
      landedTotalThb: 0,
    },
  );
}

function profitForOrder(order: OrderRecord): OrderProfitRow {
  const pos = activePos(listFactoryPosByOrder(order.orderId));
  const costs = sumCosts(pos);
  const revenueExVat = order.subtotalExVat;
  const grossProfit = roundSatang(revenueExVat - costs.cogsThb);
  const contribution = roundSatang(grossProfit - costs.sellingExpenseThb);
  const primary = pos[0] ?? null;
  return {
    orderId: order.orderId,
    company: order.company,
    createdAt: order.createdAt,
    revenueExVat,
    vatAmount: order.vatAmount,
    factoryThb: costs.factoryThb,
    inlandThb: costs.inlandThb,
    freightThb: costs.freightThb,
    importThb: costs.importThb,
    packingThb: costs.packingThb,
    lastMileThb: costs.lastMileThb,
    cogsThb: costs.cogsThb,
    grossProfit,
    gpPct: gpPercent(revenueExVat, grossProfit),
    sellingExpenseThb: costs.sellingExpenseThb,
    contribution,
    landedTotalThb: costs.landedTotalThb,
    poId: primary?.poId ?? null,
    poStatus: primary?.status ?? null,
    missingCost: pos.length === 0 || costs.landedTotalThb <= 0,
  };
}

export function buildExecutivePnl(params: {
  fromDate: string;
  toDate: string;
}): ExecutivePnl {
  const repo = getOrderRepository();
  const orders = repo
    .listOrdersInDateRange(params.fromDate, params.toDate)
    .filter((order) => order.fulfillmentStatus !== "cancelled");
  const rows = orders.map(profitForOrder);
  const revenueExVat = roundSatang(rows.reduce((sum, row) => sum + row.revenueExVat, 0));
  const vatAmount = roundSatang(rows.reduce((sum, row) => sum + row.vatAmount, 0));
  const factoryThb = roundSatang(rows.reduce((sum, row) => sum + row.factoryThb, 0));
  const inlandThb = roundSatang(rows.reduce((sum, row) => sum + row.inlandThb, 0));
  const freightThb = roundSatang(rows.reduce((sum, row) => sum + row.freightThb, 0));
  const importThb = roundSatang(rows.reduce((sum, row) => sum + row.importThb, 0));
  const cogsThb = roundSatang(rows.reduce((sum, row) => sum + row.cogsThb, 0));
  const packingThb = roundSatang(rows.reduce((sum, row) => sum + row.packingThb, 0));
  const lastMileThb = roundSatang(rows.reduce((sum, row) => sum + row.lastMileThb, 0));
  const sellingExpenseThb = roundSatang(
    rows.reduce((sum, row) => sum + row.sellingExpenseThb, 0),
  );
  const grossProfit = roundSatang(revenueExVat - cogsThb);
  const contribution = roundSatang(grossProfit - sellingExpenseThb);
  return {
    fromDate: params.fromDate,
    toDate: params.toDate,
    orderCount: rows.length,
    withPoCount: rows.filter((row) => row.poId).length,
    missingCostCount: rows.filter((row) => row.missingCost).length,
    revenueExVat,
    vatAmount,
    factoryThb,
    inlandThb,
    freightThb,
    importThb,
    cogsThb,
    packingThb,
    lastMileThb,
    sellingExpenseThb,
    grossProfit,
    gpPct: gpPercent(revenueExVat, grossProfit),
    contribution,
    contributionPct: gpPercent(revenueExVat, contribution),
    rows,
  };
}

export function pnlToCsv(pnl: ExecutivePnl): string {
  const header = [
    "ออเดอร์",
    "ลูกค้า",
    "วันที่",
    "รายได้ไม่รวม VAT",
    "VAT",
    "ต้นทุนโรงงาน",
    "ขนส่งในจีน",
    "ขนส่งจีน-ไทย",
    "นำเข้า",
    "ต้นทุนขาย",
    "กำไรขั้นต้น",
    "%GP",
    "แพ็กไทย",
    "จัดส่งลูกค้า",
    "ส่วนเกินหลังค่าจัดส่ง",
    "ใบสั่งโรงงาน",
  ].join(",");
  const rows = [header];
  for (const row of pnl.rows) {
    rows.push(
      [
        csvEscape(row.orderId),
        csvEscape(row.company),
        csvEscape(row.createdAt.slice(0, 10)),
        csvEscape(row.revenueExVat.toFixed(2)),
        csvEscape(row.vatAmount.toFixed(2)),
        csvEscape(row.factoryThb.toFixed(2)),
        csvEscape(row.inlandThb.toFixed(2)),
        csvEscape(row.freightThb.toFixed(2)),
        csvEscape(row.importThb.toFixed(2)),
        csvEscape(row.cogsThb.toFixed(2)),
        csvEscape(row.grossProfit.toFixed(2)),
        csvEscape(row.gpPct.toFixed(2)),
        csvEscape(row.packingThb.toFixed(2)),
        csvEscape(row.lastMileThb.toFixed(2)),
        csvEscape(row.contribution.toFixed(2)),
        csvEscape(row.poId),
      ].join(","),
    );
  }
  return `${rows.join("\n")}\n`;
}
