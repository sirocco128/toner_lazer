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

describe("customer CRM depth + merge + LINE link", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-crm-"));
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

  it("creates a walk-in customer and groups by type/source", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const {
      createCustomer,
      listCustomers,
      countCustomers,
      listCustomerContacts,
    } = await import("../lib/customer-repository");
    const { isCustomerTaxReady } = await import("../lib/customer-billing");
    const { normalizeCompanyName } = await import("../lib/customer-dedupe");

    const created = createCustomer({
      company: "บริษัท เอซีเอ็มอี จำกัด",
      email: "walkin@acme.example",
      contactName: "คุณเอ",
      phone: "0811111111",
      lineId: "@acme",
      taxId: "0105556003873",
      billingAddress: "กรุงเทพมหานคร",
      customerType: "agency",
      source: "manual",
      tags: ["vip", "event"],
    });
    assert.equal(created.customerType, "agency");
    assert.equal(created.source, "manual");
    assert.equal(created.quoteCount, 0);
    assert.equal(isCustomerTaxReady(created), true);
    assert.equal(listCustomerContacts(created.id).length, 1);

    const filtered = listCustomers({ customerType: "agency", tag: "vip" });
    assert.equal(filtered.some((c) => c.id === created.id), true);
    assert.equal(countCustomers({ source: "manual" }) >= 1, true);
    assert.equal(
      normalizeCompanyName("บริษัท เอซีเอ็มอี จำกัด"),
      normalizeCompanyName("เอซีเอ็มอี จำกัด (มหาชน)"),
    );
    assert.equal(normalizeCompanyName("ACME Co., Ltd."), normalizeCompanyName("Acme Co Ltd"));
  });

  it("does not copy quote province into billing address", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository } = await import("../lib/order-repository");
    resetOrderRepository();
    const { submitQuotePayload } = await import("../lib/quote-service");
    const { createOrderFromQuote } = await import("../lib/order-service");
    const { getCustomerByEmail } = await import("../lib/customer-repository");
    const { buildOrderBillingDefaults } = await import("../lib/customer-billing");
    const { getQuoteByRequestId } = await import("../lib/quote-repository");

    const headers = new Headers({ "x-forwarded-for": "203.0.113.44" });
    const quoteResult = await submitQuotePayload(
      {
        name: "Ship To",
        company: "เชียงใหม่โฮลดิ้ง",
        email: "ship@chiangmai.example",
        phone: "0822222222",
        quantity: 80,
        consent: true,
        decorationMethod: "uv-print",
        province: "เชียงใหม่",
        billingBranch: "สาขาที่ 1 (00001)",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers },
    );
    assert.equal(quoteResult.ok, true);
    if (!quoteResult.ok) return;

    assert.equal(
      getQuoteByRequestId(quoteResult.requestId)?.billingBranch,
      "สาขาที่ 1 (00001)",
    );

    updateQuoteOps({ requestId: quoteResult.requestId, leadStatus: "quoted" });
    const customer = getCustomerByEmail("ship@chiangmai.example");
    assert.equal(customer?.defaultShipProvince, "เชียงใหม่");
    const defaults = buildOrderBillingDefaults(customer, "เชียงใหม่โฮลดิ้ง");
    assert.equal(defaults.billingAddress, "");

    const order = createOrderFromQuote({
      quoteRequestId: quoteResult.requestId,
      amount: 20_000,
      vatMode: "exclusive",
      billingTaxId: "0105556003873",
      billingAddress: "ถนนสาทร กรุงเทพฯ",
      saveBillingDefaults: true,
    });
    assert.equal(order.billingAddress, "ถนนสาทร กรุงเทพฯ");
    assert.notEqual(order.billingAddress, "เชียงใหม่");
    assert.equal(order.shipToProvince, "เชียงใหม่");

    const refreshed = getCustomerByEmail("ship@chiangmai.example");
    assert.equal(refreshed?.taxId, "0105556003873");
    assert.equal(refreshed?.billingBranch, "สาขาที่ 1 (00001)");
    assert.equal(refreshed?.orderCount, 1);
  });

  it("merges two emails of the same company and imports CSV", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const {
      createCustomer,
      mergeCustomers,
      getCustomerByEmail,
      getCustomerById,
      listCustomerContacts,
    } = await import("../lib/customer-repository");
    const { importCustomersFromCsv } = await import("../lib/customer-import");
    const { parseCustomerCsv } = await import("../lib/customer-csv");
    const {
      createLineLinkToken,
      bindLineUserToContact,
      verifyLineSignature,
      handleLineWebhookBody,
    } = await import("../lib/line-oa");

    const a = createCustomer({
      company: "เทราบิสคู่ค้า",
      email: "a@partner.example",
      contactName: "A",
    });
    const b = createCustomer({
      company: "เทราบิสคู่ค้า",
      email: "b@partner.example",
      contactName: "B",
    });
    const merged = mergeCustomers({ sourceId: b.id, targetId: a.id });
    assert.equal(merged.id, a.id);
    assert.equal(getCustomerByEmail("b@partner.example")?.id, a.id);
    assert.equal(getCustomerById(b.id)?.id, a.id);
    assert.equal(listCustomerContacts(a.id).length, 2);

    const csv = `company,email,phone,taxId,ที่อยู่
นำเข้าทดสอบ,import.crm@example.com,0810000000,0105556003873,เชียงใหม่`;
    const dry = importCustomersFromCsv(csv, { dryRun: true });
    assert.equal(dry.preview.length, 1);
    const applied = importCustomersFromCsv(csv);
    assert.equal(applied.created + applied.updated >= 1, true);

    const parsedFa = parseCustomerCsv(
      `ประเภท,รหัสผู้ติดต่อ,ประเภทผู้ติดต่อ,ชื่อธุรกิจ/ชื่อบุคคล,ที่อยู่,เลขผู้เสียภาษี,สำนักงาน/สาขา,ชื่อผู้ติดต่อ,อีเมล,เบอร์มือถือ
ลูกค้า,Line : @demo,นิติบุคคล,บริษัท เดโม จำกัด,กทม,0105556003873,สำนักงานใหญ่,คุณเดโม,demo.fa@example.com,0899999999`,
    );
    assert.equal(parsedFa.rows[0]?.lineId, "@demo");
    assert.equal(parsedFa.rows[0]?.company, "บริษัท เดโม จำกัด");

    const contact = listCustomerContacts(a.id)[0]!;
    const token = createLineLinkToken(contact.id);
    const bound = bindLineUserToContact({
      token,
      lineUserId: "Ulineuser1",
      displayName: "Demo",
    });
    assert.equal(bound.ok, true);

    process.env.LINE_CHANNEL_SECRET = "line-secret-for-tests";
    const crypto = await import("node:crypto");
    const body = JSON.stringify({
      events: [
        {
          type: "message",
          source: { userId: "Ulineuser2" },
          message: { type: "text", text: createLineLinkToken(contact.id) },
        },
      ],
    });
    const sig = crypto
      .createHmac("sha256", "line-secret-for-tests")
      .update(body)
      .digest("base64");
    assert.equal(verifyLineSignature(body, sig), true);
    const handled = handleLineWebhookBody(body);
    assert.equal(handled.processed, 1);
  });

  it("summarizes which product types a customer has ordered", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { resetOrderRepository } = await import("../lib/order-repository");
    resetOrderRepository();
    const { submitQuotePayload } = await import("../lib/quote-service");
    const { createOrderFromQuote } = await import("../lib/order-service");
    const { getCustomerByEmail } = await import("../lib/customer-repository");
    const { buildCustomerSalesHistory } = await import(
      "../lib/customer-sales-history"
    );

    const headers = new Headers({ "x-forwarded-for": "203.0.113.55" });
    const quoteResult = await submitQuotePayload(
      {
        name: "History Buyer",
        company: "บริษัท ประวัติการขาย จำกัด",
        email: "sales-history@acme.example",
        phone: "0833334444",
        quantity: 60,
        consent: true,
        decorationMethod: "screen-print",
        productSlug: "tumbler-notebook-pen-set",
        productInterest: "ชุดต้อนรับพนักงาน",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers },
    );
    assert.equal(quoteResult.ok, true);
    if (!quoteResult.ok) return;
    updateQuoteOps({ requestId: quoteResult.requestId, leadStatus: "quoted" });
    createOrderFromQuote({
      quoteRequestId: quoteResult.requestId,
      amount: 18_000,
      vatMode: "exclusive",
    });
    const customer = getCustomerByEmail("sales-history@acme.example");
    assert.ok(customer);
    const history = buildCustomerSalesHistory(customer!.id);
    assert.equal(history.kindsBought.some((row) => row.kind === "tumbler"), true);
    assert.equal(history.orders[0]?.productLabel, "ชุดต้อนรับพนักงาน");
    assert.equal(history.orders[0]?.kindLabel, "กระบอกน้ำ / แก้ว");
  });
});
