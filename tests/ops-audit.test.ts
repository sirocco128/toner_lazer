import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { closeDb } from "../lib/database";
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

describe("ops audit context and filters", () => {
  let dataDir = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-ops-audit-"));
    process.env.SQLITE_PATH = join(dataDir, "leads.sqlite");
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET =
      "test-ip-hash-secret-at-least-32-characters-long";
    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: process.env.SQLITE_PATH },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
    closeDb();
  });

  after(() => {
    teardownTempDir(dataDir);
  });

  it("stores where / machine / impact and filters by user, date, report", async () => {
    const { opsAuditContextFromHeaders, parseDeviceLabel } = await import(
      "../lib/ops-request-context"
    );
    const {
      writeOpsAudit,
      listOpsAudit,
      countOpsAudit,
      recordOpsReportPull,
      parseOpsAuditSearch,
      opsAuditRowsToCsv,
    } = await import("../lib/ops-audit");

    assert.equal(
      parseDeviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0",
      ),
      "Windows 10+ · Chrome",
    );

    const ctx = opsAuditContextFromHeaders(
      new Headers({
        "x-forwarded-for": "203.0.113.40",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0",
        "cf-ipcountry": "TH",
        "cf-ipcity": "Bangkok",
      }),
    );
    assert.equal(ctx.ipAddress, "203.0.113.40");
    assert.equal(ctx.geoLabel, "Bangkok, TH");
    assert.equal(ctx.deviceLabel, "Windows 10+ · Chrome");
    assert.equal(ctx.machineHint?.length, 8);

    const actor = { email: "admin@local", name: "ผู้ดูแล", role: "admin" as const };
    writeOpsAudit({
      actor,
      action: "login",
      status: "ok",
      ...ctx,
    });
    writeOpsAudit({
      actor,
      action: "cash_receipt.confirm",
      status: "ok",
      resourceType: "cash_receipt",
      resourceId: "CR-1",
      detail: { total: 12000 },
      ...ctx,
    });
    recordOpsReportPull({
      actor,
      kind: "export",
      reportName: "pnl.csv",
      filters: { from: "2026-09-01", to: "2026-09-06" },
      context: ctx,
    });
    writeOpsAudit({
      actor: { email: "sales@local", name: "เซลล์", role: "sales" },
      action: "quote.update",
      status: "ok",
      resourceType: "quote",
      resourceId: "RFQ-1",
      detail: { leadStatus: "quoted" },
    });

    const login = listOpsAudit({ action: "login", limit: 5 })[0];
    assert.ok(login);
    assert.equal(login?.ipAddress, "203.0.113.40");
    assert.equal(login?.geoLabel, "Bangkok, TH");
    assert.match(login?.impact || "", /เข้าสู่ระบบ/);
    assert.equal(login?.deviceLabel, "Windows 10+ · Chrome");

    const approval = listOpsAudit({ action: "cash_receipt.confirm", limit: 1 })[0];
    assert.match(approval?.impact || "", /อนุมัติรับเงิน/);
    assert.match(approval?.impact || "", /สมุดบัญชี/);

    const report = listOpsAudit({ action: "report.export", limit: 1 })[0];
    assert.equal(report?.reportName, "pnl.csv");
    assert.match(report?.reportFilters || "", /2026-09-01/);
    assert.match(report?.impact || "", /ดึงไฟล์รายงาน/);

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
    }).format(new Date());
    const query = parseOpsAuditSearch({
      user: "admin@local",
      from: today,
      to: today,
      report: "pnl.csv",
    });
    assert.equal(query.actorEmail, "admin@local");
    const filtered = listOpsAudit({ ...query, limit: 20 });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.reportName, "pnl.csv");
    assert.equal(countOpsAudit({ actorEmail: "admin@local" }), 3);

    const csv = opsAuditRowsToCsv(filtered);
    assert.match(csv, /pnl\.csv/);
    assert.match(csv, /203\.0\.113\.40/);
  });
});
