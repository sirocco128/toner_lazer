#!/usr/bin/env node
/**
 * Staging rehearsal — apply committed demo intake to .env.staging (no production claims).
 */
import { copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEMO = resolve(ROOT, "intake/sprint2-intake.staging-demo.json");
const LOCAL = resolve(ROOT, "intake/sprint2-intake.json");
const STAGING_ENV = resolve(ROOT, ".env.staging");

console.log("sprint2:staging-demo — apply staging rehearsal intake");
console.log(`  source: ${DEMO}`);
console.log(`  target: ${STAGING_ENV}`);
console.log("  NOTE: demo values only — not production cutover");
console.log("");

if (!existsSync(DEMO)) {
  console.error("Missing intake/sprint2-intake.staging-demo.json");
  process.exit(1);
}

copyFileSync(DEMO, LOCAL);

const apply = spawnSync(
  "node",
  ["scripts/apply-sprint2-intake.mjs", "--target", ".env.staging", "--intake", LOCAL],
  { cwd: ROOT, stdio: "inherit" },
);
if (apply.status !== 0) process.exit(apply.status ?? 1);

const preflight = spawnSync(
  "node",
  ["scripts/sprint2-preflight.mjs", "--intake", LOCAL],
  { cwd: ROOT, stdio: "inherit" },
);
process.exit(preflight.status ?? 0);
