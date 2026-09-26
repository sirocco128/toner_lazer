import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

function resolveProjectRoot(): string {
  if (process.env.PROJECT_ROOT && existsSync(join(process.env.PROJECT_ROOT, "package.json"))) {
    return process.env.PROJECT_ROOT;
  }
  // Compiled tests live under .tmp/tests/tests — walk up to package.json.
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = join(dir, "..");
  }
  return join(__dirname, "..");
}

const ROOT = resolveProjectRoot();

describe("quote-storage (§31.2)", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-quote-"));
    sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET =
      "test-ip-hash-secret-at-least-32-characters-long";
    process.env.QUOTE_RATE_LIMIT_MAX = "5";
    process.env.QUOTE_RATE_LIMIT_WINDOW_MINUTES = "15";
    delete process.env.QUOTE_WEBHOOK_URL;
    delete process.env.QUOTE_WEBHOOK_SECRET;

    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: sqlitePath },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    // Ensure DB singleton picks up SQLITE_PATH for this process.
    // closeDb if available after env change.
  });

  after(async () => {
    try {
      const { closeDb } = await import("../lib/database");
      closeDb();
    } catch {
      // ignore
    }
    if (dataDir) {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("persists before webhook, returns RFQ id, and skips when no webhook", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { submitQuotePayload } = await import("../lib/quote-service");
    const { getQuoteByRequestId } = await import("../lib/quote-repository");

    const headers = new Headers({
      "x-real-ip": "203.0.113.10",
      "user-agent": "node-test",
    });

    const result = await submitQuotePayload(
      {
        name: "ทดสอบ ระบบ",
        company: "บริษัท ทดสอบ จำกัด",
        email: "test@acme.co.th",
        phone: "0812345678",
        quantity: 50,
        consent: true,
        decorationMethod: "screen-print",
        website: "",
        startedAt: Date.now() - 5_000,
        productSlug: "tumbler-notebook-pen-set",
        landingPath: "/contact",
      },
      { headers, userAgent: "node-test" },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.requestId, /^RFQ-\d{8}-[A-F0-9]{12}$/);

    const row = getQuoteByRequestId(result.requestId);
    assert.ok(row);
    assert.equal(row!.webhookStatus, "skipped");
  });

  it("enforces atomic rate limiting", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { consumeRateLimit } = await import("../lib/quote-repository");
    const keyHash = createHash("sha256").update("rate-limit-bucket").digest("hex");
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucketStart = nowSeconds - (nowSeconds % (15 * 60));

    let allowed = 0;
    for (let i = 0; i < 8; i += 1) {
      const ok = consumeRateLimit({
        keyHash,
        bucketStart,
        maxAttempts: 5,
        nowSeconds,
      });
      if (ok) allowed += 1;
    }
    assert.equal(allowed, 5);
  });

  it("claims a due outbox row only once", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const {
      insertQuoteRequest,
      claimDueOutbox,
    } = await import("../lib/quote-repository");

    const requestId = `RFQ-20990101-${"AB".repeat(6)}`;
    const nowIso = new Date().toISOString();
    insertQuoteRequest({
      requestId,
      submittedAt: nowIso,
      input: {
        name: "Outbox Tester",
        company: "Outbox Co",
        email: "outbox@acme.co.th",
        phone: "0899999999",
        quantity: 10,
        consent: true,
        decorationMethod: "not-sure",
        website: "",
        startedAt: Date.now() - 5_000,
      },
      ipHash: "abc123",
      userAgent: "node-test",
      webhookStatus: "pending",
      webhookNextAttemptAt: new Date(Date.now() - 1_000).toISOString(),
      rawPayload: "{}",
      consentAt: nowIso,
    });

    const first = claimDueOutbox({ limit: 10, nowIso: new Date().toISOString() });
    const second = claimDueOutbox({ limit: 10, nowIso: new Date().toISOString() });
    const firstIds = first.map((r) => r.requestId);
    const secondIds = second.map((r) => r.requestId);

    assert.equal(firstIds.includes(requestId), true);
    assert.equal(secondIds.includes(requestId), false);
  });
});
