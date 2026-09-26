import mysql from "mysql2/promise";

const c = await mysql.createConnection({
  host: "127.0.0.1",
  port: 3307,
  user: "biz",
  password: "biz_secret",
  database: "smartgift",
});
const [balances] = await c.query("SELECT * FROM wms_balance");
const [sku] = await c.query(
  "SELECT product_id, on_hand_qty FROM sg_sku WHERE product_id = ?",
  ["B00001"],
);
console.log(JSON.stringify({ balances, sku }, null, 2));
await c.end();
