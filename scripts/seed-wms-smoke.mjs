import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new DatabaseSync(path.join(root, ".data", "leads.sqlite"));
const loc = db
  .prepare(`SELECT id FROM wms_locations WHERE location_code = 'BIN-DEFAULT'`)
  .get();
if (!loc) throw new Error("BIN-DEFAULT missing — run npm run db:migrate");
const now = new Date().toISOString();
db.prepare(
  `INSERT INTO wms_balances (product_key, location_id, qty_on_hand, qty_reserved, updated_at)
   VALUES ('B00001', ?, 25, 0, ?)
   ON CONFLICT(product_key, location_id) DO UPDATE SET
     qty_on_hand = 25, qty_reserved = 0, updated_at = excluded.updated_at`,
).run(loc.id, now);
console.log(db.prepare(`SELECT * FROM wms_balances`).all());
db.close();
