import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { teardownTempDir } from "./teardown-temp";
import type { QuoteRequestRecord } from "../lib/quote-types";
import type { OrderRecord } from "../lib/order-types";
import {
  serializePartnerOrder,
  serializePartnerQuote,
} from "../lib/partner-api-serialize";
import {
  decodePartnerCursor,
  encodePartnerCursor,
} from "../lib/partner-api-query";
import {
  hashPartnerSecret,
  mintPartnerApiKey,
  parsePartnerScopes,
  parsePartnerToken,
  verifyDbPartnerToken,
} from "../lib/partner-api-keys";
import {
  parseCatalogLimit,
  scrubPublicCatalogText,
  serializePartnerCatalogProduct,
  serializePartnerCatalogPromotion,
  serializePartnerCatalogRetail,
  toAbsoluteMediaUrl,
} from "../lib/partner-catalog-api";
import { shouldSkipScrapeGuard } from "../lib/scrape-guard";
import type { Product } from "../lib/data";
import type { SkuRecord } from "../lib/sku-master-types";

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
const ENV_KEY = "test-partner-api-key-at-least-32-characters!!";

function quoteFixture(overrides: Partial<QuoteRequestRecord> = {}): QuoteRequestRecord {
  return {
    id: 1,
    requestId: "RFQ-20260907-AABBCCDDEEFF",
    submittedAt: "2026-09-07T00:00:00.000Z",
    name: "Tester",
    company: "Acme",
    email: "lead@acme.example",
    phone: "0812345678",
    quantity: 50,
    budgetPerSet: 400,
    neededDate: null,
    province: "กรุงเทพมหานคร",
    billingBranch: "สำนักงานใหญ่",
    productInterest: "Welcome kit",
    productSlug: "welcome-kit",
    decorationMethod: "uv-print",
    detail: "need mockup",
    consentAt: "2026-09-07T00:00:00.000Z",
    landingPath: "/contact",
    referrer: null,
    utmSource: "google",
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    ipHash: "should-not-leak",
    userAgent: "secret-ua",
    leadStatus: "new",
    webhookStatus: "skipped",
    webhookAttemptCount: 0,
    webhookError: "internal",
    webhookDeliveredAt: null,
    webhookLastAttemptAt: null,
    webhookNextAttemptAt: null,
    rawPayload: JSON.stringify({
      streetAddress: "1 Road",
      district: "จตุจักร",
      taxId: "0105556003873",
      website: "honeypot",
    }),
    customerId: 9,
    salesNotes: "internal note",
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("partner-api contract", () => {
  it("skips scrape-guard so machine clients can call it", () => {
    assert.equal(shouldSkipScrapeGuard("/api/partner/v1/quotes"), true);
    assert.equal(shouldSkipScrapeGuard("/api/partner/v1"), true);
    assert.equal(shouldSkipScrapeGuard("/api/partner/v1/products"), true);
    assert.equal(shouldSkipScrapeGuard("/api/partner/v1/promotions"), true);
    assert.equal(shouldSkipScrapeGuard("/api/partner/v1/retail"), true);
    assert.equal(shouldSkipScrapeGuard("/api/public/brief"), true);
    assert.equal(shouldSkipScrapeGuard("/api/public/catalog/products"), true);
  });

  it("parses scopes and minted token format", () => {
    assert.deepEqual(parsePartnerScopes("quotes:read"), ["quotes:read"]);
    assert.deepEqual(parsePartnerScopes(""), [
      "quotes:read",
      "orders:read",
      "catalog:read",
    ]);
    assert.deepEqual(parsePartnerScopes('["quotes:read"]'), ["quotes:read"]);
    assert.deepEqual(parsePartnerScopes("catalog:read"), ["catalog:read"]);
    const parsed = parsePartnerToken(
      `sgp_aabbccdd.${"ab".repeat(16)}`,
    );
    assert.equal(parsed?.keyId, "aabbccdd");
    assert.equal(hashPartnerSecret("aabbccdd", "secret").length, 64);
  });

  it("catalog product serializer hides factory, MOQ, and prices", () => {
    const product = {
      name: "ชุดของขวัญ (P-02)",
      slug: "demo-set",
      description:
        "สัมผัสพรีเมียมจากซัพพลายเออร์ P-02 — รหัส TSQ01-2 — ราคาตามจำนวน ไม่ใช่ราคาชำระบนเว็บ",
      material: "ชุดของขวัญ",
      minOrder: 50,
      priceRange: "890–1,180 บาท",
      priceMin: 890,
      priceMax: 1180,
      currency: "THB",
      images: ["/images/product-tumbler.jpg"],
      categorySlug: "novelty-self-care",
      categoryName: "Wellness",
      productId: "TSQ01-2",
      leadDays: 21,
      components: [{ name: "แก้ว", qty: 1, sku: "FACTORY-X" }],
      seo: {
        seoTitle: "demo",
        metaDescription: "demo",
        canonicalPath: "/products/demo-set",
      },
    } satisfies Product;

    const row = serializePartnerCatalogProduct(
      product,
      "https://catalog.example",
    );
    const json = JSON.stringify(row);
    assert.equal(row.offerCode, "TSQ01-2");
    assert.equal(row.slug, "demo-set");
    assert.equal(row.images[0], "https://catalog.example/images/product-tumbler.jpg");
    assert.equal(row.components[0]?.name, "แก้ว");
    assert.equal("sku" in (row.components[0] || {}), false);
    assert.equal("minOrder" in row, false);
    assert.equal("priceMin" in row, false);
    assert.equal("priceMax" in row, false);
    assert.equal("priceRange" in row, false);
    assert.equal(row.name.includes("P-02"), false);
    assert.equal(row.description.includes("รหัส"), false);
    assert.equal(row.description.includes("P-02"), false);
    assert.equal(row.description.includes("890"), false);
    assert.equal(json.includes("FACTORY-X"), false);
    assert.match(scrubPublicCatalogText(product.description), /สัมผัสพรีเมียม/);
    assert.equal(parseCatalogLimit("999"), 500);
    assert.equal(parseCatalogLimit(null), 100);
    assert.equal(
      toAbsoluteMediaUrl("/api/sku-files/9", "https://catalog.example"),
      "https://catalog.example/api/sku-files/9",
    );
  });

  it("catalog promotion and retail serializers expose images and retail price only", () => {
    const sku = {
      productId: "C00001",
      stockClass: "C",
      runningNo: 1,
      oriProductId: 9,
      oriProductCode: "FACTORY-ORI",
      oriProductNameTh: "hidden",
      colorNameTh: "ดำ",
      nameTh: "เคลียร์แก้ว",
      nameEn: null,
      sellPriceThb: 199,
      isBundle: false,
      clearanceReason: "กล่องบุบ",
      catalogSlug: "clearance-tumbler",
      imageUrl: "/api/sku-files/1",
      displayImageUrl: "/api/sku-files/1",
      factoryUnitCny: 12,
      factoryUnitUsd: null,
      unitLandedCostThb: 80,
      forcedMinQty: 30,
      pcsPerCtn: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      cartonKg: null,
      dimsAreCarton: true,
      onHandQty: 4,
      tags: ["promo"],
    } satisfies SkuRecord;

    const promo = serializePartnerCatalogPromotion(sku, [
      "https://catalog.example/api/sku-files/1",
      "https://catalog.example/api/sku-files/2",
    ]);
    const promoJson = JSON.stringify(promo);
    assert.equal(promo.onHandQty, 4);
    assert.equal(promo.images.length, 2);
    assert.equal(promo.clearanceReason, "กล่องบุบ");
    assert.deepEqual(promo.tags, ["promo"]);
    assert.equal(promoJson.includes("FACTORY-ORI"), false);
    assert.equal(promoJson.includes("factoryUnit"), false);
    assert.equal(promoJson.includes("forcedMinQty"), false);

    const retail = serializePartnerCatalogRetail(sku, [
      "https://catalog.example/api/sku-files/1",
    ]);
    const retailJson = JSON.stringify(retail);
    assert.equal(retail.sellPriceThb, 199);
    assert.equal(retail.onHandQty, 4);
    assert.equal(retail.currency, "THB");
    assert.equal(retail.images.length, 1);
    assert.equal(retailJson.includes("FACTORY-ORI"), false);
    assert.equal(retailJson.includes("12"), false);
    assert.equal(retailJson.includes("forcedMinQty"), false);
  });

  it("omits secrets from quote and order payloads", () => {
    const quote = serializePartnerQuote(quoteFixture());
    const quoteJson = JSON.stringify(quote);
    assert.equal(quote.streetAddress, "1 Road");
    assert.equal(quote.taxId, "0105556003873");
    assert.equal(quoteJson.includes("should-not-leak"), false);
    assert.equal(quoteJson.includes("secret-ua"), false);
    assert.equal(quoteJson.includes("honeypot"), false);
    assert.equal(quoteJson.includes("internal note"), false);
    assert.equal(quoteJson.includes("internal"), false);
    assert.equal("rawPayload" in quote, false);
    assert.equal("ipHash" in quote, false);
    assert.equal("salesNotes" in quote, false);

    const order = serializePartnerOrder({
      id: 1,
      orderId: "ORD-1",
      quoteRequestId: "RFQ-1",
      customerId: 1,
      company: "Acme",
      contactName: "Tester",
      email: "a@b.c",
      phone: "0812345678",
      billingName: "Acme",
      billingTaxId: null,
      billingAddress: null,
      billingBranch: "0",
      shipToName: null,
      shipToPhone: null,
      shipToAddress: null,
      shipToProvince: null,
      productSummary: "kit",
      quantity: 10,
      currency: "THB",
      vatRate: 7,
      vatMode: "exclusive",
      subtotalExVat: 1000,
      vatAmount: 70,
      totalAmount: 1070,
      depositMode: "auto",
      depositPercent: 50,
      depositAmount: 535,
      remainingAmount: 535,
      paidAmount: 0,
      paymentStatus: "deposit_due",
      fulfillmentStatus: "reserved",
      accessToken: "leak-token",
      notes: "private",
      tags: ["vip"],
      createdAt: "2026-09-07T00:00:00.000Z",
      updatedAt: "2026-09-07T00:00:00.000Z",
    } satisfies OrderRecord);
    const orderJson = JSON.stringify(order);
    assert.equal(orderJson.includes("leak-token"), false);
    assert.equal(orderJson.includes("private"), false);
    assert.equal("accessToken" in order, false);
    assert.equal("notes" in order, false);
    assert.equal("tags" in order, false);
  });

  it("round-trips list cursors", () => {
    const encoded = encodePartnerCursor({
      updatedAt: "2026-09-07T01:02:03.000Z",
      id: 12,
    });
    assert.deepEqual(decodePartnerCursor(encoded), {
      updatedAt: "2026-09-07T01:02:03.000Z",
      id: 12,
    });
    assert.equal(decodePartnerCursor("%%%"), null);
  });
});

describe("partner-api routes", () => {
  let dataDir = "";
  let sqlitePath = "";
  const previousKey = process.env.PARTNER_API_KEY;
  const previousScopes = process.env.PARTNER_API_SCOPES;

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-partner-"));
    sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET =
      "test-ip-hash-secret-at-least-32-characters-long";
    process.env.PARTNER_API_KEY = ENV_KEY;
    process.env.PARTNER_API_SCOPES = "quotes:read,orders:read";
    delete process.env.QUOTE_WEBHOOK_URL;

    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: sqlitePath },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
  });

  after(() => {
    if (previousKey === undefined) delete process.env.PARTNER_API_KEY;
    else process.env.PARTNER_API_KEY = previousKey;
    if (previousScopes === undefined) delete process.env.PARTNER_API_SCOPES;
    else process.env.PARTNER_API_SCOPES = previousScopes;
    teardownTempDir(dataDir);
  });

  it("rejects missing bearer and serves quotes without secrets", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository } = await import("../lib/order-repository");
    resetOrderRepository();

    const { submitQuotePayload } = await import("../lib/quote-service");
    const { GET: catalogGet } = await import("../app/api/partner/v1/route");
    const { GET: quotesGet } = await import("../app/api/partner/v1/quotes/route");
    const { GET: quoteGet } = await import(
      "../app/api/partner/v1/quotes/[requestId]/route"
    );

    const denied = await catalogGet(
      new Request("http://localhost/api/partner/v1"),
    );
    assert.equal(denied.status, 401);

    const headers = new Headers({
      "x-real-ip": "203.0.113.44",
      authorization: `Bearer ${ENV_KEY}`,
    });
    const submitted = await submitQuotePayload(
      {
        name: "Partner Lead",
        company: "Partner Co",
        email: "partner@acme.example",
        phone: "0811111111",
        quantity: 20,
        consent: true,
        decorationMethod: "laser",
        website: "",
        startedAt: Date.now() - 5_000,
        streetAddress: "88 Partner Rd",
        taxId: "0105556003873",
      },
      { headers, userAgent: "node-test" },
    );
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;

    updateQuoteOps({
      requestId: submitted.requestId,
      leadStatus: "contacted",
      timelineNote: "called",
    });

    const catalog = await catalogGet(
      new Request("http://localhost/api/partner/v1", { headers }),
    );
    assert.equal(catalog.status, 200);
    const catalogBody = (await catalog.json()) as { ok: boolean; version: string };
    assert.equal(catalogBody.ok, true);
    assert.equal(catalogBody.version, "v1");

    const list = await quotesGet(
      new Request("http://localhost/api/partner/v1/quotes?limit=10", { headers }),
    );
    assert.equal(list.status, 200);
    const listBody = (await list.json()) as {
      ok: boolean;
      data: Array<Record<string, unknown>>;
    };
    assert.equal(listBody.ok, true);
    assert.equal(listBody.data.some((row) => row.requestId === submitted.requestId), true);
    const listed = JSON.stringify(listBody);
    assert.equal(listed.includes("node-test"), false);
    assert.equal(listed.includes("ipHash"), false);

    const detail = await quoteGet(
      new Request(`http://localhost/api/partner/v1/quotes/${submitted.requestId}`, {
        headers,
      }),
      { params: Promise.resolve({ requestId: submitted.requestId }) },
    );
    assert.equal(detail.status, 200);
    const detailBody = (await detail.json()) as {
      ok: boolean;
      data: { streetAddress: string | null; taxId: string | null };
      timeline: unknown[];
    };
    assert.equal(detailBody.data.streetAddress, "88 Partner Rd");
    assert.equal(detailBody.data.taxId, "0105556003873");
    assert.ok(detailBody.timeline.length >= 1);
  });

  it("mints a db key, hides order accessToken, and forbids missing scopes", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository } = await import("../lib/order-repository");
    resetOrderRepository();

    const minted = mintPartnerApiKey({
      name: "n8n",
      scopes: ["quotes:read"],
    });
    assert.ok(verifyDbPartnerToken(minted.token));

    const quotesOnly = new Headers({
      authorization: `Bearer ${minted.token}`,
    });
    const { GET: ordersGet } = await import("../app/api/partner/v1/orders/route");
    const forbidden = await ordersGet(
      new Request("http://localhost/api/partner/v1/orders", { headers: quotesOnly }),
    );
    assert.equal(forbidden.status, 403);

    const { submitQuotePayload } = await import("../lib/quote-service");
    const { createOrderFromQuote } = await import("../lib/order-service");
    const { GET: orderGet } = await import(
      "../app/api/partner/v1/orders/[orderId]/route"
    );

    const submitted = await submitQuotePayload(
      {
        name: "Order Lead",
        company: "Order Co",
        email: "order@acme.example",
        phone: "0822222222",
        quantity: 30,
        consent: true,
        decorationMethod: "embroidery",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers: new Headers({ "x-real-ip": "203.0.113.55" }) },
    );
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    updateQuoteOps({ requestId: submitted.requestId, leadStatus: "quoted" });
    const order = createOrderFromQuote({
      quoteRequestId: submitted.requestId,
      amount: 10_000,
    });

    const fullHeaders = new Headers({ authorization: `Bearer ${ENV_KEY}` });
    const found = await orderGet(
      new Request(`http://localhost/api/partner/v1/orders/${order.orderId}`, {
        headers: fullHeaders,
      }),
      { params: Promise.resolve({ orderId: order.orderId }) },
    );
    assert.equal(found.status, 200);
    const body = (await found.json()) as {
      data: Record<string, unknown>;
      payments: unknown[];
    };
    assert.equal(body.data.orderId, order.orderId);
    assert.equal("accessToken" in body.data, false);
    assert.equal(JSON.stringify(body).includes(order.accessToken), false);
    assert.ok(Array.isArray(body.payments));
  });

  it("returns 503 when partner api is not configured", async () => {
    delete process.env.PARTNER_API_KEY;
    const { closeDb, getDb } = await import("../lib/database");
    closeDb();
    getDb()
      .prepare(
        `UPDATE partner_api_keys
         SET enabled = 0, revoked_at = ?, updated_at = ?`,
      )
      .run(new Date().toISOString(), new Date().toISOString());
    const { GET: catalogGet } = await import("../app/api/partner/v1/route");
    const response = await catalogGet(
      new Request("http://localhost/api/partner/v1", {
        headers: { authorization: `Bearer ${ENV_KEY}` },
      }),
    );
    assert.equal(response.status, 503);
    process.env.PARTNER_API_KEY = ENV_KEY;
  });
});
