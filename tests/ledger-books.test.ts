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

describe("chart of accounts and accountant books", () => {
  let dataDir = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-coa-"));
    const sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET =
      "test-ip-hash-secret-at-least-32-characters-long";
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

  it("seeds a postable Thai SME chart including equity inventory and input VAT", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { listLedgerAccounts } = await import("../lib/ledger-repository");
    const accounts = listLedgerAccounts();
    const codes = new Set(accounts.map((row) => row.code));
    for (const code of ["1110", "1120", "1130", "1140", "1150", "2110", "2130", "2140", "3100", "4100", "5100"]) {
      assert.ok(codes.has(code), code);
    }
    assert.ok(accounts.some((row) => row.type === "equity" && row.isPostable));
    assert.ok(accounts.some((row) => row.isHeader && row.code === "1000"));
    const postable = listLedgerAccounts({ postableOnly: true });
    assert.equal(postable.some((row) => row.code === "1000"), false);
  });

  it("lets the accountant post AR and a balanced opening capital journal", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { actorMay } = await import("../lib/ops-roles");
    const accountant = {
      email: "acc@local",
      name: "ผู้ทำบัญชี",
      role: "accountant" as const,
    };
    assert.equal(actorMay(accountant, "finance.write"), true);
    assert.equal(actorMay(accountant, "orders.write"), true);
    assert.equal(actorMay(accountant, "factory.write"), false);
    assert.equal(actorMay(accountant, "users.write"), false);

    const { postManualJournal, postRevenueRecognition } = await import(
      "../lib/ledger-service"
    );
    const { getJournalBySourceKey, trialBalance } = await import(
      "../lib/ledger-repository"
    );

    postRevenueRecognition({
      orderId: "ORD-AR-GAP",
      subtotalExVat: 100,
      vatAmount: 7,
      grandTotal: 107,
      at: "2026-09-06T05:00:00.000Z",
      actor: accountant.email,
    });
    const sales = getJournalBySourceKey("revenue:ORD-AR-GAP");
    assert.ok(sales);
    assert.equal(sales!.bookType, "sales");
    assert.ok(sales!.lines.some((line) => line.accountCode === "1120" && line.debit === 107));

    const entryId = postManualJournal({
      memo: "ลงทุนจดทะเบียน",
      entryDate: "2026-01-01",
      actor: accountant.email,
      lines: [
        { accountCode: "1110", debit: 50_000, credit: 0, memo: "เงินสดเปิดกิจการ" },
        { accountCode: "3100", debit: 0, credit: 50_000, memo: "ทุน" },
      ],
    });
    assert.match(entryId, /^JE-/);
    const tb = trialBalance({ fromDate: "2026-01-01", toDate: "2026-12-31" });
    const debit = tb.reduce((sum, row) => sum + row.debit, 0);
    const credit = tb.reduce((sum, row) => sum + row.credit, 0);
    assert.equal(Math.round(debit * 100), Math.round(credit * 100));
  });
});
