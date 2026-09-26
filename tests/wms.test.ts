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

describe("WMS stock: receive, reserve, ship, void, transfer, cycle count", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-wms-"));
    sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET =
      "test-ip-hash-secret-at-least-32-characters-long";
    process.env.SITE_TAX_ID = "0105556003873";
    process.env.PROMPTPAY_ID = "0105556003873";
    process.env.WMS_STORE = "sqlite";
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

    const headers = new Headers({ "x-forwarded-for": "203.0.113.99" });
    const quoteResult = await submitQuotePayload(
      {
        name: "WMS Tester",
        company: "บริษัท คลังทดสอบ จำกัด",
        email: `wms-${Date.now()}@acme.example`,
        phone: "0819998877",
        quantity: 40,
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
      amount: 16_000,
      vatMode: "exclusive",
    });
    const deposit = getOrderBundle(order.orderId)?.payments[0];
    assert.ok(deposit);
    confirmPayment({ paymentId: deposit!.paymentId });

    const po = saveFactoryPo({
      orderId: order.orderId,
      factoryName: "WMS Factory",
      factoryPlatform: "factory_direct",
      productName: order.productSummary,
      quantity: 40,
      fxCnyThb: 5,
      factoryUnitCny: 8,
      inlandThb: 100,
      freightThb: 500,
      importDutyThb: 50,
      customsFeeThb: 20,
      packingThb: 40,
      lastMileThb: 80,
      status: "confirmed",
      destinationMode: "warehouse",
      sourceOfferId: "WMS-SKU-01",
    });
    return { order, po };
  }

  it("receive → reserve → available drops → ship zeros stock", async () => {
    const { order, po } = await seedOrderAndPo();
    const { receiveGoods } = await import("../lib/ops-cycle-service");
    const { sumAvailable, sumOnHand, listOpenReservationsForOrder } =
      await import("../lib/wms-repository");
    const { updateOrderFulfillment, confirmPayment, getOrderBundle } =
      await import("../lib/order-service");

    const gr = receiveGoods({
      poId: po.poId,
      qtyReceived: 40,
      destination: "warehouse",
      productKey: "WMS-SKU-01",
    });
    assert.equal(gr.productKey, "WMS-SKU-01");
    assert.equal(sumOnHand("WMS-SKU-01"), 40);
    assert.equal(sumAvailable("WMS-SKU-01"), 0);
    assert.equal(listOpenReservationsForOrder(order.orderId).length, 1);

    const bundle = getOrderBundle(order.orderId);
    assert.ok(bundle);
    for (const pay of bundle!.payments.filter(
      (p) => p.status === "pending" || p.status === "submitted",
    )) {
      confirmPayment({ paymentId: pay.paymentId });
    }

    updateOrderFulfillment({
      orderId: order.orderId,
      status: "out_for_delivery",
    });
    assert.equal(sumOnHand("WMS-SKU-01"), 0);
    assert.equal(listOpenReservationsForOrder(order.orderId).length, 0);
  });

  it("rejects oversell and supports void + transfer + cycle count", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { receiveToStock, reserveForOrder, adjustStock, transferStock, postCycleCount, voidReceiveFromStock } =
      await import("../lib/wms-service");
    const { sumOnHand, getLocationByCode } = await import("../lib/wms-repository");
    const { getWmsStoreMode, wmsSyncStatus } = await import("../lib/wms-sync");

    assert.equal(getWmsStoreMode(), "sqlite");
    assert.equal(wmsSyncStatus().ok, true);

    const first = receiveToStock({
      productKey: "ADJ-SKU",
      qty: 10,
      receiptId: "GR-TEST-ADJ-1",
    });
    assert.equal(first.balance.qtyOnHand, 10);

    assert.throws(
      () =>
        reserveForOrder({
          orderId: "ORD-OVERSELL",
          productKey: "ADJ-SKU",
          qty: 99,
        }),
      /insufficient_stock/,
    );

    transferStock({
      productKey: "ADJ-SKU",
      qty: 3,
      fromLocationCodeOrId: "BIN-DEFAULT",
      toLocationCodeOrId: "BIN-QC",
    });
    const qc = getLocationByCode("BIN-QC");
    assert.ok(qc);
    assert.equal(sumOnHand("ADJ-SKU"), 10);

    adjustStock({ productKey: "ADJ-SKU", qtyDelta: -1, locationCodeOrId: "BIN-DEFAULT" });
    assert.equal(sumOnHand("ADJ-SKU"), 9);

    // After transfer+adjust: DEFAULT=6, QC=3. Count DEFAULT to 5 → variance -1.
    const count = postCycleCount({
      productKey: "ADJ-SKU",
      qtyCounted: 5,
      locationCodeOrId: "BIN-DEFAULT",
    });
    assert.equal(count.qtyVariance, -1);

    voidReceiveFromStock({
      receiptId: "GR-TEST-ADJ-1",
      productKey: "ADJ-SKU",
      qty: 5,
      locationId: getLocationByCode("BIN-DEFAULT")!.id,
    });
    assert.equal(sumOnHand("ADJ-SKU"), 3);
  });
});
