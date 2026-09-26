#!/usr/bin/env node
/**
 * Copy public/ and .next/static into .next/standalone for standalone deploy.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const standaloneDir = join(ROOT, ".next", "standalone");
const staticSrc = join(ROOT, ".next", "static");
const publicSrc = join(ROOT, "public");

if (!existsSync(standaloneDir)) {
  console.error(
    "Missing .next/standalone — run `next build` with output: 'standalone' first.",
  );
  process.exit(1);
}

if (!existsSync(staticSrc)) {
  console.error("Missing .next/static — build may have failed.");
  process.exit(1);
}

mkdirSync(join(standaloneDir, ".next"), { recursive: true });
cpSync(staticSrc, join(standaloneDir, ".next", "static"), { recursive: true });

if (existsSync(publicSrc)) {
  cpSync(publicSrc, join(standaloneDir, "public"), { recursive: true });
}

const docsSrc = join(ROOT, "docs");
if (existsSync(docsSrc)) {
  cpSync(docsSrc, join(standaloneDir, "docs"), { recursive: true });
}

console.log("Standalone assets prepared under .next/standalone");
