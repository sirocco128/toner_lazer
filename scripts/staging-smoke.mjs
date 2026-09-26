#!/usr/bin/env node
/**
 * Local staging smoke — expects docker-compose.staging web on port 3001.
 */
import { spawnSync } from "node:child_process";
import { platform } from "node:os";

const BASE = process.env.STAGING_URL || "http://127.0.0.1:3011";
const paths = ["/api/health", "/api/health?deep=1", "/"];
const nullDevice = platform() === "win32" ? "NUL" : "/dev/null";
const curlBin = platform() === "win32" ? "curl.exe" : "curl";

console.log(`staging:smoke — ${BASE}`);

/** @param {string} path */
function curl(path) {
  const url = `${BASE.replace(/\/+$/, "")}${path}`;
  const result = spawnSync(
    curlBin,
    ["-fsS", "-o", nullDevice, "-w", "%{http_code}", url],
    {
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    console.error(`  ✗ ${path} — curl failed (${result.stderr?.trim() || "unknown"})`);
    return false;
  }
  const code = result.stdout.trim();
  const ok = code.startsWith("2");
  console.log(`  ${ok ? "✓" : "✗"} ${path} → HTTP ${code}`);
  return ok;
}

let ok = true;
for (const path of paths) {
  ok = curl(path) && ok;
}

if (!ok) {
  console.error("");
  console.error("Staging smoke failed. Start stack:");
  console.error("  cp .env.staging.example .env.staging");
  console.error("  docker compose -f docker-compose.staging.yml up -d --build");
  process.exit(1);
}

console.log("");
console.log("Staging smoke passed.");
