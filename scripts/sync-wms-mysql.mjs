/**
 * One-shot: sync SQLite WMS balances → MySQL + mirror sg_sku.on_hand_qty.
 * Requires SMARTGIFT_MYSQL_ENABLED and db/mysql/wms_core.sql applied.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { DatabaseSync } from "node:sqlite";

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

const sqlitePath =
  process.env.SQLITE_PATH || path.join(root, ".data", "leads.sqlite");
const db = new DatabaseSync(
  path.isAbsolute(sqlitePath) ? sqlitePath : path.join(root, sqlitePath),
);

const balances = db
  .prepare(
    `SELECT b.product_key, b.qty_on_hand, b.qty_reserved, l.location_code
     FROM wms_balances b
     JOIN wms_locations l ON l.id = b.location_id`,
  )
  .all();

const conn = await mysql.createConnection({
  host: process.env.SMARTGIFT_MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.SMARTGIFT_MYSQL_PORT || 3307),
  user: process.env.SMARTGIFT_MYSQL_USER || "biz",
  password: process.env.SMARTGIFT_MYSQL_PASSWORD || "biz_secret",
  database: process.env.SMARTGIFT_MYSQL_DATABASE || "smartgift",
});

const [locRows] = await conn.query(
  "SELECT id, location_code FROM wms_location WHERE status = 'active'",
);
const locByCode = new Map(
  locRows.map((r) => [String(r.location_code), Number(r.id)]),
);

let written = 0;
const byProduct = new Map();
for (const bal of balances) {
  const locId = locByCode.get(String(bal.location_code || "BIN-DEFAULT"));
  if (!locId) continue;
  await conn.execute(
    `INSERT INTO wms_balance (product_key, location_id, qty_on_hand, qty_reserved)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       qty_on_hand = VALUES(qty_on_hand),
       qty_reserved = VALUES(qty_reserved)`,
    [
      String(bal.product_key),
      locId,
      Number(bal.qty_on_hand) || 0,
      Number(bal.qty_reserved) || 0,
    ],
  );
  written += 1;
  const key = String(bal.product_key).toUpperCase();
  byProduct.set(key, (byProduct.get(key) || 0) + (Number(bal.qty_on_hand) || 0));
}

let mirrored = 0;
for (const [key, qty] of byProduct) {
  const [hits] = await conn.query(
    `SELECT s.product_id
     FROM sg_sku s
     LEFT JOIN sg_ori_products o ON o.ori_product_id = s.ori_product_id
     WHERE UPPER(s.product_id) = ?
        OR UPPER(COALESCE(s.catalog_slug, '')) = ?
        OR UPPER(COALESCE(o.ori_product_code, '')) = ?
     LIMIT 5`,
    [key, key, key],
  );
  for (const hit of hits) {
    await conn.execute(
      `UPDATE sg_sku SET on_hand_qty = GREATEST(?, 0) WHERE product_id = ?`,
      [qty, hit.product_id],
    );
    mirrored += 1;
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      balanceRowsSynced: written,
      products: byProduct.size,
      skuRowsMirrored: mirrored,
      sample: [...byProduct.entries()].slice(0, 5),
    },
    null,
    2,
  ),
);
await conn.end();
db.close();
