import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

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

function runGuard(script: string, envOverrides: Record<string, string>) {
  return spawnSync(process.execPath, [join("scripts", script)], {
    cwd: ROOT,
    env: { ...process.env, ...envOverrides },
    encoding: "utf8",
  });
}

describe("env-guard (§31 required)", () => {
  it("validate-env exits 0 when indexing is false (demo allowed)", () => {
    const result = runGuard("validate-env.mjs", {
      NEXT_PUBLIC_ALLOW_INDEXING: "false",
      NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
    });
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || "validate-env failed unexpectedly",
    );
  });

  it("validate-env exits 1 when GA measurement id is set but invalid", () => {
    const result = runGuard("validate-env.mjs", {
      NEXT_PUBLIC_ALLOW_INDEXING: "false",
      NEXT_PUBLIC_GA_MEASUREMENT_ID: "UA-123456-1",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr || result.stdout, /GA_MEASUREMENT_ID/i);
  });

  it("validate-env exits 1 when indexing=true with example.com phone/email", () => {
    const result = runGuard("validate-env.mjs", {
      NEXT_PUBLIC_ALLOW_INDEXING: "true",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
      NEXT_PUBLIC_SITE_NAME: "GiftPro Asia Demo",
      NEXT_PUBLIC_SITE_PHONE_DISPLAY: "000-000-0000",
      NEXT_PUBLIC_SITE_PHONE_HREF: "tel:+66000000000",
      NEXT_PUBLIC_SITE_EMAIL: "hello@example.com",
      NEXT_PUBLIC_LINE_ID: "@giftproasia",
      NEXT_PUBLIC_LINE_URL: "https://line.me/ti/p/@giftproasia",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr || result.stdout, /validate:env FAILED/i);
  });

  it("validate-runtime exits 1 when RUNTIME_STRICT=true and IP_HASH_SECRET is short", () => {
    const result = runGuard("validate-runtime.mjs", {
      RUNTIME_STRICT: "true",
      NEXT_PUBLIC_ALLOW_INDEXING: "false",
      IP_HASH_SECRET: "too-short",
      CMS_MODE: "mock",
      LEAD_STORAGE_MODE: "sqlite",
      REVALIDATE_SECRET: "test-revalidate-secret-at-least-32-chars!!",
      CRON_SECRET: "test-cron-secret-at-least-32-characters-ok!",
    });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr || result.stdout,
      /IP_HASH_SECRET/i,
    );
  });
});
