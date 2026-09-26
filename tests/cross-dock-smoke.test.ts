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

describe("Cross-dock smoke: ASN → XDOCK receive → Ship Confirm", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-xdock-"));
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

  it("full MTO path lands on BIN-XDOCK then ships to zero", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository } = await import("../lib/order-repository");
    resetOrderRepository();

    const { submitQuotePayload } = await import("../lib/quote-service");
    const { createOrderFromQuote, confirmPayment, getOrderBundle, updateOrderFulfillment } =
      await import("../lib/order-service");
    const { saveFactoryPo } = await import("../lib/factory-po-service");
    const { receiveGoods } = await import("../lib/ops-cycle-service");
    const {
      getLocationByCode,
      sumOnHand,
      sumAvailable,
      listBalances,
      listOpenReservationsForOrder,
      ensureDefaultLocations,
    } = await import("../lib/wms-repository");
    const {
      listInTransitPos,
      listReadyPackRows,
      listXdockBalances,
    } = await import("../lib/wms-ops-queues");
    const { XDOCK_LOCATION_CODE } = await import("../lib/wms-types");

    const headers = new Headers({ "x-forwarded-for": "203.0.113.88" });
    const quoteResult = await submitQuotePayload(
      {
        name: "XDock Smoke",
        company: "บริษัท Cross Dock ทดสอบ จำกัด",
        email: `xdock-${Date.now()}@acme.example`,
        phone: "0811112233",
        quantity: 12,
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
      amount: 9_600,
      vatMode: "exclusive",
    });
    const deposit = getOrderBundle(order.orderId)?.payments[0];
    assert.ok(deposit);
    confirmPayment({ paymentId: deposit!.paymentId });

    const po = saveFactoryPo({
      orderId: order.orderId,
      factoryName: "XDock Factory",
      factoryPlatform: "factory_direct",
      productName: order.productSummary,
      quantity: 12,
      fxCnyThb: 5,
      factoryUnitCny: 10,
      inlandThb: 50,
      freightThb: 200,
      importDutyThb: 30,
      customsFeeThb: 10,
      packingThb: 20,
      lastMileThb: 40,
      status: "shipped",
      destinationMode: "warehouse",
      receiveMode: "cross_dock",
      sourceOfferId: "XD-SKU-01",
      asnContainer: "CNTR-SMOKE-01",
      asnEta: "2026-09-20",
      asnQty: 12,
      trackingCn: "CN-TRACK-99",
    });

    assert.equal(po.receiveMode, "cross_dock");
    assert.equal(po.asnContainer, "CNTR-SMOKE-01");
    assert.equal(listInTransitPos().some((row) => row.poId === po.poId), true);

    ensureDefaultLocations();
    const xdock = getLocationByCode(XDOCK_LOCATION_CODE);
    assert.ok(xdock, "BIN-XDOCK missing");

    const gr = receiveGoods({
      poId: po.poId,
      qtyReceived: 12,
      destination: "warehouse",
      productKey: "XD-SKU-01",
      receiveMode: "cross_dock",
    });
    assert.equal(gr.productKey, "XD-SKU-01");
    assert.equal(gr.locationId, xdock!.id);

    const bal = listBalances({ productKey: "XD-SKU-01", limit: 10 }).find(
      (b) => b.locationCode === XDOCK_LOCATION_CODE,
    );
    assert.ok(bal);
    assert.equal(bal!.qtyOnHand, 12);
    assert.equal(sumOnHand("XD-SKU-01"), 12);
    assert.equal(sumAvailable("XD-SKU-01"), 0);
    assert.equal(listOpenReservationsForOrder(order.orderId).length, 1);
    assert.equal(listXdockBalances().some((b) => b.productKey === "XD-SKU-01"), true);

    const bundle = getOrderBundle(order.orderId);
    assert.ok(bundle);
    for (const pay of bundle!.payments.filter(
      (p) => p.status === "pending" || p.status === "submitted",
    )) {
      confirmPayment({ paymentId: pay.paymentId });
    }

    const ready = listReadyPackRows(20);
    assert.equal(
      ready.some((r) => r.order.orderId === order.orderId),
      true,
      "ready-pack queue missing order",
    );

    updateOrderFulfillment({
      orderId: order.orderId,
      status: "out_for_delivery",
    });
    assert.equal(sumOnHand("XD-SKU-01"), 0);
    assert.equal(listOpenReservationsForOrder(order.orderId).length, 0);

    console.log(
      JSON.stringify(
        {
          ok: true,
          orderId: order.orderId,
          poId: po.poId,
          receiptId: gr.receiptId,
          location: XDOCK_LOCATION_CODE,
          flow: "ASN → receive XDOCK → reserve → Ship Confirm → stock 0",
        },
        null,
        2,
      ),
    );
  });
});
