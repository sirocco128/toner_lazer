import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";

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

describe("quote-retry integration (§31 required)", () => {
  let dataDir = "";
  let sqlitePath = "";
  let server: Server | null = null;
  let webhookHits = 0;
  let failUntilHit = 1;
  let webhookUrl = "";

  before(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-retry-"));
    sqlitePath = join(dataDir, "leads.sqlite");

    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET =
      "test-ip-hash-secret-at-least-32-characters-long";
    process.env.QUOTE_RATE_LIMIT_MAX = "50";
    process.env.QUOTE_RATE_LIMIT_WINDOW_MINUTES = "15";
    process.env.QUOTE_WEBHOOK_MAX_ATTEMPTS = "2";
    process.env.QUOTE_WEBHOOK_RETRY_BASE_SECONDS = "1";
    process.env.QUOTE_WEBHOOK_TIMEOUT_MS = "2000";
    process.env.QUOTE_RETRY_BATCH_SIZE = "10";
    delete process.env.QUOTE_WEBHOOK_SECRET;

    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: sqlitePath },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    await new Promise<void>((resolve, reject) => {
      server = createServer((req, res) => {
        webhookHits += 1;
        if (webhookHits <= failUntilHit) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("transient failure");
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const addr = server!.address() as AddressInfo;
        webhookUrl = `http://127.0.0.1:${addr.port}/hook`;
        process.env.QUOTE_WEBHOOK_URL = webhookUrl;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
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

  async function resetDbSingleton() {
    const { closeDb } = await import("../lib/database");
    closeDb();
  }

  function baseInput() {
    return {
      name: "Retry Tester",
      company: "Retry Co Ltd",
      email: "retry@acme.co.th",
      phone: "0812345678",
      quantity: 25,
      consent: true as const,
      decorationMethod: "not-sure" as const,
      website: "",
      startedAt: Date.now() - 5_000,
      productSlug: "tumbler-notebook-pen-set",
      landingPath: "/contact",
    };
  }

  it("persists failed webhook then processRetryBatch reaches sent", async () => {
    await resetDbSingleton();
    webhookHits = 0;
    failUntilHit = 1;
    process.env.QUOTE_WEBHOOK_URL = webhookUrl;
    process.env.QUOTE_WEBHOOK_MAX_ATTEMPTS = "3";

    const { submitQuotePayload, processRetryBatch } = await import(
      "../lib/quote-service"
    );
    const {
      getQuoteByRequestId,
      updateWebhookStatus,
    } = await import("../lib/quote-repository");

    const result = await submitQuotePayload(baseInput(), {
      headers: new Headers({
        "x-real-ip": "198.51.100.20",
        "user-agent": "node-test-retry",
      }),
      userAgent: "node-test-retry",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    let row = getQuoteByRequestId(result.requestId);
    assert.ok(row);
    assert.equal(row!.webhookStatus, "failed");
    assert.equal(row!.webhookAttemptCount, 1);
    assert.equal(webhookHits, 1);

    updateWebhookStatus({
      requestId: result.requestId,
      status: "failed",
      attemptCount: row!.webhookAttemptCount,
      error: row!.webhookError,
      nextAttemptAt: new Date(Date.now() - 1_000).toISOString(),
      lastAttemptAt: row!.webhookLastAttemptAt,
    });

    const batch = await processRetryBatch(10);
    assert.equal(batch.sent, 1);
    assert.equal(webhookHits, 2);

    row = getQuoteByRequestId(result.requestId);
    assert.ok(row);
    assert.equal(row!.webhookStatus, "sent");
  });

  it("marks dead after max attempts when webhook keeps failing", async () => {
    await resetDbSingleton();
    webhookHits = 0;
    failUntilHit = 99;
    process.env.QUOTE_WEBHOOK_URL = webhookUrl;
    process.env.QUOTE_WEBHOOK_MAX_ATTEMPTS = "2";

    const { submitQuotePayload, processRetryBatch } = await import(
      "../lib/quote-service"
    );
    const {
      getQuoteByRequestId,
      updateWebhookStatus,
    } = await import("../lib/quote-repository");

    const result = await submitQuotePayload(
      {
        ...baseInput(),
        email: "dead@acme.co.th",
        phone: "0898765432",
      },
      {
        headers: new Headers({
          "x-real-ip": "198.51.100.21",
          "user-agent": "node-test-dead",
        }),
        userAgent: "node-test-dead",
      },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;

    let row = getQuoteByRequestId(result.requestId);
    assert.ok(row);
    assert.equal(row!.webhookStatus, "failed");
    assert.equal(row!.webhookAttemptCount, 1);

    updateWebhookStatus({
      requestId: result.requestId,
      status: "failed",
      attemptCount: row!.webhookAttemptCount,
      error: row!.webhookError,
      nextAttemptAt: new Date(Date.now() - 1_000).toISOString(),
      lastAttemptAt: row!.webhookLastAttemptAt,
    });

    const batch = await processRetryBatch(10);
    assert.equal(batch.dead, 1);

    row = getQuoteByRequestId(result.requestId);
    assert.ok(row);
    assert.equal(row!.webhookStatus, "dead");
    assert.equal(row!.webhookAttemptCount, 2);
  });
});
