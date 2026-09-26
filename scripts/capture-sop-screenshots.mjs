#!/usr/bin/env node
/**
 * Capture real Ops screenshots for the /sop guide.
 *
 * Prerequisites:
 *   1. App running (npm run dev) at SOP_CAPTURE_BASE_URL
 *   2. ADMIN_SESSION_SECRET in .env.local (signs ops_session cookie)
 *   3. playwright installed (npx playwright install chromium)
 *
 * Auth: injects an admin ops_session cookie (no UI login). Uses
 * SOP_CAPTURE_EMAIL or ADMIN_EMAIL for the actor email.
 *
 * Usage:
 *   npm run sop:screenshots
 */
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "public/sop/screenshots");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

const BASE = (process.env.SOP_CAPTURE_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);
const ACTOR_EMAIL = (() => {
  const capture = (process.env.SOP_CAPTURE_EMAIL || "").trim().toLowerCase();
  if (capture.includes("@")) return capture;
  // Do not use ADMIN_EMAIL here — that address may exist in ops_staff with a
  // narrower role, and hydrateOpsActor would replace the injected admin cookie.
  return "sop-capture@local";
})();
const ACTOR_NAME = (process.env.ADMIN_NAME || "ผู้ดูแล").trim() || "ผู้ดูแล";
const SESSION_SECRET = (process.env.ADMIN_SESSION_SECRET || "").trim();

/** Mirror lib/ops-auth createOpsSessionToken (v2) so capture skips the login form. */
function createOpsSessionCookieValue() {
  if (SESSION_SECRET.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET missing or too short");
  }
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const email = ACTOR_EMAIL.includes("@") ? ACTOR_EMAIL : "admin@local";
  const body = Buffer.from(
    JSON.stringify({
      v: 2,
      email,
      name: ACTOR_NAME,
      role: "admin",
      exp,
    }),
    "utf8",
  ).toString("base64url");
  const payload = `v2.${body}`;
  const sig = createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

async function loadTargets() {
  const modPath = resolve(ROOT, "lib/sop-guide-content.ts");
  const mod = await import(pathToFileURL(modPath).href);
  /** @type {{ id: string; path: string }[]} */
  const targets = mod.listSopCaptureTargets();
  // Prefer unique files; quote/order detail still get their own PNG of the list
  // unless we can open the first detail link after login.
  return targets;
}

function ensurePlaywright() {
  try {
    return import("playwright");
  } catch {
    console.error("Installing playwright…");
    const install = spawnSync("npm", ["install", "-D", "playwright"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
    if (install.status !== 0) {
      throw new Error("Failed to install playwright");
    }
    spawnSync("npx", ["playwright", "install", "chromium"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
    return import("playwright");
  }
}

async function main() {
  if (SESSION_SECRET.length < 32) {
    console.error("ADMIN_SESSION_SECRET is required (min 32 chars) in .env.local");
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  let targets;
  try {
    targets = await loadTargets();
  } catch (err) {
    console.warn(
      "Could not import TS content module; using fallback route list.",
      err instanceof Error ? err.message : err,
    );
    targets = FALLBACK_ROUTES;
  }

  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "th-TH",
  });

  const sessionValue = createOpsSessionCookieValue();
  const baseHost = new URL(BASE).hostname;
  await context.addCookies([
    {
      name: "ops_session",
      value: sessionValue,
      domain: baseHost,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
  console.log(`Injected ops_session for ${ACTOR_EMAIL} → ${BASE}`);

  const page = await context.newPage();
  await page.goto(`${BASE}/ops`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  if (page.url().includes("/ops/login")) {
    console.error("Session cookie rejected — check ADMIN_SESSION_SECRET matches the running server");
    await page.screenshot({
      path: resolve(OUT_DIR, "_login-failed.png"),
      fullPage: true,
    });
    await browser.close();
    process.exit(1);
  }
  console.log("Session OK →", page.url());

  const results = [];
  for (const target of targets) {
    const outFile = resolve(OUT_DIR, `${target.id}.png`);
    const path = target.path;
    let lastError = null;
    let captured = false;

    for (let attempt = 1; attempt <= 3 && !captured; attempt++) {
      try {
        console.log(
          `Capture ${target.id} ← ${path}${attempt > 1 ? ` (retry ${attempt})` : ""}`,
        );
        const response = await page.goto(`${BASE}${path}`, {
          waitUntil: "load",
          timeout: 120_000,
        });
        if (response && response.status() >= 500) {
          throw new Error(`HTTP ${response.status()}`);
        }
        await page
          .locator('[aria-label="กำลังโหลดคอนโซล"]')
          .waitFor({ state: "hidden", timeout: 90_000 })
          .catch(() => null);
        await page.locator("h1").first().waitFor({
          state: "visible",
          timeout: 60_000,
        });
        await page.waitForTimeout(600);

        if (target.id === "ops-quote-detail" || target.id === "ops-order-detail") {
          const detail = page
            .locator(
              'table a[href*="/ops/quotes/"], table a[href*="/ops/orders/"], a[href*="/ops/quotes/"]:visible, a[href*="/ops/orders/"]:visible',
            )
            .first();
          if ((await detail.count()) > 0) {
            await Promise.all([
              page.waitForLoadState("domcontentloaded").catch(() => null),
              detail.click(),
            ]);
            await page
              .locator('[aria-label="กำลังโหลดคอนโซล"]')
              .waitFor({ state: "hidden", timeout: 90_000 })
              .catch(() => null);
            await page.locator("h1").first().waitFor({
              state: "visible",
              timeout: 60_000,
            });
            await page.waitForTimeout(400);
          }
        }

        await page.screenshot({ path: outFile, fullPage: true });
        results.push({ id: target.id, ok: true, file: outFile, attempt });
        captured = true;
      } catch (err) {
        lastError = err;
        console.warn(
          `  failed attempt ${attempt}: ${target.id}`,
          err instanceof Error ? err.message.split("\n")[0] : err,
        );
        await page.waitForTimeout(1500 * attempt);
      }
    }

    if (!captured) {
      // Keep any previous good PNG; only write placeholder if missing/tiny.
      const keepExisting =
        existsSync(outFile) && readFileSync(outFile).byteLength > 5000;
      if (!keepExisting) {
        writePlaceholderPng(outFile, target.id, path);
      } else {
        console.warn(`  keeping previous screenshot for ${target.id}`);
      }
      results.push({
        id: target.id,
        ok: false,
        file: outFile,
        keptPrevious: keepExisting,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      });
    }
  }

  await browser.close();

  const ok = results.filter((r) => r.ok).length;
  console.log(`Done: ${ok}/${results.length} screenshots → ${OUT_DIR}`);
  writeFileSync(
    resolve(OUT_DIR, "capture-report.json"),
    JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2),
  );
}

/** Minimal valid 1x1 PNG when capture fails. */
function writePlaceholderPng(filePath, id, path) {
  // 1x1 dark green pixel
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  writeFileSync(filePath, Buffer.from(b64, "base64"));
  writeFileSync(
    filePath.replace(/\.png$/, ".txt"),
    `placeholder for ${id} (${path}) — re-run npm run sop:screenshots\n`,
  );
}

const FALLBACK_ROUTES = [
  { id: "ops-login", path: "/ops/login" },
  { id: "ops-overview", path: "/ops" },
  { id: "ops-board", path: "/ops/board" },
  { id: "public-contact-rfq", path: "/contact" },
  { id: "ops-quotes", path: "/ops/quotes" },
  { id: "ops-quote-detail", path: "/ops/quotes" },
  { id: "ops-inquiries", path: "/ops/inquiries" },
  { id: "ops-schedule", path: "/ops/schedule" },
  { id: "ops-customers", path: "/ops/customers" },
  { id: "ops-orders", path: "/ops/orders" },
  { id: "ops-order-detail", path: "/ops/orders" },
  { id: "ops-assistant", path: "/ops/assistant" },
  { id: "ops-line-lab", path: "/ops/line-lab" },
  { id: "public-pay", path: "/ops/approvals" },
  { id: "ops-approvals", path: "/ops/approvals" },
  { id: "ops-cycle", path: "/ops/cycle" },
  { id: "ops-receipts", path: "/ops/receipts" },
  { id: "ops-qr-pay", path: "/ops/qr-pay" },
  { id: "ops-factory-po", path: "/ops/factory-po" },
  { id: "ops-factories", path: "/ops/factories" },
  { id: "ops-inbound", path: "/ops/inbound" },
  { id: "ops-pay-factory", path: "/ops/pay-factory" },
  { id: "ops-assets", path: "/ops/assets" },
  { id: "ops-claims", path: "/ops/claims" },
  { id: "ops-issues", path: "/ops/issues" },
  { id: "ops-holds", path: "/ops/holds" },
  { id: "ops-pricing", path: "/ops/pricing" },
  { id: "ops-pricing-import", path: "/ops/pricing/import" },
  { id: "ops-products", path: "/ops/products" },
  { id: "ops-catalog-books", path: "/ops/catalog-books" },
  { id: "ops-catalog-images", path: "/ops/catalog-images" },
  { id: "ops-reports", path: "/ops/reports" },
  { id: "ops-finance", path: "/ops/finance" },
  { id: "ops-finance-ledger", path: "/ops/finance/ledger" },
  { id: "ops-seo", path: "/ops/seo" },
  { id: "ops-blog", path: "/ops/blog" },
  { id: "ops-audit", path: "/ops/audit" },
  { id: "ops-users", path: "/ops/users" },
];

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
