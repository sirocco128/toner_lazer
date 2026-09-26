#!/usr/bin/env node
/**
 * Push the toner catalog (categories + products + direct sell price) into
 * the NEXTERP MySQL database used by lib/nexterp-mysql.ts.
 *
 *   npm run toner:nexterp            # dry run — shows the plan, writes nothing
 *   npm run toner:nexterp -- --apply # write inside one transaction
 *   npm run toner:nexterp -- --json  # print the plan as JSON
 *
 * Env (same as the app): NEXTERP_MYSQL_URL or NEXTERP_MYSQL_HOST/PORT/USER/
 * PASSWORD/DATABASE. Pricing: TONER_SUPPLIER_DISCOUNT, TONER_BOX_COST_THB,
 * TONER_DIRECT_MARGIN, TONER_ECONOMY_MARGIN, TONER_DEALER_MARGIN.
 *
 * Safety:
 *   - matches products by `sku`, categories by `code`; never deletes rows
 *   - aborts before writing if NEXTERP has NOT NULL columns this sync cannot fill
 *   - --apply runs in a single transaction and rolls back on any error
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import {
  NEXTERP_WRITTEN_COLUMNS,
  TONER_CATALOG,
  buildNexterpSyncPlan,
  buildNexterpTonerCategories,
  buildNexterpTonerProducts,
  missingRequiredColumns,
  priceToner,
  tonerPricingConfigFromEnv,
} from "../lib/toner-catalog.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnv(path.join(root, ".env.local"));
loadDotEnv(path.join(root, ".env"));

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const AS_JSON = args.has("--json");

function connectionOptions() {
  const url = (process.env.NEXTERP_MYSQL_URL || "").trim();
  if (url) return url;
  return {
    host: (process.env.NEXTERP_MYSQL_HOST || "127.0.0.1").trim(),
    port: Number(process.env.NEXTERP_MYSQL_PORT || 3307),
    user: (process.env.NEXTERP_MYSQL_USER || "terabis").trim(),
    password: process.env.NEXTERP_MYSQL_PASSWORD ?? "terabis",
    database: (process.env.NEXTERP_MYSQL_DATABASE || "nexterp_staging").trim(),
    connectTimeout: 5000,
  };
}

async function readColumns(conn, table) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name, IS_NULLABLE AS nullable,
            COLUMN_DEFAULT AS dflt, EXTRA AS extra
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  if (rows.length === 0) {
    throw new Error(`NEXTERP table \`${table}\` not found in this database`);
  }
  return rows.map((r) => ({
    name: r.name,
    nullable: r.nullable === "YES",
    hasDefault: r.dflt != null || /DEFAULT_GENERATED/i.test(r.extra || ""),
    autoIncrement: /auto_increment/i.test(r.extra || ""),
  }));
}

function printPlan(plan, config) {
  console.log("NEXTERP toner sync — " + (APPLY ? "APPLY" : "DRY RUN (no writes)"));
  console.log(
    `pricing: supplier discount ${(config.supplierDiscount * 100).toFixed(0)}%, ` +
      `box ${config.boxCostThb} THB, direct margin ${(config.directMargin * 100).toFixed(0)}%`,
  );
  console.log("");
  console.log(`categories to insert: ${plan.categoryInserts.length}`);
  for (const c of plan.categoryInserts) console.log(`  + ${c.code}  ${c.name_th}`);
  console.log(`products to insert:   ${plan.productInserts.length}`);
  for (const p of plan.productInserts) {
    console.log(`  + ${p.sku.padEnd(15)} ${String(p.sell_price).padStart(5)} THB  ${p.name}`);
  }
  console.log(`products to update:   ${plan.productUpdates.length}`);
  for (const u of plan.productUpdates) {
    console.log(`  ~ ${u.sku.padEnd(15)} ${Object.keys(u.fields).join(", ")}`);
  }
  console.log(`unchanged:            ${plan.unchanged.length}`);
  console.log("");
  console.log("price tiers (THB): sku / landed cost / direct / economy / dealer");
  for (const item of TONER_CATALOG) {
    const p = priceToner(item, config);
    console.log(
      `  ${item.sku.padEnd(15)} ${String(p.landedCost).padStart(4)} ` +
        `${String(p.direct).padStart(5)} ${String(p.economy).padStart(5)} ` +
        `${String(p.dealer).padStart(5)}${p.dealerCapped ? " (capped < Advice)" : ""}`,
    );
  }
}

async function applyPlan(conn, plan) {
  await conn.beginTransaction();
  try {
    for (const c of plan.categoryInserts) {
      await conn.execute(
        "INSERT INTO categories (code, name_th, name_en) VALUES (?, ?, ?)",
        [c.code, c.name_th, c.name_en],
      );
    }
    const [catRows] = await conn.query("SELECT id, code FROM categories");
    const catId = new Map(catRows.map((r) => [String(r.code).toUpperCase(), r.id]));
    const resolveCat = (code) => {
      const id = catId.get(code.toUpperCase());
      if (id == null) throw new Error(`category ${code} missing after insert`);
      return id;
    };

    for (const p of plan.productInserts) {
      await conn.execute(
        `INSERT INTO products
           (sku, name, description, category_id, category_raw, uom, sell_price, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.sku,
          p.name,
          p.description,
          resolveCat(p.category_code),
          p.category_raw,
          p.uom,
          p.sell_price,
          p.is_active,
        ],
      );
    }

    for (const u of plan.productUpdates) {
      const sets = [];
      const values = [];
      for (const [key, value] of Object.entries(u.fields)) {
        if (key === "category_code") {
          sets.push("category_id = ?");
          values.push(resolveCat(value));
        } else {
          sets.push(`\`${key}\` = ?`);
          values.push(value);
        }
      }
      values.push(u.id);
      await conn.execute(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`, values);
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}

async function main() {
  const config = tonerPricingConfigFromEnv(process.env);
  const categories = buildNexterpTonerCategories(TONER_CATALOG);
  const products = buildNexterpTonerProducts(TONER_CATALOG, config);

  const conn = await mysql.createConnection(connectionOptions());
  try {
    const productCols = await readColumns(conn, "products");
    const categoryCols = await readColumns(conn, "categories");
    const missing = [
      ...missingRequiredColumns(categoryCols, NEXTERP_WRITTEN_COLUMNS.categories).map(
        (c) => `categories.${c}`,
      ),
      ...missingRequiredColumns(productCols, NEXTERP_WRITTEN_COLUMNS.products).map(
        (c) => `products.${c}`,
      ),
    ];
    if (missing.length > 0) {
      throw new Error(
        `NEXTERP requires columns this sync does not fill: ${missing.join(", ")}. ` +
          "Add them to lib/toner-catalog.ts before syncing.",
      );
    }

    const [existingCategories] = await conn.query("SELECT id, code FROM categories");
    const skus = products.map((p) => p.sku);
    const [existingProducts] = await conn.query(
      `SELECT id, sku, name, description, category_id, category_raw, uom,
              sell_price, is_active
       FROM products WHERE sku IN (?)`,
      [skus],
    );

    const plan = buildNexterpSyncPlan({
      categories,
      products,
      existingCategories,
      existingProducts,
    });

    if (AS_JSON) console.log(JSON.stringify(plan, null, 2));
    else printPlan(plan, config);

    if (!APPLY) {
      console.log("\nDry run only. Re-run with --apply to write to NEXTERP.");
      return;
    }
    await applyPlan(conn, plan);
    console.log(
      `\nApplied: +${plan.categoryInserts.length} categories, ` +
        `+${plan.productInserts.length} products, ~${plan.productUpdates.length} updated.`,
    );
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(`[toner:nexterp] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
