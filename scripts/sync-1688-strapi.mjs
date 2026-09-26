#!/usr/bin/env node
/**
 * Compile lib/alibaba then run the 1688 → Strapi price sync.
 *
 *   npm run 1688:sync -- --dry-run
 *   npm run 1688:sync
 *   npm run 1688:sync -- --fetch
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import Module from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, ".tmp", "tests");

const dryRun = process.argv.includes("--dry-run");
const fetchLive = process.argv.includes("--fetch");

mkdirSync(join(ROOT, ".tmp"), { recursive: true });

const tscBin = join(ROOT, "node_modules", "typescript", "bin", "tsc");
const compiled = spawnSync(
  process.execPath,
  existsSync(tscBin)
    ? [tscBin, "-p", "tsconfig.test.json"]
    : ["tsc", "-p", "tsconfig.test.json"],
  {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  },
);
if ((compiled.status ?? 1) !== 0) {
  console.error("Failed to compile 1688 sync modules.");
  process.exit(compiled.status ?? 1);
}

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request, parent, isMain, options) {
  if (typeof request === "string" && request.startsWith("@/")) {
    request = join(OUT_DIR, request.slice(2));
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const require = createRequire(import.meta.url);

try {
  const { run1688StrapiSync } = require(join(OUT_DIR, "lib/alibaba/sync-strapi.js"));
  const rows = await run1688StrapiSync({
    root: ROOT,
    dryRun,
    fetchLive,
  });
  for (const row of rows) {
    if (row.range) {
      const state = row.updated ? "updated" : dryRun ? "dry-run" : "pending";
      console.log(
        `${state}  ${row.slug}  ${row.range.priceRange}  (offer ${row.offerId})`,
      );
    } else {
      console.log(`skip  ${row.slug}  ${row.skipped ?? "no range"}`);
    }
    if (row.skipped && row.range) {
      console.log(`  note: ${row.skipped}`);
    }
  }
  const written = rows.filter((row) => row.updated).length;
  const priced = rows.filter((row) => row.range).length;
  console.log(
    dryRun
      ? `\nDry run: ${priced}/${rows.length} offers have THB ranges. Re-run without --dry-run to write Strapi.`
      : `\nWrote ${written}/${rows.length} products to Strapi.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  rmSync(join(ROOT, ".tmp"), { recursive: true, force: true });
  process.exit(1);
}

rmSync(join(ROOT, ".tmp"), { recursive: true, force: true });
