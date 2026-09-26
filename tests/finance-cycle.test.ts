import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { teardownTempDir } from "./teardown-temp";

function resolveProjectRoot(): string {
  if (
    process.env.PROJECT_ROOT &&
    existsSync(join(process.env.PROJECT_ROOT, "package.json"))
  ) {
    return process.env.PROJECT_ROOT;
  }
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = join(dir, "..");
  }
  return join(__dirname, "..");
}

const ROOT = resolveProjectRoot();

describe("factory PO + management accounts cycle", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-finance-"));
    sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET =
      "test-ip-hash-secret-at-least-32-characters-long";
    process.env.SITE_TAX_ID = "0105556003873";
    process.env.PROMPTPAY_ID = "0105556003873";
    delete process.env.QUOTE_WEBHOOK_URL;

    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: sqlitePath },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
  });

  after(() => {
    teardownTempDir(dataDir);
  });

  it("computes landed cost and gross profit per order", async () => {
    const { computePoCost, gpPercent } = await import("../lib/po-cost");
    const cost = computePoCost({
      quantity: 100,
      factoryUnitCny: 12,
      fxCnyThb: 5,
      inlandThb: 500,
      freightThb: 3_000,
      importDutyThb: 800,
      customsFeeThb: 200,
      packingThb: 400,
      lastMileThb: 600,
    });
    assert.equal(cost.factoryAmountCny, 1_200);
    assert.equal(cost.factoryThb, 6_000);
    assert.equal(cost.cogsThb, 10_500);
    assert.equal(cost.sellingExpenseThb, 1_000);
    assert.equal(cost.landedTotalThb, 11_500);
    assert.equal(gpPercent(20_000, 9_500), 47.5);
  });

  it("posts balanced journals from payment → tax invoice → factory PO", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository } = await import("../lib/order-repository");
    resetOrderRepository();

    const { submitQuotePayload } = await import("../lib/quote-service");
    const {
      createOrderFromQuote,
      confirmPayment,
      updateOrderFulfillment,
      getOrderBundle,
    } = await import("../lib/order-service");
    const { saveFactoryPo } = await import("../lib/factory-po-service");
    const { listJournals } = await import("../lib/ledger-repository");
    const { buildExecutivePnl } = await import("../lib/finance-report");
    const { journalsToCsv } = await import("../lib/ledger-service");

    const headers = new Headers({ "x-forwarded-for": "203.0.113.77" });
    const quoteResult = await submitQuotePayload(
      {
        name: "Finance Cycle",
        company: "บริษัท วงจรรายได้ จำกัด",
        email: "finance-cycle@acme.example",
        phone: "0819998877",
        quantity: 80,
        consent: true,
        decorationMethod: "screen-print",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers },
    );
    assert.equal(quoteResult.ok, true);
    if (!quoteResult.ok) return;
    updateQuoteOps({ requestId: quoteResult.requestId, leadStatus: "won" });

    const order = createOrderFromQuote({
      quoteRequestId: quoteResult.requestId,
      amount: 30_000,
      vatMode: "exclusive",
    });

    const po = saveFactoryPo({
      orderId: order.orderId,
      factoryName: "Shenzhen Gift Factory",
      factoryPlatform: "1688",
      productName: order.productSummary,
      quantity: 80,
      color: "กรมท่า",
      decorationMethod: "screen-print",
      logoNotes: "โลโก้ 1 สี ด้านข้างแก้ว",
      fxCnyThb: 5,
      factoryUnitCny: 20,
      inlandThb: 400,
      freightThb: 2_500,
      importDutyThb: 700,
      customsFeeThb: 150,
      packingThb: 300,
      lastMileThb: 500,
      status: "confirmed",
    });
    assert.equal(po.factoryThb, 8_000);
    assert.equal(po.landedTotalThb, 12_550);

    const deposit = getOrderBundle(order.orderId)?.payments[0];
    assert.ok(deposit);
    confirmPayment({ paymentId: deposit!.paymentId });

    updateOrderFulfillment({ orderId: order.orderId, status: "warehouse" });
    const remaining = getOrderBundle(order.orderId)?.payments.find(
      (p) => p.kind === "remaining" && p.status === "pending",
    );
    assert.ok(remaining);
    confirmPayment({ paymentId: remaining!.paymentId });

    const bundle = getOrderBundle(order.orderId);
    assert.ok(bundle?.documents.some((d) => d.documentType === "tax_invoice"));

    const journals = listJournals({ orderId: order.orderId, limit: 20 });
    assert.ok(journals.some((j) => j.sourceKey.startsWith("cash:")));
    assert.ok(journals.some((j) => j.sourceKey === `revenue:${order.orderId}`));
    assert.ok(journals.some((j) => j.sourceKey === `git:${po.poId}`));
    assert.ok(journals.some((j) => j.sourceKey === `cogs:${po.poId}`));
    assert.ok(journals.some((j) => j.bookType === "sales"));
    assert.ok(journals.some((j) => j.bookType === "purchase"));
    assert.ok(journals.some((j) => j.bookType === "cash_in"));
    assert.ok(
      journals.some((j) => j.lines.some((line) => line.accountCode === "1130")),
    );

    for (const entry of journals) {
      const debit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
      const credit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
      assert.equal(Math.round(debit * 100), Math.round(credit * 100), entry.sourceKey);
    }

    const csv = journalsToCsv(journals, (code) => code);
    assert.match(csv, /รหัสบัญชี/);
    assert.match(csv, /4100/);
    assert.match(csv, /5100/);
    assert.match(csv, /1130/);

    const { buildIncomeStatement } = await import("../lib/ledger-statements");
    const books = buildIncomeStatement({
      fromDate: "2000-01-01",
      toDate: "2099-12-31",
    });
    assert.equal(books.revenue, 30_000);
    assert.equal(books.cogs, 11_750);
    assert.equal(books.grossProfit, 18_250);
    assert.equal(books.sellingExpense, 800);
    assert.equal(books.netIncome, 17_450);

    const pnl = buildExecutivePnl({
      fromDate: "2000-01-01",
      toDate: "2099-12-31",
    });
    const row = pnl.rows.find((r) => r.orderId === order.orderId);
    assert.ok(row);
    assert.equal(row!.revenueExVat, 30_000);
    assert.equal(row!.cogsThb, 11_750);
    assert.equal(row!.grossProfit, 18_250);
    assert.equal(row!.contribution, 17_450);
    assert.equal(row!.missingCost, false);
  });

  it("rejects sellable A/B/C codes and auto-assigns FAC0001", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { saveFactory, normalizeFactoryCode } = await import(
      "../lib/factory-registry-service"
    );

    assert.equal(normalizeFactoryCode(" fac-12 "), "FAC-12");
    assert.throws(() => saveFactory({ name: "Bad", factoryCode: "A00001" }), {
      message: "factory_code_is_sku",
    });

    const factory = saveFactory({
      name: "Yiwu Gift Co",
      platform: "1688",
      origin: "yiwu",
      wechat: "yiwu-gift",
    });
    assert.equal(factory.factoryCode, "FAC0001");
    assert.equal(factory.origin, "yiwu");
    assert.equal(factory.status, "active");
  });

  it("links a factory PO to the registry", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository } = await import("../lib/order-repository");
    resetOrderRepository();

    const { saveFactory } = await import("../lib/factory-registry-service");
    const { submitQuotePayload } = await import("../lib/quote-service");
    const { createOrderFromQuote } = await import("../lib/order-service");
    const { saveFactoryPo } = await import("../lib/factory-po-service");
    const { listPosForFactory } = await import("../lib/factory-po-queries");

    const factory = saveFactory({
      name: "Shenzhen Linked Factory",
      platform: "factory_direct",
    });

    const headers = new Headers({ "x-forwarded-for": "203.0.113.88" });
    const quoteResult = await submitQuotePayload(
      {
        name: "Factory Registry",
        company: "บริษัท ทดสอบทะเบียน จำกัด",
        email: "factory-registry@acme.example",
        phone: "0811112233",
        quantity: 40,
        consent: true,
        decorationMethod: "screen-print",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers },
    );
    assert.equal(quoteResult.ok, true);
    if (!quoteResult.ok) return;
    updateQuoteOps({ requestId: quoteResult.requestId, leadStatus: "won" });
    const order = createOrderFromQuote({
      quoteRequestId: quoteResult.requestId,
      amount: 12_000,
      vatMode: "exclusive",
    });

    const po = saveFactoryPo({
      orderId: order.orderId,
      factoryId: factory.id,
      factoryName: "",
      quantity: 40,
      factoryUnitCny: 8,
      fxCnyThb: 5,
      status: "draft",
    });
    assert.equal(po.factoryId, factory.id);
    assert.equal(po.factoryName, "Shenzhen Linked Factory");
    assert.equal(listPosForFactory(factory.id).length, 1);

    assert.throws(
      () =>
        saveFactoryPo({
          orderId: order.orderId,
          factoryId: 99999,
          factoryName: "Missing",
          quantity: 1,
        }),
      { message: "factory_not_found" },
    );
  });
});
