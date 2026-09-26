import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  agingBucket,
  computeDueDate,
  daysPastDue,
  summarizeReceivables,
} from "../lib/receivables";
import { calculateDepositPlan, normalizeCreditDays } from "../lib/th-billing";
import { teardownTempDir } from "./teardown-temp";

function resolveProjectRoot(): string {
  if (process.env.PROJECT_ROOT && existsSync(join(process.env.PROJECT_ROOT, "package.json"))) {
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

describe("credit deposit plan", () => {
  it("collects no deposit and leaves the full amount outstanding", () => {
    const plan = calculateDepositPlan({ grandTotal: 21_400, mode: "credit", creditDays: 60 });
    assert.equal(plan.depositAmount, 0);
    assert.equal(plan.remainingAmount, 21_400);
    assert.equal(plan.collectFull, false);
    assert.match(plan.reason, /เครดิต 60 วัน/);
  });

  it("normalizes credit days", () => {
    assert.equal(normalizeCreditDays(45), 45);
    assert.equal(normalizeCreditDays(0), 30);
    assert.equal(normalizeCreditDays("abc"), 30);
    assert.equal(normalizeCreditDays(400), 180);
  });
});

describe("receivables aging", () => {
  const today = new Date("2026-09-26T05:00:00Z");

  it("computes due dates on the Bangkok calendar", () => {
    // 23:30 UTC on 25 Sep is already 26 Sep in Bangkok.
    assert.equal(computeDueDate(new Date("2026-09-25T23:30:00Z"), 30), "2026-10-26");
    assert.equal(computeDueDate(new Date("2026-12-15T03:00:00Z"), 30), "2027-01-14");
  });

  it("buckets by days past due", () => {
    assert.equal(daysPastDue("2026-09-20", today), 6);
    assert.equal(agingBucket(null, today), "no_due");
    assert.equal(agingBucket("2026-09-26", today), "not_due");
    assert.equal(agingBucket("2026-09-25", today), "d1_30");
    assert.equal(agingBucket("2026-07-28", today), "d31_60");
    assert.equal(agingBucket("2026-06-28", today), "d61_90");
    assert.equal(agingBucket("2026-01-01", today), "d90_plus");
  });

  it("summarizes outstanding amounts and skips paid orders", () => {
    const s = summarizeReceivables(
      [
        { orderId: "A", company: "อบต.ก", totalAmount: 1000, paidAmount: 0, dueDate: "2026-09-10", creditDays: 30 },
        { orderId: "B", company: "โรงเรียน ข", totalAmount: 500, paidAmount: 200, dueDate: "2026-10-10", creditDays: 30 },
        { orderId: "C", company: "บริษัท ค", totalAmount: 300, paidAmount: 300, dueDate: null, creditDays: 0 },
        { orderId: "D", company: "บริษัท ง", totalAmount: 800, paidAmount: 0, dueDate: null, creditDays: 30 },
      ],
      today,
    );
    assert.equal(s.rows.length, 3);
    assert.equal(s.rows[0]?.orderId, "A");
    assert.equal(s.totals.d1_30, 1000);
    assert.equal(s.totals.not_due, 300);
    assert.equal(s.totals.no_due, 800);
    assert.equal(s.totalOutstanding, 2100);
    assert.equal(s.overdueOutstanding, 1000);
  });
});

describe("credit order flow (SQLite)", () => {
  let dataDir = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "toner-credit-"));
    const sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET = "test-ip-hash-secret-at-least-32-characters-long";
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

  after(async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    teardownTempDir(dataDir);
  });

  it("ships without payment, invoices with a due date on delivery, receipts on payment", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import("../lib/quote-repository");
    resetQuoteRepository();
    const { resetOrderRepository, getOrderRepository } = await import("../lib/order-repository");
    resetOrderRepository();
    const { submitQuotePayload } = await import("../lib/quote-service");
    const { createOrderFromQuote, confirmPayment, updateOrderFulfillment, getOrderBundle } =
      await import("../lib/order-service");

    const quote = await submitQuotePayload(
      {
        name: "งานพัสดุ",
        company: "องค์การบริหารส่วนตำบลตัวอย่าง",
        email: "procurement@tambon.example",
        phone: "0812345678",
        quantity: 20,
        consent: true,
        decorationMethod: "screen-print",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers: new Headers({ "x-forwarded-for": "203.0.113.90" }) },
    );
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    updateQuoteOps({ requestId: quote.requestId, leadStatus: "quoted" });

    const order = createOrderFromQuote({
      quoteRequestId: quote.requestId,
      amount: 9_800,
      vatMode: "exclusive",
      depositMode: "credit",
      creditDays: 45,
      productSummary: "ตลับหมึกเลเซอร์เทียบเท่า 85A",
      actor: "sales@local",
    });
    assert.equal(order.depositMode, "credit");
    assert.equal(order.creditDays, 45);
    assert.equal(order.depositAmount, 0);
    assert.equal(order.totalAmount, 10_486);
    assert.equal(order.remainingAmount, 10_486);
    assert.equal(order.paymentStatus, "balance_due");
    assert.equal(order.dueDate, null);

    let bundle = getOrderBundle(order.orderId);
    assert.equal(bundle?.documents.length, 0);
    assert.equal(bundle?.payments.length, 0);

    const shipped = updateOrderFulfillment({
      orderId: order.orderId,
      status: "out_for_delivery",
      skipWarehouse: true,
      actor: "ops@local",
    });
    assert.equal(shipped.fulfillmentStatus, "out_for_delivery");
    assert.match(shipped.dueDate || "", /^\d{4}-\d{2}-\d{2}$/);

    bundle = getOrderBundle(order.orderId);
    const types = bundle?.documents.map((d) => d.documentType) ?? [];
    assert.ok(types.includes("balance_invoice"));
    assert.ok(types.includes("tax_invoice"));
    assert.equal(types.includes("receipt"), false);
    const pay = bundle?.payments.find((p) => p.kind === "remaining");
    assert.equal(pay?.amount, 10_486);

    const open = getOrderRepository().listOpenReceivables();
    assert.equal(open.some((o) => o.orderId === order.orderId), true);

    const paid = confirmPayment({ paymentId: pay!.paymentId, actor: "acc@local" });
    assert.equal(paid.paymentStatus, "paid");
    bundle = getOrderBundle(order.orderId);
    const after = bundle?.documents.map((d) => d.documentType) ?? [];
    assert.equal(after.filter((t) => t === "tax_invoice").length, 1);
    assert.ok(after.includes("receipt"));
    assert.equal(
      getOrderRepository().listOpenReceivables().some((o) => o.orderId === order.orderId),
      false,
    );
  });
});
