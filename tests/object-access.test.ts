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

describe("object access audit", () => {
  let dataDir = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-object-audit-"));
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

  it("records download and deny without storing file bytes", async () => {
    const { recordObjectAccess } = await import("../lib/object-access");
    const { listOpsAudit } = await import("../lib/ops-audit");
    recordObjectAccess({
      actor: { email: "acc@local", name: "บัญชี", role: "accountant" },
      action: "object.download",
      status: "ok",
      kind: "slips",
      key: "slips/SLP-1.jpg",
      resourceId: "SLP-1",
      purpose: "view_payment_slip",
      request: new Request("http://127.0.0.1/ops/slips/SLP-1", {
        headers: { "user-agent": "giftset-test", "x-real-ip": "10.0.0.8" },
      }),
    });
    recordObjectAccess({
      action: "object.deny",
      status: "denied",
      kind: "slips",
      errorMessage: "unauthorized",
    });
    const rows = listOpsAudit({ limit: 20 });
    const download = rows.find((row) => row.action === "object.download");
    const deny = rows.find((row) => row.action === "object.deny");
    assert.ok(download);
    assert.equal(download?.status, "ok");
    assert.equal(download?.resourceType, "restricted");
    assert.equal(download?.resourceId, "SLP-1");
    assert.equal(download?.actorEmail, "acc@local");
    assert.ok(download?.detail && !download.detail.includes("ffd8"));
    assert.ok(deny);
    assert.equal(deny?.status, "denied");
  });
});
