import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = path.join(root, "db", "mysql", "wms_core.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const conn = await mysql.createConnection({
  host: process.env.SMARTGIFT_MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.SMARTGIFT_MYSQL_PORT || 3307),
  user: process.env.SMARTGIFT_MYSQL_USER || "biz",
  password: process.env.SMARTGIFT_MYSQL_PASSWORD || "biz_secret",
  database: process.env.SMARTGIFT_MYSQL_DATABASE || "smartgift",
  multipleStatements: true,
});

await conn.query(sql);
const [tables] = await conn.query("SHOW TABLES LIKE 'wms_%'");
const [locs] = await conn.query(
  "SELECT location_code, kind FROM wms_location ORDER BY location_code",
);
const [skus] = await conn.query(
  "SELECT product_id, catalog_slug, on_hand_qty FROM sg_sku ORDER BY product_id LIMIT 8",
);
console.log(JSON.stringify({ tables, locs, skusSample: skus }, null, 2));
await conn.end();
