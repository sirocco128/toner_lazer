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

describe("Thai order revenue cycle", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-order-"));
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

  it("quotes → deposit VAT invoice → remaining → tax invoice on warehouse", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository, getOrderRepository } = await import(
      "../lib/order-repository"
    );
    resetOrderRepository();

    const { submitQuotePayload } = await import("../lib/quote-service");
    const {
      createOrderFromQuote,
      confirmPayment,
      updateOrderFulfillment,
      getOrderBundle,
      lookupOrders,
    } = await import("../lib/order-service");

    const headers = new Headers({ "x-forwarded-for": "203.0.113.88" });
    const quoteResult = await submitQuotePayload(
      {
        name: "Somchai Billing",
        company: "บริษัท ตัวอย่าง จำกัด",
        email: "billing@acme.example",
        phone: "0812345678",
        quantity: 100,
        consent: true,
        decorationMethod: "screen-print",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers },
    );
    assert.equal(quoteResult.ok, true);
    if (!quoteResult.ok) return;

    assert.throws(
      () =>
        createOrderFromQuote({
          quoteRequestId: quoteResult.requestId,
          amount: 20_000,
        }),
      /quote_not_ready/,
    );

    updateQuoteOps({
      requestId: quoteResult.requestId,
      leadStatus: "quoted",
    });

    const order = createOrderFromQuote({
      quoteRequestId: quoteResult.requestId,
      amount: 20_000,
      vatMode: "exclusive",
      depositMode: "auto",
      billingTaxId: "0105556003873",
      billingAddress: "กรุงเทพมหานคร",
      actor: "sales@local",
    });

    assert.equal(order.subtotalExVat, 20_000);
    assert.equal(order.vatAmount, 1_400);
    assert.equal(order.totalAmount, 21_400);
    assert.equal(order.depositAmount, 10_700);
    assert.equal(order.remainingAmount, 10_700);
    assert.equal(order.paymentStatus, "deposit_due");
    assert.equal(order.fulfillmentStatus, "reserved");

    let bundle = getOrderBundle(order.orderId);
    assert.ok(bundle);
    assert.equal(
      bundle?.documents.some((d) => d.documentType === "deposit_invoice"),
      true,
    );
    const depositPay = bundle?.payments.find((p) => p.kind === "deposit");
    assert.ok(depositPay);
    assert.ok(depositPay?.qrPayload?.startsWith("000201"));

    const afterDeposit = confirmPayment({
      paymentId: depositPay!.paymentId,
      actor: "sales@local",
    });
    assert.equal(afterDeposit.paymentStatus, "deposit_paid");
    assert.equal(afterDeposit.fulfillmentStatus, "awaiting_production");

    const atWarehouse = updateOrderFulfillment({
      orderId: order.orderId,
      status: "warehouse",
      actor: "sales@local",
    });
    assert.equal(atWarehouse.paymentStatus, "balance_due");
    bundle = getOrderBundle(order.orderId);
    assert.equal(
      bundle?.documents.some((d) => d.documentType === "balance_invoice"),
      true,
    );
    const remainingPay = bundle?.payments.find((p) => p.kind === "remaining");
    assert.ok(remainingPay);

    const paid = confirmPayment({
      paymentId: remainingPay!.paymentId,
      actor: "sales@local",
    });
    assert.equal(paid.paymentStatus, "paid");
    bundle = getOrderBundle(order.orderId);
    assert.equal(
      bundle?.documents.some((d) => d.documentType === "tax_invoice"),
      true,
    );
    assert.equal(
      bundle?.documents.some((d) => d.documentType === "receipt"),
      true,
    );

    const found = lookupOrders({
      email: "billing@acme.example",
      phone: "081-234-5678",
    });
    assert.equal(found.length, 1);
    assert.equal(found[0]?.orderId, order.orderId);

    const repo = getOrderRepository();
    assert.equal(repo.countOrders({ paymentStatus: "paid" }), 1);
  });

  it("blocks shipping until the remaining balance is paid", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository } = await import("../lib/order-repository");
    resetOrderRepository();
    const { submitQuotePayload } = await import("../lib/quote-service");
    const { createOrderFromQuote, confirmPayment, updateOrderFulfillment, getOrderBundle } =
      await import("../lib/order-service");

    const headers = new Headers({ "x-forwarded-for": "203.0.113.89" });
    const quoteResult = await submitQuotePayload(
      {
        name: "Nok Ship",
        company: "Ship Co",
        email: "ship@acme.example",
        phone: "0891112233",
        quantity: 40,
        consent: true,
        decorationMethod: "laser",
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
      amount: 15_000,
      vatMode: "exclusive",
    });
    const depositPay = getOrderBundle(order.orderId)?.payments[0];
    assert.ok(depositPay);
    confirmPayment({ paymentId: depositPay!.paymentId });
    updateOrderFulfillment({ orderId: order.orderId, status: "warehouse" });

    assert.throws(
      () =>
        updateOrderFulfillment({
          orderId: order.orderId,
          status: "out_for_delivery",
        }),
      /balance_required/,
    );
  });

  it("lets accounting reject a submitted amount with a reason, then customer resubmits", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository, getOrderRepository } = await import(
      "../lib/order-repository"
    );
    resetOrderRepository();
    const { submitQuotePayload } = await import("../lib/quote-service");
    const {
      createOrderFromQuote,
      confirmPayment,
      getOrderBundle,
      rejectPayment,
      submitCustomerPayment,
    } = await import("../lib/order-service");
    const { listApprovalQueue } = await import("../lib/payment-approval");

    const headers = new Headers({ "x-forwarded-for": "203.0.113.91" });
    const quoteResult = await submitQuotePayload(
      {
        name: "Account Approver",
        company: "บริษัท บัญชีอนุมัติ จำกัด",
        email: "acct-approve@acme.example",
        phone: "0815556677",
        quantity: 30,
        consent: true,
        decorationMethod: "screen-print",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers },
    );
    assert.equal(quoteResult.ok, true);
    if (!quoteResult.ok) return;
    updateQuoteOps({ requestId: quoteResult.requestId, leadStatus: "quoted" });

    const order = createOrderFromQuote({
      quoteRequestId: quoteResult.requestId,
      amount: 10_000,
      vatMode: "exclusive",
    });
    const deposit = getOrderBundle(order.orderId)?.payments.find((p) => p.kind === "deposit");
    assert.ok(deposit);

    submitCustomerPayment({
      orderId: order.orderId,
      token: order.accessToken,
      paymentId: deposit!.paymentId,
      reference: "โอน 20:00 น.",
    });
    const queued = listApprovalQueue();
    assert.equal(
      queued.some((row) => row.id === deposit!.paymentId),
      true,
    );

    assert.throws(
      () =>
        rejectPayment({
          paymentId: deposit!.paymentId,
          reason: "ไม่",
        }),
      /reject_reason_required/,
    );

    const rejected = rejectPayment({
      paymentId: deposit!.paymentId,
      actor: "acct@local",
      reason: "ยอดในสลิปไม่ตรง",
    });
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectReason, "ยอดในสลิปไม่ตรง");
    assert.equal(getOrderBundle(order.orderId)?.order.paidAmount, 0);
    assert.equal(
      listApprovalQueue().some((row) => row.id === deposit!.paymentId),
      false,
    );

    const resubmitted = submitCustomerPayment({
      orderId: order.orderId,
      token: order.accessToken,
      paymentId: deposit!.paymentId,
      reference: "โอนใหม่ 21:00 น.",
    });
    assert.equal(resubmitted.status, "submitted");
    assert.equal(resubmitted.rejectReason, null);

    const paid = confirmPayment({
      paymentId: deposit!.paymentId,
      actor: "acct@local",
    });
    assert.equal(paid.paymentStatus, "deposit_paid");
    assert.ok(paid.paidAmount > 0);
    assert.equal(
      getOrderRepository().getPaymentByPaymentId(deposit!.paymentId)?.status,
      "confirmed",
    );
  });
});
