#!/usr/bin/env node
/**
 * Ten finished buy-sell cycles on the ops sqlite ledger.
 * Quote → order → deposit → factory PO → goods receipt → factory pay
 * → balance → tax invoice → delivery. Journals feed the financial statements.
 *
 * Usage: SQLITE_PATH=/path/leads.sqlite node scripts/seed-finance-cycles.mjs
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

if (!process.env.SQLITE_PATH) {
  console.error("SQLITE_PATH is required");
  process.exit(1);
}
process.env.LEAD_STORAGE_MODE = "sqlite";
process.env.IP_HASH_SECRET ||= "seed-finance-ip-hash-secret-32-chars-min";
process.env.SITE_TAX_ID ||= "0105556003873";
process.env.PROMPTPAY_ID ||= "0105556003873";
delete process.env.QUOTE_WEBHOOK_URL;

const tsc = spawnSync(
  process.execPath,
  [resolve(ROOT, "node_modules/typescript/lib/tsc.js"), "-p", "tsconfig.test.json", "--pretty", "false"],
  { cwd: ROOT, stdio: "inherit" },
);
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const preloadPath = resolve(ROOT, ".tmp/test-alias-preload.cjs");
writeFileSync(
  preloadPath,
  `
const path = require("node:path");
const Module = require("node:module");
const root = ${JSON.stringify(resolve(ROOT, ".tmp/tests"))};
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === "string" && request.startsWith("@/")) {
    request = path.join(root, request.slice(2));
  }
  return original.call(this, request, parent, isMain, options);
};
`,
  "utf8",
);
require(preloadPath);

const DEALS = [
  ["บริษัทตัวอย่าง อัลฟา จำกัด", "กระบอกน้ำสกรีนโลโก้", 40, 28000, 18, 400, 1800],
  ["บริษัทตัวอย่าง บีตา จำกัด", "ชุดสมุดและปากกา", 60, 22000, 8, 300, 1200],
  ["บริษัทตัวอย่าง แกมมา จำกัด", "ถุงผ้าแคมเปญ", 80, 18000, 6, 250, 900],
  ["บริษัทตัวอย่าง เดลตา จำกัด", "พาวเวอร์แบงก์สกรีนโลโก้", 50, 45000, 28, 500, 2200],
  ["บริษัทตัวอย่าง เอปไซลอน จำกัด", "ชุดของขวัญปีใหม่", 30, 36000, 22, 450, 1600],
  ["บริษัทตัวอย่าง ซีตา จำกัด", "แก้วเซรามิกสกรีน", 70, 32000, 12, 350, 1500],
  ["บริษัทตัวอย่าง เอตา จำกัด", "ร่มพับสกรีนโลโก้", 100, 25000, 7, 280, 1100],
  ["บริษัทตัวอย่าง ธีตา จำกัด", "กระเป๋าผ้าองค์กร", 45, 27000, 15, 320, 1400],
  ["บริษัทตัวอย่าง ไอโอตา จำกัด", "ชุดสายชาร์จในกล่องต้อนรับ", 90, 30000, 9, 300, 1300],
  ["บริษัทตัวอย่าง แคปปา จำกัด", "กล่องของขวัญไม้", 35, 52000, 35, 600, 2400],
];

const STEPS = [
  "awaiting_production",
  "producing",
  "in_transit",
  "inbound",
  "warehouse",
  "out_for_delivery",
  "delivered",
];

const { closeDb } = require(resolve(ROOT, ".tmp/tests/lib/database.js"));
closeDb();
const { resetQuoteRepository, updateQuoteOps } = require(resolve(ROOT, ".tmp/tests/lib/quote-repository.js"));
resetQuoteRepository();
const { resetOrderRepository } = require(resolve(ROOT, ".tmp/tests/lib/order-repository.js"));
resetOrderRepository();
const { submitQuotePayload } = require(resolve(ROOT, ".tmp/tests/lib/quote-service.js"));
const { createOrderFromQuote, confirmPayment, updateOrderFulfillment, getOrderBundle } = require(
  resolve(ROOT, ".tmp/tests/lib/order-service.js"),
);
const { saveFactoryPo } = require(resolve(ROOT, ".tmp/tests/lib/factory-po-service.js"));
const { receiveGoods, payFactoryForReceived, factoryPayableSnapshot } = require(
  resolve(ROOT, ".tmp/tests/lib/ops-cycle-service.js"),
);
const { buildIncomeStatement } = require(resolve(ROOT, ".tmp/tests/lib/ledger-statements.js"));

for (let i = 0; i < DEALS.length; i += 1) {
  const [company, product, quantity, amount, unitCny, inland, freight] = DEALS[i];
  const headers = new Headers({ "x-forwarded-for": `203.0.113.${20 + i}` });
  const quote = await submitQuotePayload(
    {
      name: "ผู้ติดต่อตัวอย่าง",
      company,
      email: `sample-cycle-${i + 1}@example.com`,
      phone: `08100010${String(i).padStart(2, "0")}`,
      quantity,
      consent: true,
      decorationMethod: "screen-print",
      website: "",
      startedAt: Date.now() - 8_000,
    },
    { headers },
  );
  if (!quote.ok) throw new Error(`quote ${i + 1}: ${quote.formError}`);
  updateQuoteOps({ requestId: quote.requestId, leadStatus: "won" });

  const order = createOrderFromQuote({
    quoteRequestId: quote.requestId,
    amount,
    vatMode: "exclusive",
    quantity,
    productSummary: product,
    billingName: company,
    billingTaxId: "0105556003873",
    billingAddress: "50/238 ซอยประชาอุทิศ 72 ทุ่งครุ กรุงเทพฯ 10140",
  });

  const deposit = getOrderBundle(order.orderId)?.payments[0];
  if (!deposit) throw new Error("deposit_missing");
  confirmPayment({ paymentId: deposit.paymentId, actor: "seed-finance" });

  const po = saveFactoryPo({
    orderId: order.orderId,
    factoryName: `โรงงานตัวอย่าง ${i + 1}`,
    factoryPlatform: "factory_direct",
    productName: product,
    quantity,
    color: "ตามแบบ",
    decorationMethod: "screen-print",
    logoNotes: "โลโก้บริษัทตัวอย่าง 1 สี",
    fxCnyThb: 5,
    factoryUnitCny: unitCny,
    inlandThb: inland,
    freightThb: freight,
    importDutyThb: Math.round(amount * 0.02),
    customsFeeThb: 150,
    packingThb: 200,
    lastMileThb: 400,
    status: "confirmed",
    destinationMode: "warehouse",
  });

  for (const status of STEPS) {
    if (status === "out_for_delivery") {
      const remaining = getOrderBundle(order.orderId)?.payments.find(
        (payment) => payment.kind === "remaining" && payment.status === "pending",
      );
      if (!remaining) throw new Error(`remaining_missing ${order.orderId}`);
      confirmPayment({ paymentId: remaining.paymentId, actor: "seed-finance" });
    }
    if (status === "warehouse") {
      updateOrderFulfillment({ orderId: order.orderId, status, actor: "seed-finance" });
      receiveGoods({
        poId: po.poId,
        qtyReceived: quantity,
        destination: "warehouse",
        productKey: `SAMPLE-GIFT-${String(i + 1).padStart(2, "0")}`,
        actor: "seed-finance",
      });
      const snap = factoryPayableSnapshot(po.poId);
      if (!snap) throw new Error("payable_missing");
      if (snap.unpaidAmount > 0) {
        payFactoryForReceived({ poId: po.poId, amount: snap.unpaidAmount, actor: "seed-finance" });
      }
      if (snap.unpaidFreight > 0) {
        payFactoryForReceived({
          poId: po.poId,
          amount: snap.unpaidFreight,
          payableKind: "freight",
          actor: "seed-finance",
        });
      }
      continue;
    }
    updateOrderFulfillment({ orderId: order.orderId, status, actor: "seed-finance" });
  }

  const done = getOrderBundle(order.orderId);
  console.log(
    `done ${order.orderId} ${company} sell=${amount} status=${done?.order.fulfillmentStatus} pay=${done?.order.paymentStatus}`,
  );
}

const books = buildIncomeStatement({ fromDate: "2000-01-01", toDate: "2099-12-31" });
console.log(
  `statement revenue=${books.revenue} cogs=${books.cogs} gross=${books.grossProfit} net=${books.netIncome}`,
);
closeDb();
