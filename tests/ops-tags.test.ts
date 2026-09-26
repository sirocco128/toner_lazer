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

describe("ops tags on customers, orders, and cash receipts", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-ops-tags-"));
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

  it("parses JSON, commas, and Thai labels into unique lowercase tags", async () => {
    const { parseOpsTags, serializeOpsTags } = await import("../lib/ops-tags");
    assert.deepEqual(parseOpsTags("VIP, ปีใหม่, vip"), ["vip", "ปีใหม่"]);
    assert.deepEqual(parseOpsTags('["ด่วน","ตัวอย่าง"]'), ["ด่วน", "ตัวอย่าง"]);
    assert.equal(serializeOpsTags(["  Event ", "event", ""]), '["event"]');
    assert.equal(serializeOpsTags([]), null);
  });

  it("saves tags on customer, order, and voucher without copying customer tags onto the bill", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { createCustomer } = await import("../lib/customer-repository");
    const { listDistinctOpsTags, listEntityTags } = await import(
      "../lib/ops-tag-links"
    );
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository, getOrderRepository } = await import(
      "../lib/order-repository"
    );
    resetOrderRepository();
    const { submitQuotePayload } = await import("../lib/quote-service");
    const { createOrderFromQuote } = await import("../lib/order-service");
    const { createCashReceipt, setCashReceiptTags, getCashReceipt } =
      await import("../lib/ops-cycle-service");

    const customer = createCustomer({
      company: "บริษัท แท็กทดสอบ จำกัด",
      email: `tags-${Date.now()}@acme.example`,
      contactName: "คุณแท็ก",
      customerType: "company",
      source: "manual",
      tags: ["VIP", "hr"],
    });
    assert.deepEqual(customer.tags, ["vip", "hr"]);
    assert.deepEqual(listEntityTags("customer", String(customer.id)).sort(), [
      "hr",
      "vip",
    ]);

    const headers = new Headers({ "x-forwarded-for": "203.0.113.88" });
    const quoteResult = await submitQuotePayload(
      {
        name: "คุณแท็ก",
        company: customer.company,
        email: customer.email,
        phone: "0812345678",
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

    updateQuoteOps({
      requestId: quoteResult.requestId,
      leadStatus: "quoted",
    });
    const order = createOrderFromQuote({
      quoteRequestId: quoteResult.requestId,
      amount: 12_000,
    });
    assert.deepEqual(order.tags, []);

    const tagged = getOrderRepository().updateOrderTags(order.orderId, [
      "ปีใหม่",
      "ด่วน",
    ]);
    assert.deepEqual(tagged, ["ปีใหม่", "ด่วน"]);
    const listed = getOrderRepository().listOrders({ tag: "ปีใหม่" });
    assert.equal(listed.some((row) => row.orderId === order.orderId), true);
    assert.equal(
      getOrderRepository().listOrders({ tag: "vip" }).some(
        (row) => row.orderId === order.orderId,
      ),
      false,
    );

    const voucher = createCashReceipt({
      payerName: customer.company,
      orderId: order.orderId,
      tags: ["esg", "ตัวอย่าง"],
      lines: [{ kind: "deposit", description: "มัดจำ", amount: 1_000 }],
    });
    assert.deepEqual(voucher.tags, ["esg", "ตัวอย่าง"]);
    const updatedVoucher = setCashReceiptTags(voucher.voucherId, [
      "esg",
      "ของขวัญลูกค้า",
    ]);
    assert.deepEqual(updatedVoucher, ["esg", "ของขวัญลูกค้า"]);
    assert.deepEqual(getCashReceipt(voucher.voucherId)?.tags, [
      "esg",
      "ของขวัญลูกค้า",
    ]);
    assert.deepEqual(
      listEntityTags("voucher", voucher.voucherId).sort(),
      ["esg", "ของขวัญลูกค้า"].sort(),
    );

    const distinct = listDistinctOpsTags();
    assert.ok(distinct.includes("vip"));
    assert.ok(distinct.includes("ปีใหม่"));
    assert.ok(distinct.includes("ของขวัญลูกค้า"));
  });
});
