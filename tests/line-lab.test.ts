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

describe("LINE webhook lab", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-line-lab-"));
    sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.LINE_OA_TEST_MODE = "true";
    process.env.LINE_CHANNEL_SECRET = "line-lab-local-secret";
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

  it("signs POST /api/line/webhook and binds a TB- token", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { createCustomer, listCustomerContacts } = await import(
      "../lib/customer-repository"
    );
    const {
      buildLineTextWebhookPayload,
      createLineLinkToken,
      isLineOaEnabled,
      isLineOaTestMode,
      processLineWebhook,
      signLineBody,
    } = await import("../lib/line-oa");

    assert.equal(isLineOaTestMode(), true);
    assert.equal(isLineOaEnabled(), true);

    const customer = createCustomer({
      company: "ลูกค้าทดลองไลน์",
      email: "line-lab@example.com",
      contactName: "Lab",
      source: "line",
    });
    const contact = listCustomerContacts(customer.id)[0];
    assert.ok(contact);
    const token = createLineLinkToken(contact.id);
    const payload = buildLineTextWebhookPayload({
      text: `เชื่อมไลน์ ${token}`,
      lineUserId: "Ulab-user-001",
      displayName: "Lab",
    });
    const raw = JSON.stringify(payload);

    const rejected = processLineWebhook(raw, "bad-sig");
    assert.equal(rejected.httpStatus, 401);

    const accepted = processLineWebhook(raw, signLineBody(raw));
    assert.equal(accepted.httpStatus, 200);
    assert.equal(accepted.body.ok, true);
    assert.equal(accepted.body.bound, 1);

    const linked = listCustomerContacts(customer.id)[0];
    assert.equal(linked?.lineUserId, "Ulab-user-001");
    assert.equal(linked?.lineDisplayName, "Lab");
  });
});
