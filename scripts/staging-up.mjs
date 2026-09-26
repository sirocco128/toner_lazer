#!/usr/bin/env node
/**
 * Ensure .env.staging exists before docker compose staging up.
 */
import { existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const stagingEnv = resolve(ROOT, ".env.staging");
const example = resolve(ROOT, ".env.staging.example");

if (!existsSync(stagingEnv)) {
  if (!existsSync(example)) {
    console.error("Missing .env.staging.example");
    process.exit(1);
  }
  copyFileSync(example, stagingEnv);
  console.log("Created .env.staging from .env.staging.example — edit secrets before production staging.");
}

const result = spawnSync(
  "docker",
  ["compose", "-f", "docker-compose.staging.yml", "up", "-d", "--build"],
  { cwd: ROOT, stdio: "inherit" },
);

process.exit(result.status ?? 1);
