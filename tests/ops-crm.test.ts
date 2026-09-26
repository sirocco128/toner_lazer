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

describe("ops customers + quote workflow", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-ops-"));
    sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET =
      "test-ip-hash-secret-at-least-32-characters-long";
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

  it("upserts customer and lists quotes by status", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository } = await import("../lib/quote-repository");
    resetQuoteRepository();

    const { submitQuotePayload } = await import("../lib/quote-service");
    const { listCustomers, getCustomerByEmail } = await import(
      "../lib/customer-repository"
    );
    const { listQuoteRequests, updateQuoteOps, getQuoteByRequestId } =
      await import("../lib/quote-repository");

    const headers = new Headers({ "x-forwarded-for": "203.0.113.10" });
    const result = await submitQuotePayload(
      {
        name: "Somchai Test",
        company: "Acme Co",
        email: "somchai@acme.example",
        phone: "0812345678",
        quantity: 50,
        consent: true,
        decorationMethod: "laser",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const customer = getCustomerByEmail("somchai@acme.example");
    assert.ok(customer);
    assert.equal(customer?.company, "Acme Co");
    assert.equal(customer?.quoteCount, 1);

    const quote = getQuoteByRequestId(result.requestId);
    assert.ok(quote);
    assert.equal(quote?.customerId, customer?.id);
    assert.equal(quote?.leadStatus, "new");

    const updated = updateQuoteOps({
      requestId: result.requestId,
      leadStatus: "contacted",
      salesNotes: "โทรแล้ว นัดส่งแบบ",
    });
    assert.equal(updated?.leadStatus, "contacted");
    assert.equal(updated?.salesNotes, "โทรแล้ว นัดส่งแบบ");

    const { listQuoteSalesTimeline } = await import("../lib/quote-repository");
    const firstLog = listQuoteSalesTimeline(result.requestId);
    assert.equal(firstLog.length, 1);
    assert.equal(firstLog[0]?.toStatus, "contacted");
    assert.equal(firstLog[0]?.note, "โทรแล้ว นัดส่งแบบ");

    const second = updateQuoteOps({
      requestId: result.requestId,
      leadStatus: "contacted",
      salesNotes: "โทรอีกครั้ง ยังไม่รับสาย",
      actor: { email: "sales@local", name: "เซลล์", role: "sales" },
    });
    assert.equal(second?.salesNotes, "โทรอีกครั้ง ยังไม่รับสาย");
    const timeline = listQuoteSalesTimeline(result.requestId);
    assert.equal(timeline.length, 2);
    assert.equal(timeline[0]?.note, "โทรอีกครั้ง ยังไม่รับสาย");
    assert.equal(timeline[0]?.actorName, "เซลล์");
    assert.equal(timeline[1]?.note, "โทรแล้ว นัดส่งแบบ");

    const contacted = listQuoteRequests({ leadStatus: "contacted" });
    assert.equal(contacted.length, 1);

    const customers = listCustomers({ q: "Acme" });
    assert.equal(customers.length, 1);
  });

  it("signs and verifies ops session tokens", async () => {
    process.env.ADMIN_PASSWORD = "test-admin-pass-12";
    process.env.ADMIN_SESSION_SECRET =
      "test-ops-session-secret-at-least-32-chars";
    const {
      createOpsSessionToken,
      verifyOpsSessionToken,
      verifyOpsPassword,
      isOpsAuthConfigured,
    } = await import("../lib/ops-auth");

    assert.equal(isOpsAuthConfigured(), true);
    assert.equal(verifyOpsPassword("test-admin-pass-12"), true);
    assert.equal(verifyOpsPassword("wrong"), false);

    const token = createOpsSessionToken();
    assert.equal(verifyOpsSessionToken(token), true);
    assert.equal(verifyOpsSessionToken("v1.1.bad"), false);
  });

  it("assigns sales and viewer roles and writes redacted audit", async () => {
    process.env.ADMIN_PASSWORD = "test-admin-pass-12";
    process.env.ADMIN_SESSION_SECRET =
      "test-ops-session-secret-at-least-32-chars";
    process.env.OPS_USERS = JSON.stringify([
      {
        email: "sales@local",
        password: "sales-pass-12x",
        role: "sales",
        name: "เซลล์",
      },
      {
        email: "view@local",
        password: "viewer-pass-12",
        role: "viewer",
        name: "ดูอย่างเดียว",
      },
    ]);

    const { authenticateOpsUser, createOpsSessionToken, parseOpsSessionToken } =
      await import("../lib/ops-auth");
    const { actorMay } = await import("../lib/ops-roles");
    const { writeOpsAudit, listOpsAudit } = await import("../lib/ops-audit");

    const sales = authenticateOpsUser("sales@local", "sales-pass-12x");
    assert.equal(sales?.role, "sales");
    assert.equal(actorMay(sales!, "quotes.write"), true);
    assert.equal(actorMay(sales!, "customers.merge"), false);
    assert.equal(actorMay(sales!, "customers.import"), false);
    assert.equal(actorMay(sales!, "audit.read"), false);
    assert.equal(actorMay(sales!, "factory.read"), false);
    assert.equal(actorMay(sales!, "factory.write"), false);
    assert.equal(actorMay(sales!, "finance.read"), false);

    const viewer = authenticateOpsUser("view@local", "viewer-pass-12");
    assert.equal(viewer?.role, "viewer");
    assert.equal(actorMay(viewer!, "quotes.write"), false);

    const parsed = parseOpsSessionToken(createOpsSessionToken(Date.now(), sales!));
    assert.equal(parsed?.role, "sales");

    writeOpsAudit({
      actor: sales,
      action: "quote.update",
      status: "ok",
      resourceType: "quote",
      resourceId: "RFQ-TEST",
      prompt: "api_key=super-secret-token",
    });
    const rows = listOpsAudit({ action: "quote.update", limit: 5 });
    assert.ok(rows.length >= 1);
    assert.doesNotMatch(rows[0]?.prompt || "", /super-secret-token/);
  });
});
