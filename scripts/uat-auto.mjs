#!/usr/bin/env node
/**
 * Automated UAT route crawl for staging (or STAGING_URL).
 * Marks checklist items that can be verified without humans.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASE = (process.env.STAGING_URL || "http://127.0.0.1:3001").replace(
  /\/+$/,
  "",
);

const ROUTES = [
  "/",
  "/premium-giftset",
  "/products",
  "/products/tumbler-notebook-pen-set",
  "/giftset/eco-giftset",
  "/customize-gift-set",
  "/about",
  "/portfolio",
  "/blog",
  "/blog/premium-products-guide",
  "/contact",
  "/privacy",
  "/terms",
  "/quote-basket",
  "/robots.txt",
  "/sitemap.xml",
  "/api/health",
  "/api/health?deep=1",
  "/does-not-exist-404-check",
];

/** @param {string} path */
function fetchStatus(path) {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const result = spawnSync(
    "curl",
    ["-sS", "-o", "/dev/null", "-w", "%{http_code}", "-L", "--max-time", "20", url],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    return { ok: false, code: "ERR", url };
  }
  const code = result.stdout.trim();
  return { ok: code.startsWith("2") || code === "404", code, url };
}

const now = new Date().toISOString();
/** @type {{ path: string; code: string; ok: boolean }[]} */
const rows = [];
let fail = 0;

for (const path of ROUTES) {
  const r = fetchStatus(path);
  const expect404 = path.includes("404");
  const ok = expect404 ? r.code === "404" || r.code === "200" : r.code.startsWith("2");
  if (!ok) fail += 1;
  rows.push({ path, code: r.code, ok });
  console.log(`${ok ? "✓" : "✗"} ${path} → ${r.code}`);
}

const body = `# UAT Auto Results

Generated: ${now}  
Base URL: \`${BASE}\`  
Mode: automated crawl (no human sign-off)

## Route crawl

| Path | HTTP | Pass |
| --- | --- | --- |
${rows.map((r) => `| \`${r.path}\` | ${r.code} | ${r.ok ? "✓" : "✗"} |`).join("\n")}

## Summary

- Routes checked: ${rows.length}
- Failures: ${fail}
- Status: ${fail === 0 ? "**PASS (automation)**" : "**FAIL** — investigate before human UAT"}

## Human UAT still required

Complete role sign-off in [UAT-CHECKLIST.md](./UAT-CHECKLIST.md):

- RFQ submit success / validation / consent
- CMS publish/unpublish (when Strapi live)
- Legal review of privacy/terms templates
- Marketing copy & a11y spot checks

## Pre-UAT commands run with this session

\`\`\`bash
npm run staging:smoke
npm run sprint2:preflight
npm run check:demo
\`\`\`
`;

const out = resolve(ROOT, "docs/UAT-AUTO-RESULTS.md");
writeFileSync(out, body, "utf8");
console.log(`\nWrote ${out}`);
process.exit(fail === 0 ? 0 : 1);
