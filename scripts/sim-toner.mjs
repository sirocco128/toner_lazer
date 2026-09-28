#!/usr/bin/env node
/**
 * Print the bottom-up simulation report (no database writes).
 *
 *   npm run sim:toner                 # markdown report, start 2025-10-01
 *   npm run sim:toner -- --json       # raw totals + months as JSON
 *   npm run sim:toner -- --seed 7     # another random draw of the same assumptions
 *   npm run sim:toner -- --start 2026-11-01
 *   npm run sim:toner -- --runs 50                 # P10/P50/P90 over 50 draws
 *   npm run sim:toner -- --acq 2 --fixed 206000    # twice the sales capacity
 */
import { loadCompiledLib } from "./ts-runtime.mjs";

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const lib = loadCompiledLib();
const { simulateTonerBusiness, SIM_ASSUMPTIONS, CUSTOMER_TYPES } = lib("toner-sim");
const { tonerPricingConfigFromEnv } = lib("toner-catalog");

const scenario = {
  startDate: argValue("--start"),
  pricing: tonerPricingConfigFromEnv(process.env),
  acquisitionMultiplier: argValue("--acq") ? Number(argValue("--acq")) : undefined,
  fixedCostPerMonth: argValue("--fixed") ? Number(argValue("--fixed")) : undefined,
};
const result = simulateTonerBusiness({
  ...scenario,
  seed: argValue("--seed") ? Number(argValue("--seed")) : undefined,
});

const runs = Number(argValue("--runs") || 0);
if (runs > 1) {
  const pctile = (arr, q) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
  };
  const rows = [];
  for (let i = 1; i <= runs; i += 1) {
    rows.push(simulateTonerBusiness({ ...scenario, seed: i }).totals);
  }
  const metric = (label, get) => {
    const v = rows.map(get);
    return `| ${label} | ${fmtN(pctile(v, 0.1))} | ${fmtN(pctile(v, 0.5))} | ${fmtN(pctile(v, 0.9))} |`;
  };
  const fmtN = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(n));
  console.log([
    `# ช่วงผลลัพธ์จาก ${runs} รอบจำลอง (สมมติฐานเดียวกัน สุ่มต่างกัน)`,
    "",
    "| ตัวชี้วัด | P10 | P50 | P90 |",
    "| --- | --- | --- | --- |",
    metric("รายได้ปีแรก (ไม่รวม VAT)", (t) => t.revenueExVat),
    metric("รายได้เดือนที่ 12", (t) => t.lastMonthRevenue),
    metric("กำไรจากการดำเนินงานปีแรก", (t) => t.operatingProfit),
    metric("เงินทุนที่ต้องใช้สูงสุด", (t) => t.peakFundingNeed),
    metric("ลูกค้าที่ต้องมีเพื่อทำเดือนละ 850,000", (t) => t.customersForPlanRunRate),
    metric("DSO (วัน)", (t) => t.dsoDays),
  ].join("\n"));
  process.exit(0);
}

if (args.includes("--json")) {
  console.log(JSON.stringify({ totals: result.totals, months: result.months }, null, 2));
  process.exit(0);
}

const fmt = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(n));
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const t = result.totals;
const A = SIM_ASSUMPTIONS;

const lines = [];
lines.push(`# ผลจำลองธุรกิจโทนเนอร์ 12 เดือน (เริ่ม ${result.startDate})`, "");
lines.push("| รายการ | ผลจำลอง | แผนธุรกิจ |", "| --- | --- | --- |");
lines.push(`| รายได้ปีแรก (ไม่รวม VAT) | ${fmt(t.revenueExVat)} | ${fmt(t.planRevenue)} |`);
lines.push(`| รายได้เดือนที่ 12 | ${fmt(t.lastMonthRevenue)} | ${fmt(A.planMonth12Revenue)} |`);
lines.push(`| กำไรขั้นต้น | ${fmt(t.grossProfit)} (${pct(t.grossMargin)}) | ~51% |`);
lines.push(`| กำไรจากการดำเนินงาน | ${fmt(t.operatingProfit)} | 0.24 ล้าน |`);
lines.push(`| ลูกค้าทั้งหมด / ออเดอร์ / ตลับ | ${t.customers} / ${t.orders} / ${fmt(t.cartridges)} | 80–100 ลูกค้า |`);
lines.push(`| ยอดเฉลี่ยต่อออเดอร์ / ราคาเฉลี่ยต่อตลับ | ${fmt(t.averageOrderExVat)} / ${fmt(t.averagePricePerCartridge)} | |`);
lines.push(`| ลูกหนี้ปลายงวด (รวม VAT) / เกินกำหนด | ${fmt(t.receivableEndIncVat)} / ${fmt(t.overdueEndIncVat)} | |`);
lines.push(`| DSO (วัน) | ${t.dsoDays} | 60 |`);
lines.push(`| ลูกค้าที่ต้องมีเพื่อทำรายได้เดือนละ ${fmt(A.planMonth12Revenue)} | ${t.customersForPlanRunRate} | |`);
lines.push(`| เดือนแรกที่กำไรดำเนินงานเป็นบวก | ${t.breakEvenMonth ?? "ยังไม่ถึงในปีแรก"} | 6 |`);
lines.push(`| เงินทุนที่ต้องใช้สูงสุด (รวมลงทุนครั้งเดียว ${fmt(A.oneOffInvestment)}) | ${fmt(t.peakFundingNeed)} | ~1.75 ล้าน |`);
lines.push("");
lines.push("## รายเดือน", "");
lines.push("| เดือน | ลูกค้าใหม่ | ลูกค้าที่ซื้ออยู่ | ออเดอร์ | ตลับ | รายได้ | กำไรขั้นต้น | กำไรดำเนินงาน | เงินเข้า (รวม VAT) | ลูกหนี้สิ้นเดือน | เงินสดสะสม |");
lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const m of result.months) {
  lines.push(
    `| ${m.month} | ${m.newCustomers} | ${m.activeCustomers} | ${m.orders} | ${fmt(m.cartridges)} | ${fmt(m.revenueExVat)} | ${fmt(m.grossProfit)} | ${fmt(m.operatingProfit)} | ${fmt(m.cashInIncVat)} | ${fmt(m.receivableIncVat)} | ${fmt(m.cumulativeCash)} |`,
  );
}
lines.push("", "## รายได้ตามประเภทลูกค้า", "");
lines.push("| ประเภท | ลูกค้า | รายได้ | สัดส่วน |", "| --- | --- | --- | --- |");
for (const [type, profile] of Object.entries(CUSTOMER_TYPES)) {
  const rev = t.revenueByType[type] ?? 0;
  lines.push(`| ${profile.label} | ${t.customersByType[type] ?? 0} | ${fmt(rev)} | ${pct(t.revenueExVat ? rev / t.revenueExVat : 0)} |`);
}
lines.push("", "## ตลับขายดี", "");
for (const [sku, qty] of Object.entries(t.cartridgesBySku).sort((a, b) => b[1] - a[1])) {
  lines.push(`- ${sku}: ${fmt(qty)} ตลับ`);
}
lines.push("", `สมมติฐานทั้งหมดอยู่ใน lib/toner-sim.ts (SIM_ASSUMPTIONS, CUSTOMER_TYPES) · seed ${argValue("--seed") ?? A.seed}`);
console.log(lines.join("\n"));
