#!/usr/bin/env node
/**
 * Apply every schema migration this stack owns:
 *   1) db/migrations/*.sql → SQLite (ops / leads)
 *   2) db/mysql/wms_core.sql → SmartGift MySQL when SMARTGIFT_MYSQL_ENABLED=true
 *
 * Used by the Compose `migrate` service. Idempotent.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, file) {
  console.log(`==> ${label}`);
  const result = spawnSync(process.execPath, [file], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("SQLite db/migrations/*.sql", resolve(root, "scripts/migrate.mjs"));

const mysqlOn = String(process.env.SMARTGIFT_MYSQL_ENABLED || "").toLowerCase();
if (mysqlOn === "true" || mysqlOn === "1") {
  run("MySQL db/mysql/wms_core.sql", resolve(root, "scripts/apply-wms-mysql.mjs"));
} else {
  console.log("skip  MySQL WMS (SMARTGIFT_MYSQL_ENABLED is not true)");
}

console.log("All compose migrations complete.");
