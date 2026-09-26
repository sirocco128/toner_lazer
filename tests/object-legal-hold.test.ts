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

describe("object legal hold", () => {
  let dataDir = "";
  let previousEndpoint = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-legal-hold-"));
    process.env.SQLITE_PATH = join(dataDir, "leads.sqlite");
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET =
      "test-ip-hash-secret-at-least-32-characters-long";
    previousEndpoint = process.env.MINIO_ENDPOINT || "";
    delete process.env.MINIO_ENDPOINT;
    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: process.env.SQLITE_PATH },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
    closeDb();
  });

  after(() => {
    if (previousEndpoint) process.env.MINIO_ENDPOINT = previousEndpoint;
    else delete process.env.MINIO_ENDPOINT;
    teardownTempDir(dataDir);
  });

  it("blocks delete until a different admin releases the hold", async () => {
    const { putObject } = await import("../lib/object-storage");
    const {
      applyLegalHold,
      deleteStoredObject,
      listLegalHolds,
      releaseLegalHold,
    } = await import("../lib/object-legal-hold");
    const stored = await putObject({
      kind: "slips",
      fileName: "SLP-HOLD.jpg",
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      contentType: "image/jpeg",
    });
    const holder = { email: "acc@local", name: "บัญชี", role: "accountant" as const };
    const admin = { email: "admin@local", name: "ผู้ดูแล", role: "admin" as const };
    await applyLegalHold({
      actor: holder,
      objectKey: stored.key,
      reason: "ข้อพิพาทลูกค้า",
      caseRef: "ORD-HOLD-1",
    });
    await assert.rejects(
      () => applyLegalHold({ actor: admin, objectKey: stored.key, reason: "ซ้ำ" }),
      /already_held/,
    );
    await assert.rejects(() => deleteStoredObject(stored.key), /legal_hold/);
    await assert.rejects(
      () =>
        releaseLegalHold({
          actor: holder,
          objectKey: stored.key,
          reason: "ปลดเองไม่ได้",
        }),
      /same_actor_release/,
    );
    const released = await releaseLegalHold({
      actor: admin,
      objectKey: stored.key,
      reason: "คดีจบแล้ว",
    });
    assert.equal(released.releasedByEmail, "admin@local");
    assert.equal(listLegalHolds({ activeOnly: true }).length, 0);
    await deleteStoredObject(stored.key);
  });
});
