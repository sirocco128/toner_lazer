import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
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

describe("ops staff RBAC", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-ops-staff-"));
    sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.ADMIN_PASSWORD = "test-admin-pass-12";
    process.env.ADMIN_SESSION_SECRET =
      "test-ops-session-secret-at-least-32-chars";
    process.env.ADMIN_EMAIL = "admin";
    delete process.env.OPS_USERS;

    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: sqlitePath },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
    closeDb();
  });

  after(() => {
    teardownTempDir(dataDir);
  });

  it("creates an employee, hashes the password, and applies extra grants/denies", async () => {
    const { createOpsStaff, authenticateOpsStaff, updateOpsStaff } =
      await import("../lib/ops-staff");
    const { actorMay } = await import("../lib/ops-roles");
    const { authenticateOpsUser } = await import("../lib/ops-auth");

    const sales = createOpsStaff({
      email: "somchai@terabis.local",
      name: "สมชาย",
      role: "sales",
      department: "sales",
      password: "sales-pass-12x",
      extraGrants: ["audit.read"],
      extraDenies: ["seo.write"],
      createdBy: "admin",
    });
    assert.equal(sales.email, "somchai@terabis.local");
    assert.equal(sales.role, "sales");

    const actor = authenticateOpsStaff("somchai@terabis.local", "sales-pass-12x");
    assert.ok(actor);
    assert.equal(actorMay(actor!, "quotes.write"), true);
    assert.equal(actorMay(actor!, "documents.restricted"), true);
    assert.equal(actorMay(actor!, "audit.read"), true);
    assert.equal(actorMay(actor!, "seo.write"), false);
    assert.equal(actorMay(actor!, "users.write"), false);
    assert.equal(actorMay(actor!, "factory.read"), false);

    assert.equal(
      authenticateOpsStaff("somchai@terabis.local", "wrong-password-12"),
      null,
    );

    const viaAuth = authenticateOpsUser(
      "somchai@terabis.local",
      "sales-pass-12x",
    );
    assert.equal(viaAuth?.name, "สมชาย");

    const envAdmin = authenticateOpsUser("admin", "test-admin-pass-12");
    assert.equal(envAdmin?.role, "admin");
    assert.equal(actorMay(envAdmin!, "users.write"), true);

    updateOpsStaff({ id: sales.id, extraGrants: ["factory.read"] });
    const again = authenticateOpsStaff("somchai@terabis.local", "sales-pass-12x");
    assert.equal(actorMay(again!, "factory.read"), true);
    assert.equal(actorMay(again!, "audit.read"), false);
  });

  it("blocks deactivating the last admin and inactive staff cannot log in", async () => {
    const { createOpsStaff, updateOpsStaff, authenticateOpsStaff } =
      await import("../lib/ops-staff");

    const admin = createOpsStaff({
      email: "boss@terabis.local",
      name: "ผู้ดูแลหลัก",
      role: "admin",
      password: "admin-pass-12x",
    });

    assert.throws(
      () => updateOpsStaff({ id: admin.id, role: "sales" }),
      /ผู้ดูแล/,
    );
    assert.throws(
      () => updateOpsStaff({ id: admin.id, active: false }),
      /ผู้ดูแล/,
    );

    const second = createOpsStaff({
      email: "boss2@terabis.local",
      name: "ผู้ดูแลสำรอง",
      role: "admin",
      password: "admin-pass-12y",
    });
    updateOpsStaff({ id: admin.id, active: false });
    assert.equal(
      authenticateOpsStaff("boss@terabis.local", "admin-pass-12x"),
      null,
    );
    assert.ok(authenticateOpsStaff("boss2@terabis.local", "admin-pass-12y"));
    updateOpsStaff({ id: admin.id, active: true });
    updateOpsStaff({ id: second.id, role: "sales" });
    assert.equal(
      (await import("../lib/ops-staff")).getOpsStaffById(second.id)?.role,
      "sales",
    );
  });

  it("prefers the database account when the same email exists in env", async () => {
    process.env.OPS_USERS = JSON.stringify([
      {
        email: "sales@local",
        password: "env-pass-word12",
        role: "sales",
        name: "จากเครื่อง",
      },
    ]);
    const { createOpsStaff } = await import("../lib/ops-staff");
    const { authenticateOpsUser } = await import("../lib/ops-auth");

    createOpsStaff({
      email: "sales@local",
      name: "จากฐานข้อมูล",
      role: "viewer",
      password: "db-password-12",
    });
    const dbHit = authenticateOpsUser("sales@local", "db-password-12");
    assert.equal(dbHit?.name, "จากฐานข้อมูล");
    assert.equal(dbHit?.role, "viewer");
    assert.equal(authenticateOpsUser("sales@local", "env-pass-word12"), null);
  });

  it("lets Google Sign-In use the database staff email and blocks inactive accounts", async () => {
    const { createOpsStaff, updateOpsStaff } = await import("../lib/ops-staff");
    const { authenticateOpsGoogleEmail } = await import("../lib/ops-auth");

    const staff = createOpsStaff({
      email: "nida@terabis.example",
      name: "นิดา",
      role: "sales",
      password: "sales-pass-12x",
    });
    const viaGoogle = authenticateOpsGoogleEmail("nida@terabis.example");
    assert.equal(viaGoogle?.staffId, staff.id);
    assert.equal(viaGoogle?.name, "นิดา");
    const { actorMay } = await import("../lib/ops-roles");
    assert.equal(
      actorMay({ email: "view@local", name: "ดู", role: "viewer" }, "documents.read"),
      true,
    );
    assert.equal(
      actorMay(
        { email: "view@local", name: "ดู", role: "viewer" },
        "documents.restricted",
      ),
      false,
    );

    updateOpsStaff({ id: staff.id, active: false });
    assert.equal(authenticateOpsGoogleEmail("nida@terabis.example"), null);
    updateOpsStaff({ id: staff.id, active: true });
    assert.equal(authenticateOpsGoogleEmail("nida@terabis.example")?.role, "sales");
  });
});
