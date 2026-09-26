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

describe("ops cycle: GR, supplier pay, cash receipt, issues", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-cycle-"));
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

  async function seedOrderAndPo() {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository } = await import("../lib/order-repository");
    resetOrderRepository();

    const { submitQuotePayload } = await import("../lib/quote-service");
    const { createOrderFromQuote, confirmPayment, getOrderBundle } =
      await import("../lib/order-service");
    const { saveFactoryPo } = await import("../lib/factory-po-service");

    const headers = new Headers({ "x-forwarded-for": "203.0.113.88" });
    const quoteResult = await submitQuotePayload(
      {
        name: "Cycle Tester",
        company: "บริษัท วงจรรับของ จำกัด",
        email: `cycle-${Date.now()}@acme.example`,
        phone: "0812223344",
        quantity: 50,
        consent: true,
        decorationMethod: "screen-print",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers },
    );
    assert.equal(quoteResult.ok, true);
    if (!quoteResult.ok) throw new Error("quote_failed");
    updateQuoteOps({ requestId: quoteResult.requestId, leadStatus: "won" });

    const order = createOrderFromQuote({
      quoteRequestId: quoteResult.requestId,
      amount: 20_000,
      vatMode: "exclusive",
    });
    const deposit = getOrderBundle(order.orderId)?.payments[0];
    assert.ok(deposit);
    confirmPayment({ paymentId: deposit!.paymentId });

    const po = saveFactoryPo({
      orderId: order.orderId,
      factoryName: "Guangzhou Cycle Factory",
      factoryPlatform: "factory_direct",
      productName: order.productSummary,
      quantity: 50,
      fxCnyThb: 5,
      factoryUnitCny: 10,
      inlandThb: 250,
      freightThb: 1_000,
      importDutyThb: 200,
      customsFeeThb: 50,
      packingThb: 100,
      lastMileThb: 200,
      status: "confirmed",
      destinationMode: "warehouse",
    });
    return { order, po };
  }

  it("pays factory only up to received amount", async () => {
    const { po } = await seedOrderAndPo();
    const {
      receiveGoods,
      payFactoryForReceived,
      factoryPayableSnapshot,
    } = await import("../lib/ops-cycle-service");

    const gr = receiveGoods({
      poId: po.poId,
      qtyReceived: 20,
      destination: "warehouse",
      productKey: "CYCLE-SKU-01",
    });
    assert.equal(gr.qtyReceived, 20);
    assert.ok(gr.amountThb > 0);

    const snap = factoryPayableSnapshot(po.poId);
    assert.ok(snap);
    assert.equal(snap!.receivedQty, 20);
    assert.equal(snap!.remainingQty, 30);

    const pay = payFactoryForReceived({
      poId: po.poId,
      amount: snap!.unpaidAmount,
    });
    assert.equal(pay.amount, snap!.unpaidAmount);
    assert.equal(pay.payableKind, "factory");

    const { listJournals } = await import("../lib/ledger-repository");
    const books = listJournals({ poId: po.poId, limit: 30 });
    assert.ok(books.some((j) => j.sourceKey.startsWith("inv:")));
    assert.ok(books.some((j) => j.lines.some((line) => line.accountCode === "1140")));

    const freightPay = payFactoryForReceived({
      poId: po.poId,
      amount: snap!.unpaidFreight,
      payableKind: "freight",
    });
    assert.equal(freightPay.payableKind, "freight");
    assert.ok(
      listJournals({ poId: po.poId, limit: 30 }).some((j) =>
        j.lines.some((line) => line.accountCode === "2140" && line.debit > 0),
      ),
    );

    assert.throws(
      () =>
        payFactoryForReceived({
          poId: po.poId,
          amount: 1,
        }),
      /pay_exceeds_received/,
    );
  });

  it("rejects cash receipt with no lines and creates issue tickets", async () => {
    const { createCashReceipt, createIssueTicket, claimFromIssue } = await import(
      "../lib/ops-cycle-service"
    );
    assert.throws(
      () =>
        createCashReceipt({
          payerName: "ทดสอบ",
          lines: [{ kind: "deposit", description: "มัดจำ", amount: 0 }],
        }),
      /lines_required/,
    );

    const voucher = createCashReceipt({
      payerName: "บริษัท วงจรรับของ จำกัด",
      lines: [
        { kind: "deposit", description: "มัดจำ", amount: 1_000 },
        { kind: "remaining", description: "ส่วนที่เหลือ", amount: 500 },
      ],
    });
    assert.equal(voucher.totalAmount, 1_500);
    assert.equal(voucher.lines.length, 2);
    assert.ok(voucher.qrPayload);

    const issue = createIssueTicket({
      source: "public",
      company: "บริษัท วงจรรับของ จำกัด",
      contactName: "คุณทดสอบ",
      email: "cycle@acme.example",
      category: "logo",
      title: "สกรีนโลโก้เพี้ยน",
      detail: "สีโลโก้ไม่ตรงตัวอย่างที่ส่งให้ตรวจก่อนผลิต",
    });
    assert.match(issue.issueId, /^ISS-/);
    assert.equal(issue.status, "open");
    assert.equal(issue.category, "logo");

    const first = claimFromIssue({ issueId: issue.issueId });
    assert.match(first.claimId, /^CLM-/);
    assert.equal(first.against, "factory");
    assert.equal(first.issueId, issue.issueId);
    const second = claimFromIssue({ issueId: issue.issueId });
    assert.equal(second.claimId, first.claimId);
  });

  it("opens a factory claim when goods receipt has damaged qty", async () => {
    const { po } = await seedOrderAndPo();
    const { receiveGoods, getClaimByReceiptId, listClaims } = await import(
      "../lib/ops-cycle-service"
    );
    const gr = receiveGoods({
      poId: po.poId,
      qtyReceived: 18,
      qtyDamaged: 2,
      destination: "warehouse",
      productKey: "CYCLE-SKU-DMG",
      qcNotes: "สกรีนโลโก้หลุด",
    });
    const claim = getClaimByReceiptId(gr.receiptId);
    assert.ok(claim);
    assert.equal(claim!.against, "factory");
    assert.equal(claim!.qty, 2);
    assert.ok(claim!.amountThb > 0);
    assert.match(claim!.reason, /ของเสีย/);
    assert.ok(listClaims().some((c) => c.receiptId === gr.receiptId));
  });

  it("rejects a cash receipt with a required reason without confirming money", async () => {
    const { createCashReceipt, rejectCashReceipt, getCashReceipt } = await import(
      "../lib/ops-cycle-service"
    );
    const voucher = createCashReceipt({
      payerName: "บริษัท วงจรรับของ จำกัด",
      lines: [{ kind: "extra", description: "รายการรับอื่น", amount: 1_000 }],
    });
    assert.throws(
      () => rejectCashReceipt({ voucherId: voucher.voucherId, reason: "x" }),
      /reject_reason_required/,
    );

    const rejected = rejectCashReceipt({
      voucherId: voucher.voucherId,
      actor: "acct@local",
      reason: "สลิปไม่ชัด อ่านยอดไม่ได้",
    });
    assert.equal(rejected.status, "open");
    assert.equal(rejected.rejectReason, "สลิปไม่ชัด อ่านยอดไม่ได้");
    assert.equal(getCashReceipt(voucher.voucherId)?.status, "open");
  });
});
