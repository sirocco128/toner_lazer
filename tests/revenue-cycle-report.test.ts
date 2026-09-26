import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { teardownTempDir } from "./teardown-temp";
import { actorMay } from "../lib/ops-roles";
import { revenueCycleVisibility } from "../lib/revenue-cycle-report";

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

describe("revenue cycle report permissions", () => {
  it("hides GP from sales and factory cost from viewer", () => {
    const sales = revenueCycleVisibility({
      email: "sales@local",
      name: "เซลล์",
      role: "sales",
    });
    assert.equal(sales.showGrossProfit, false);
    assert.equal(sales.showFactory, false);
    const viewer = revenueCycleVisibility({
      email: "view@local",
      name: "ดู",
      role: "viewer",
    });
    assert.equal(viewer.showGrossProfit, false);
    assert.equal(
      actorMay(
        { email: "view@local", name: "ดู", role: "viewer" },
        "reports.read",
      ),
      true,
    );
    const accountant = revenueCycleVisibility({
      email: "acc@local",
      name: "บัญชี",
      role: "accountant",
    });
    assert.equal(accountant.showGrossProfit, true);
    assert.equal(accountant.showFactory, true);
  });
});

describe("revenue cycle report numbers", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-revcycle-"));
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

  it("counts a won quote without an order as a cycle exception", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository, updateQuoteOps } = await import(
      "../lib/quote-repository"
    );
    resetQuoteRepository();
    const { submitQuotePayload } = await import("../lib/quote-service");
    const { buildRevenueCycleReport, revenueCycleToCsv } = await import(
      "../lib/revenue-cycle-report"
    );

    const headers = new Headers({ "x-forwarded-for": "203.0.113.88" });
    const quoteResult = await submitQuotePayload(
      {
        name: "Cycle Report",
        company: "บริษัท รายงานวงจร จำกัด",
        email: "rev-cycle@acme.example",
        phone: "0812223344",
        quantity: 50,
        consent: true,
        budgetPerSet: 120,
        province: "กรุงเทพมหานคร",
        decorationMethod: "screen-print",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers },
    );
    assert.equal(quoteResult.ok, true);
    if (!quoteResult.ok) return;
    updateQuoteOps({ requestId: quoteResult.requestId, leadStatus: "won" });

    const report = buildRevenueCycleReport({
      fromDate: "2000-01-01",
      toDate: "2099-12-31",
      visibility: { showGrossProfit: false, showFactory: false },
    });
    assert.ok(report.quoteCount >= 1);
    assert.ok(report.wonCount >= 1);
    assert.ok(
      report.exceptions.some(
        (row) => row.kind === "won_no_order" && row.title === quoteResult.requestId,
      ),
    );
    const csv = revenueCycleToCsv(report);
    assert.match(csv, /ปิดการขายแล้วยังไม่เปิดออเดอร์/);
    assert.doesNotMatch(csv, /กำไรขั้นต้น/);
  });
});
