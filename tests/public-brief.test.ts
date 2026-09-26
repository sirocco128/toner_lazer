import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { teardownTempDir } from "./teardown-temp";
import {
  parseAndMapSmartgiftBrief,
  resolveBriefStartedAt,
  SMARTGIFT_BRIEF_SCHEMA,
} from "../lib/public-brief";
import {
  listPublicSmgOrigins,
  resolvePublicCorsOrigin,
} from "../lib/public-cors";
import { shouldSkipScrapeGuard } from "../lib/scrape-guard";

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

function validBrief(overrides: Record<string, unknown> = {}) {
  return {
    schema: SMARTGIFT_BRIEF_SCHEMA,
    source: "smg-ui",
    page_url: "https://gift.example/#catalog/bundle",
    brief: {
      recipient: "พนักงาน",
      occasion: "ปีใหม่",
      tier: "signature",
      qty: 50,
    },
    lines: [{ code: "welcome-kit", name: "Welcome Kit", qty: 50 }],
    contact: {
      name: "สมชาย ใจดี",
      company: "บริษัทตัวอย่าง จำกัด",
      email: "somchai@example.com",
      phone: "0812345678",
      note: "ต้องการโลโก้",
    },
    notes: "ส่งภายใน ก.พ.",
    consent: true,
    startedAt: Date.now() - 5_000,
    website: "",
    ...overrides,
  };
}

describe("public-brief mapper", () => {
  it("maps smartgift-brief/1 onto QuoteRequestInput", () => {
    const mapped = parseAndMapSmartgiftBrief(validBrief());
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.data.name, "สมชาย ใจดี");
    assert.equal(mapped.data.company, "บริษัทตัวอย่าง จำกัด");
    assert.equal(mapped.data.email, "somchai@example.com");
    assert.equal(mapped.data.phone, "0812345678");
    assert.equal(mapped.data.quantity, 50);
    assert.equal(mapped.data.consent, true);
    assert.equal(mapped.data.decorationMethod, "not-sure");
    assert.equal(mapped.data.productSlug, "welcome-kit");
    assert.equal(mapped.data.utmSource, "smg-ui");
    assert.equal(mapped.data.landingPath, "/#catalog/bundle");
    assert.match(mapped.data.detail || "", /\[smg-ui brief\]/);
    assert.match(mapped.data.productInterest || "", /welcome-kit/);
  });

  it("defaults empty company and rejects missing qty / consent / email", () => {
    const noCompany = parseAndMapSmartgiftBrief(
      validBrief({
        contact: {
          name: "สมชาย ใจดี",
          email: "somchai@example.com",
          phone: "0812345678",
        },
      }),
    );
    assert.equal(noCompany.ok, true);
    if (noCompany.ok) assert.equal(noCompany.data.company, "ไม่ระบุ");

    const noQty = parseAndMapSmartgiftBrief(
      validBrief({
        brief: { recipient: "x" },
        lines: [{ code: "welcome-kit", name: "A" }],
      }),
    );
    assert.equal(noQty.ok, false);

    const noConsent = parseAndMapSmartgiftBrief(validBrief({ consent: false }));
    assert.equal(noConsent.ok, false);

    const badEmail = parseAndMapSmartgiftBrief(
      validBrief({
        contact: {
          name: "สมชาย ใจดี",
          email: "not-an-email",
          phone: "0812345678",
        },
      }),
    );
    assert.equal(badEmail.ok, false);
  });

  it("sums line qty when brief.qty is absent", () => {
    const mapped = parseAndMapSmartgiftBrief(
      validBrief({
        brief: { recipient: "VIP" },
        lines: [
          { code: "a-item", qty: 10 },
          { code: "b-item", qty: 5 },
        ],
      }),
    );
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.equal(mapped.data.quantity, 15);
    assert.equal(mapped.data.productSlug, "a-item");
  });

  it("coerces startedAt when missing or too fresh", () => {
    const now = 1_700_000_000_000;
    assert.equal(resolveBriefStartedAt(undefined, now), now - 2_000);
    assert.equal(resolveBriefStartedAt(now - 500, now), now - 2_000);
    assert.equal(resolveBriefStartedAt(now - 5_000, now), now - 5_000);
  });
});

describe("public CORS + scrape skip", () => {
  it("allows configured and dev origins", () => {
    const prev = process.env.PUBLIC_SMG_ORIGINS;
    process.env.PUBLIC_SMG_ORIGINS = "https://smg.example";
    assert.ok(listPublicSmgOrigins().includes("https://smg.example"));
    // Non-production test runner includes localhost defaults.
    if (process.env.NODE_ENV !== "production") {
      assert.ok(listPublicSmgOrigins().includes("http://localhost:8080"));
    }
    assert.equal(
      resolvePublicCorsOrigin("https://smg.example"),
      "https://smg.example",
    );
    assert.equal(resolvePublicCorsOrigin("https://evil.example"), null);
    if (prev === undefined) delete process.env.PUBLIC_SMG_ORIGINS;
    else process.env.PUBLIC_SMG_ORIGINS = prev;
  });

  it("skips scrape guard for /api/public", () => {
    assert.equal(shouldSkipScrapeGuard("/api/public"), true);
    assert.equal(shouldSkipScrapeGuard("/api/public/brief"), true);
    assert.equal(shouldSkipScrapeGuard("/api/public/catalog/products"), true);
  });
});

describe("POST /api/public/brief integration", () => {
  let tempDir = "";
  let prevDb = "";
  let prevWebhook = "";

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), "public-brief-"));
    prevDb = process.env.LEADS_DB_PATH || "";
    prevWebhook = process.env.QUOTE_WEBHOOK_URL || "";
    process.env.LEADS_DB_PATH = join(tempDir, "leads.sqlite");
    process.env.QUOTE_WEBHOOK_URL = "";
    const migrate = spawnSync("node", ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: process.env,
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
  });

  after(() => {
    process.env.LEADS_DB_PATH = prevDb;
    process.env.QUOTE_WEBHOOK_URL = prevWebhook;
    teardownTempDir(tempDir);
  });

  it("creates a quote visible under /ops/quotes path", async () => {
    const { POST } = await import("../app/api/public/brief/route");
    const res = await POST(
      new Request("http://localhost/api/public/brief", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:8080",
          "x-real-ip": "203.0.113.90",
          "user-agent": "node-test",
        },
        body: JSON.stringify(validBrief()),
      }),
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      ok: boolean;
      requestId: string;
      opsPath: string;
      messageTh?: string;
      nextSteps?: string[];
    };
    assert.equal(json.ok, true);
    assert.match(json.requestId, /^RFQ-/);
    assert.equal(json.opsPath, `/ops/quotes/${json.requestId}`);
    assert.match(json.messageTh || "", /ส่งคำขอแล้ว/);
    assert.ok(Array.isArray(json.nextSteps) && json.nextSteps.length >= 1);
    assert.equal(
      res.headers.get("access-control-allow-origin"),
      "http://localhost:8080",
    );

    const { getQuoteByRequestId } = await import("../lib/quote-repository");
    const row = getQuoteByRequestId(json.requestId);
    assert.ok(row);
    assert.equal(row?.email, "somchai@example.com");
    assert.match(row?.detail || "", /smg-ui brief/);
  });
});
