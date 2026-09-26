#!/usr/bin/env node
/**
 * Scan known demo/placeholder sources for runbook §33.3 markers.
 * Default: print a report (exit 0 even if matches found).
 * STRICT_NO_DEMO=1: exit 1 if any marker is found.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const MARKERS = ["GiftPro Asia", "example.com", "000-0000", "ตัวอย่าง"];

const TARGETS = [
  "lib/data.ts",
  ".env.example",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
];

const strict =
  String(process.env.STRICT_NO_DEMO ?? "").trim() === "1" ||
  ["true", "yes", "on"].includes(
    String(process.env.STRICT_NO_DEMO ?? "").trim().toLowerCase(),
  );

/** @type {{ file: string; marker: string; line: number; excerpt: string }[]} */
const hits = [];

for (const rel of TARGETS) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) {
    console.warn(`check:demo — missing file (skipped): ${rel}`);
    continue;
  }
  const text = readFileSync(abs, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const marker of MARKERS) {
      if (line.includes(marker)) {
        hits.push({
          file: relative(ROOT, abs) || rel,
          marker,
          line: i + 1,
          excerpt: line.trim().slice(0, 120),
        });
      }
    }
  }
}

console.log("check:demo — demo/placeholder scan");
console.log(`  targets: ${TARGETS.join(", ")}`);
console.log(`  markers: ${MARKERS.map((m) => JSON.stringify(m)).join(", ")}`);
console.log(`  STRICT_NO_DEMO: ${strict ? "1" : "0"}`);
console.log("");

if (hits.length === 0) {
  console.log("No demo markers found in scanned files.");
  process.exit(0);
}

console.log(`Found ${hits.length} hit(s):\n`);
for (const hit of hits) {
  console.log(`  ${hit.file}:${hit.line}  [${hit.marker}]`);
  console.log(`    ${hit.excerpt}`);
}

console.log("");
if (strict) {
  console.error(
    "STRICT_NO_DEMO=1 — failing because demo placeholders are still present.",
  );
  process.exit(1);
}

console.log(
  "Report only (exit 0). Set STRICT_NO_DEMO=1 to fail CI when markers remain.",
);
process.exit(0);
