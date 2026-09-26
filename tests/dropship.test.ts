import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildDropshipCsv,
  buildDropshipDraft,
  buildSupplierMessage,
  canTransitionDropship,
  formatDropshipId,
  parseDropshipLines,
  resolveTonerToken,
} from "../lib/dropship";
import { teardownTempDir } from "./teardown-temp";

function resolveProjectRoot(): string {
  if (process.env.PROJECT_ROOT && existsSync(join(process.env.PROJECT_ROOT, "package.json"))) {
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

const SHIP_TO = {
  name: "งานพัสดุ อบต.ตัวอย่าง",
  phone: "081-234-5678",
  address: "99 หมู่ 1 ตำบลตัวอย่าง อำเภอเมือง",
  province: "ขอนแก่น",
};

describe("dropship parsing", () => {
  it("resolves SKU, model, OEM code, supplier ref and printer", () => {
    assert.equal(resolveTonerToken("TL-HP-CE285A")?.sku, "TL-HP-CE285A");
    assert.equal(resolveTonerToken("85A")?.sku, "TL-HP-CE285A");
    assert.equal(resolveTonerToken("ce285a")?.sku, "TL-HP-CE285A");
    assert.equal(resolveTonerToken("A0084955")?.sku, "TL-BR-TN2380");
    assert.equal(resolveTonerToken("HP M1132")?.sku, "TL-HP-CE285A");
    assert.equal(resolveTonerToken("Canon 2900"), null);
  });

  it("parses several formats and merges repeated models", () => {
    const lines = parseDropshipLines("85A x 5\nTN-2380, 2\nCE285A 3\nTL-SS-D111S×1 ตลับ");
    assert.deepEqual(
      lines.map((l) => [l.item.sku, l.qty]),
      [
        ["TL-HP-CE285A", 8],
        ["TL-BR-TN2380", 2],
        ["TL-SS-D111S", 1],
      ],
    );
  });

  it("rejects empty, malformed, unknown and bad quantities", () => {
    assert.throws(() => parseDropshipLines("  \n "), /lines_required/);
    assert.throws(() => parseDropshipLines("85A"), /line_format:1/);
    assert.throws(() => parseDropshipLines("85A x 2\nXYZ999 x 1"), /unknown_toner:XYZ999/);
    assert.throws(() => parseDropshipLines("85A x 0"), /line_format:1|qty_invalid:1/);
    assert.throws(() => parseDropshipLines("85A x 99999"), /qty_invalid:1/);
  });
});

describe("dropship draft and supplier message", () => {
  const draft = buildDropshipDraft({
    orderId: "ORD-TEST",
    shipTo: SHIP_TO,
    lines: parseDropshipLines("85A x 5\nTN-3350 x 2"),
    notes: "ส่งก่อน 15.00",
  });

  it("prices lines at supplier cost with box cost separate", () => {
    assert.equal(draft.totalQty, 7);
    assert.equal(draft.lines[0]?.unitSupplierThb, 184);
    assert.equal(draft.lines[1]?.unitSupplierThb, 316);
    assert.equal(draft.supplierTotalThb, 184 * 5 + 316 * 2);
    assert.equal(draft.boxTotalThb, 70);
  });

  it("validates ship-to", () => {
    assert.throws(
      () => buildDropshipDraft({ shipTo: { ...SHIP_TO, phone: "12" }, lines: parseDropshipLines("85A x 1") }),
      /ship_to_phone_invalid/,
    );
    assert.throws(
      () => buildDropshipDraft({ shipTo: { ...SHIP_TO, address: "สั้น" }, lines: parseDropshipLines("85A x 1") }),
      /ship_to_address_required/,
    );
  });

  it("writes a supplier message with our brand as sender and no supplier branding", () => {
    const msg = buildSupplierMessage({ ...draft, dropshipId: "DS-20260926-0001" }, "Toner Lazer");
    assert.match(msg, /DS-20260926-0001 \(ออเดอร์ ORD-TEST\)/);
    assert.match(msg, /\[A0080490\] .*85A.* × 5 ตลับ/);
    assert.match(msg, /ผู้ส่งบนพัสดุ: Toner Lazer/);
    assert.match(msg, /ขอนแก่น/);
    assert.match(msg, /ส่งก่อน 15\.00/);
    assert.doesNotMatch(msg, /Color\s*Fly|Advice/i);
  });

  it("exports CSV with one row per line and quotes commas", () => {
    const csv = buildDropshipCsv([
      { ...draft, dropshipId: "DS-1", shipTo: { ...SHIP_TO, address: "99, หมู่ 1" } },
    ]);
    const rows = csv.trim().split("\n");
    assert.equal(rows.length, 3);
    assert.match(rows[1] || "", /^DS-1,ORD-TEST,A0080490,TL-HP-CE285A,/);
    assert.match(rows[1] || "", /"99, หมู่ 1"/);
  });

  it("formats ids in Bangkok date and allows only forward transitions", () => {
    assert.equal(formatDropshipId(new Date("2026-09-26T18:30:00Z"), 7), "DS-20260927-0007");
    assert.equal(canTransitionDropship("draft", "sent"), true);
    assert.equal(canTransitionDropship("sent", "draft"), false);
    assert.equal(canTransitionDropship("delivered", "cancelled"), false);
  });
});

describe("dropship repository (SQLite)", () => {
  let dataDir = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "toner-dropship-"));
    const sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: sqlitePath },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
  });

  after(async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    teardownTempDir(dataDir);
  });

  it("creates, numbers, lists and moves a dropship order through its statuses", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const repo = await import("../lib/dropship-repository");
    const now = new Date("2026-09-26T03:00:00Z");
    const draft = buildDropshipDraft({
      orderId: "ORD-1",
      shipTo: SHIP_TO,
      lines: parseDropshipLines("85A x 2\nTN-1000 x 1"),
    });

    const a = repo.createDropshipOrder(draft, "ops@example.com", now);
    const b = repo.createDropshipOrder(draft, "ops@example.com", now);
    assert.equal(a.dropshipId, "DS-20260926-0001");
    assert.equal(b.dropshipId, "DS-20260926-0002");
    assert.equal(a.status, "draft");
    assert.equal(a.lines.length, 2);
    assert.equal(a.supplierTotalThb, 184 * 2 + 140);

    assert.equal(repo.listDropshipOrders({ orderId: "ORD-1" }).length, 2);
    assert.equal(repo.listDropshipOrders({ status: "sent" }).length, 0);

    const sent = repo.setDropshipStatus({ dropshipId: a.dropshipId, status: "sent" });
    assert.equal(sent.status, "sent");
    assert.ok(sent.sentAt);

    assert.throws(
      () => repo.setDropshipStatus({ dropshipId: a.dropshipId, status: "shipped" }),
      /tracking_required/,
    );
    const shipped = repo.setDropshipStatus({
      dropshipId: a.dropshipId,
      status: "shipped",
      trackingNo: "TH123456789",
      carrier: "Flash",
    });
    assert.equal(shipped.trackingNo, "TH123456789");
    assert.equal(shipped.carrier, "Flash");
    assert.ok(shipped.shippedAt);

    assert.throws(
      () => repo.setDropshipStatus({ dropshipId: a.dropshipId, status: "draft" }),
      /invalid_transition/,
    );
    assert.throws(
      () => repo.setDropshipStatus({ dropshipId: "DS-NOPE", status: "sent" }),
      /dropship_not_found/,
    );
  });
});
