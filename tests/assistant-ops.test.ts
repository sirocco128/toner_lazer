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

describe("ops assistant tools", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-ops-ai-"));
    sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET =
      "test-ip-hash-secret-at-least-32-characters-long";
    process.env.OPENROUTER_API_KEY = "";
    process.env.NEXTERP_MYSQL_ENABLED = "false";
    process.env.SMARTGIFT_MYSQL_ENABLED = "false";
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

  it("summarizes a stored quote and drafts a LINE reply without factory cost", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { resetQuoteRepository } = await import("../lib/quote-repository");
    resetQuoteRepository();

    const { submitQuotePayload } = await import("../lib/quote-service");
    const result = await submitQuotePayload(
      {
        name: "Anong",
        company: "Beta Co",
        email: "anong@beta.example",
        phone: "0811111111",
        quantity: 80,
        consent: true,
        decorationMethod: "screen-print",
        productInterest: "กระบอกน้ำ",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      { headers: new Headers({ "x-forwarded-for": "203.0.113.20" }) },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const { runOpsAssistant } = await import("../lib/assistant-ops");
    const summary = await runOpsAssistant({
      actor: { email: "sales@local", name: "เซลล์", role: "sales" },
      message: `สรุปคำขอ ${result.requestId}`,
    });
    assert.equal(summary.refused, false);
    assert.match(summary.reply, /Beta Co|Anong|80/);
    assert.doesNotMatch(summary.reply, /\b1688\b/);

    const draft = await runOpsAssistant({
      actor: { email: "sales@local", name: "เซลล์", role: "sales" },
      message: `ร่างข้อความ LINE ${result.requestId}`,
    });
    assert.equal(draft.refused, false);
    assert.match(draft.reply, /Anong|Beta/);
    assert.ok(draft.tools.some((item) => item.tool === "draft.line_reply"));
  });

  it("does not search quotes or warehouse without matching permissions", async () => {
    const { runOpsAssistant, assistantMayUseTool } = await import(
      "../lib/assistant-ops"
    );
    const viewer = {
      email: "view@local",
      name: "ดูอย่างเดียว",
      role: "viewer" as const,
    };
    assert.equal(assistantMayUseTool(viewer, "quote.list_recent"), false);
    assert.equal(assistantMayUseTool(viewer, "nexterp.search"), false);

    const blocked = await runOpsAssistant({
      actor: viewer,
      message: "รายการคำขอล่าสุด",
    });
    assert.equal(blocked.refused, true);
    assert.match(blocked.reply, /ไม่มีสิทธิ์/);
    assert.equal(blocked.tools.length, 0);

    const salesNoWarehouse = {
      email: "sales@local",
      name: "เซลล์",
      role: "sales" as const,
      extraDenies: ["catalog.write" as const],
    };
    const warehouse = await runOpsAssistant({
      actor: salesNoWarehouse,
      message: "ค้น sku ในคลัง กระบอกน้ำ",
    });
    assert.equal(warehouse.refused, true);
    assert.equal(
      warehouse.tools.some((item) => item.tool === "nexterp.search"),
      false,
    );
  });
});
