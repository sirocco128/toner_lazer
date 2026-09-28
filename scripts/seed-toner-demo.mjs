#!/usr/bin/env node
/**
 * Seed a year of simulated toner business into an ops SQLite database —
 * customers, quotes, credit/cash orders, dropship shipments, deliveries,
 * payments, tax documents and journals — through the real services, then
 * backdate timestamps so reports, aging and dashboards look like a company
 * that has been trading for 12 months up to today.
 *
 *   SQLITE_PATH=.data/demo-toner.sqlite npm run seed:toner-demo
 *   ... -- --seed 8 --start 2025-10-01
 *   ... -- --force      # allow seeding into a DB that already has orders
 *
 * All names end with "(จำลอง)" and use @example.com emails. Never run
 * against a production database.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { ROOT, loadCompiledLib } from "./ts-runtime.mjs";

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!process.env.SQLITE_PATH) {
  console.error("SQLITE_PATH is required, e.g. SQLITE_PATH=.data/demo-toner.sqlite");
  process.exit(1);
}
if (/prod/i.test(process.env.SQLITE_PATH) || process.env.NODE_ENV === "production") {
  console.error("Refusing to seed simulated data into what looks like production.");
  process.exit(1);
}
process.env.LEAD_STORAGE_MODE = "sqlite";
process.env.IP_HASH_SECRET ||= "seed-toner-demo-ip-hash-secret-32-chars";
process.env.SITE_TAX_ID ||= "0105556003873";
process.env.PROMPTPAY_ID ||= "0105556003873";
delete process.env.QUOTE_WEBHOOK_URL;
process.env.NEXTERP_MYSQL_ENABLED = "false";

const migrate = spawnSync(process.execPath, [resolve(ROOT, "scripts/migrate.mjs")], {
  cwd: ROOT,
  env: process.env,
  encoding: "utf8",
});
if (migrate.status !== 0) {
  console.error(migrate.stderr || migrate.stdout);
  process.exit(1);
}

const lib = loadCompiledLib();
const { getDb, closeDb } = lib("database");
const { simulateTonerBusiness, simDate, CUSTOMER_TYPES } = lib("toner-sim");
const { TONER_CATALOG, tonerPricingConfigFromEnv } = lib("toner-catalog");
const { buildDropshipDraft } = lib("dropship");
const { createDropshipOrder, setDropshipStatus } = lib("dropship-repository");
const { resetQuoteRepository, updateQuoteOps } = lib("quote-repository");
const { resetOrderRepository } = lib("order-repository");
const { submitQuotePayload } = lib("quote-service");
const { createOrderFromQuote, confirmPayment, updateOrderFulfillment, getOrderBundle } =
  lib("order-service");

closeDb();
resetQuoteRepository();
resetOrderRepository();
const db = getDb();

const existing = db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
if (existing > 0 && !args.includes("--force")) {
  console.error(`Database already has ${existing} orders. Use a fresh SQLITE_PATH or pass --force.`);
  process.exit(1);
}

const startDate = argValue("--start") || "2025-10-01";
const today = new Date();
const endDay = Math.floor((today.getTime() - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
const pricing = tonerPricingConfigFromEnv(process.env);
const sim = simulateTonerBusiness({
  seed: argValue("--seed") ? Number(argValue("--seed")) : undefined,
  startDate,
  endDay,
  pricing,
});

const catalog = new Map(TONER_CATALOG.map((t) => [t.sku, t]));
const customers = new Map(sim.customers.map((c) => [c.id, c]));
const iso = (day, hour = 10) => {
  const d = simDate(startDate, day);
  d.setUTCHours(hour - 7, 0, 0, 0); // hour in Bangkok
  return d.toISOString();
};
const ymd = (day) => new Date(Date.parse(`${startDate}T00:00:00Z`) + day * 86_400_000).toISOString().slice(0, 10);

const stmt = {
  order: db.prepare("UPDATE orders SET created_at = ?, updated_at = ?, due_date = ? WHERE order_id = ?"),
  quote: db.prepare(
    "UPDATE quote_requests SET submitted_at = ?, consent_at = ?, created_at = ?, updated_at = ? WHERE request_id = ?",
  ),
  payCreated: db.prepare("UPDATE payments SET created_at = ?, updated_at = ? WHERE payment_id = ?"),
  payConfirmed: db.prepare("UPDATE payments SET confirmed_at = ?, updated_at = ? WHERE payment_id = ?"),
  doc: db.prepare("UPDATE billing_documents SET issued_at = ?, created_at = ? WHERE document_id = ?"),
  events: db.prepare("SELECT id, event_type FROM order_events WHERE order_id = ?"),
  event: db.prepare("UPDATE order_events SET created_at = ? WHERE id = ?"),
  journals: db.prepare("SELECT entry_id, source_key FROM journal_entries WHERE order_id = ?"),
  journal: db.prepare("UPDATE journal_entries SET entry_date = ?, created_at = ? WHERE entry_id = ?"),
  customer: db.prepare(
    "UPDATE customers SET created_at = MIN(created_at, ?), last_order_at = ?, credit_days = ? WHERE email = ?",
  ),
};

let n = 0;
let ipCounter = 0;
const summaryLines = (lines) =>
  lines.map((l) => `${catalog.get(l.sku)?.model ?? l.sku} ×${l.qty}`).join(", ");

for (const o of sim.orders) {
  const c = customers.get(o.customerId);
  if (!c) continue;
  ipCounter += 1;
  const ip = `198.51.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;
  const productSummary = `ตลับหมึกเลเซอร์เทียบเท่า ${summaryLines(o.lines)}`;

  const quote = await submitQuotePayload(
    {
      name: c.contactName,
      company: c.name,
      email: c.email,
      phone: c.phone,
      quantity: o.qty,
      productInterest: productSummary,
      consent: true,
      decorationMethod: "not-sure",
      website: "",
      startedAt: Date.now() - 8_000,
    },
    { headers: new Headers({ "x-forwarded-for": ip }) },
  );
  if (!quote.ok) throw new Error(`quote ${o.id}: ${quote.formError || JSON.stringify(quote)}`);
  updateQuoteOps({ requestId: quote.requestId, leadStatus: "won" });

  const credit = o.creditDays > 0;
  const order = createOrderFromQuote({
    quoteRequestId: quote.requestId,
    amount: o.revenueExVat,
    vatMode: "exclusive",
    depositMode: credit ? "credit" : "full",
    creditDays: credit ? o.creditDays : undefined,
    quantity: o.qty,
    productSummary,
    billingName: c.name,
    billingAddress: c.address,
    shipToName: `${c.contactName} ${c.name}`,
    shipToPhone: c.phone,
    shipToAddress: c.address,
    shipToProvince: c.province,
    actor: "seed-toner-demo",
  });

  // Dropship to Color Fly on the order date; replacements for defects as a second shipment.
  const shipTo = { name: `${c.contactName} ${c.name}`, phone: c.phone, address: c.address, province: c.province };
  const draft = buildDropshipDraft({
    orderId: order.orderId,
    shipTo,
    lines: o.lines.map((l) => ({ item: catalog.get(l.sku), qty: l.qty })),
    pricing,
  });
  const ds = createDropshipOrder(draft, "seed-toner-demo", simDate(startDate, o.orderDay));
  setDropshipStatus({ dropshipId: ds.dropshipId, status: "sent", now: simDate(startDate, o.orderDay) });

  const delivered = o.deliveryDay <= endDay;
  const payments = () => getOrderBundle(order.orderId)?.payments ?? [];

  if (!credit) {
    const full = payments().find((p) => p.kind === "full" && p.status === "pending");
    if (full) confirmPayment({ paymentId: full.paymentId, actor: "seed-toner-demo" });
  }
  if (delivered) {
    setDropshipStatus({
      dropshipId: ds.dropshipId,
      status: "shipped",
      trackingNo: `SIMTH${String(100000 + n)}`,
      carrier: ["Flash", "Kerry", "ไปรษณีย์ไทย"][n % 3],
      now: simDate(startDate, o.orderDay + 1),
    });
    setDropshipStatus({ dropshipId: ds.dropshipId, status: "delivered", now: simDate(startDate, o.deliveryDay) });
    updateOrderFulfillment({ orderId: order.orderId, status: "out_for_delivery", skipWarehouse: true, actor: "seed-toner-demo" });
    updateOrderFulfillment({ orderId: order.orderId, status: "delivered", actor: "seed-toner-demo" });
    if (credit && o.payDay != null) {
      const rem = payments().find((p) => p.kind === "remaining" && p.status === "pending");
      if (rem) confirmPayment({ paymentId: rem.paymentId, actor: "seed-toner-demo" });
    }
  }

  if (o.replacementQty > 0 && delivered) {
    const first = o.lines[0];
    const replDraft = buildDropshipDraft({
      orderId: order.orderId,
      shipTo,
      lines: [{ item: catalog.get(first.sku), qty: o.replacementQty }],
      notes: "เปลี่ยนตลับเคลม (ตลับพิมพ์ไม่ผ่าน)",
      pricing,
    });
    const r = createDropshipOrder(replDraft, "seed-toner-demo", simDate(startDate, o.deliveryDay + 3));
    setDropshipStatus({ dropshipId: r.dropshipId, status: "sent", now: simDate(startDate, o.deliveryDay + 3) });
    if (o.deliveryDay + 5 <= endDay) {
      setDropshipStatus({ dropshipId: r.dropshipId, status: "shipped", trackingNo: `SIMRP${String(100000 + n)}`, carrier: "Flash", now: simDate(startDate, o.deliveryDay + 4) });
      setDropshipStatus({ dropshipId: r.dropshipId, status: "delivered", now: simDate(startDate, o.deliveryDay + 5) });
    }
  }

  // ---- Backdate everything this order created -----------------------------
  const orderAt = iso(o.orderDay, 10);
  const deliverAt = iso(Math.min(o.deliveryDay, endDay), 15);
  const payAt = o.payDay != null ? iso(credit ? o.payDay : o.orderDay, credit ? 11 : 12) : null;
  const lastAt = payAt && delivered && payAt > deliverAt ? payAt : delivered ? deliverAt : orderAt;
  const dueDate = credit && delivered ? ymd(o.deliveryDay + o.creditDays) : null;

  stmt.quote.run(iso(o.orderDay - 1, 14), iso(o.orderDay - 1, 14), iso(o.orderDay - 1, 14), orderAt, quote.requestId);
  stmt.order.run(orderAt, lastAt, dueDate, order.orderId);

  const bundle = getOrderBundle(order.orderId);
  for (const p of bundle.payments) {
    const created = p.kind === "remaining" ? deliverAt : orderAt;
    stmt.payCreated.run(created, created, p.paymentId);
    if (p.status === "confirmed") {
      const confirmed = credit ? payAt ?? deliverAt : iso(o.orderDay, 12);
      stmt.payConfirmed.run(confirmed, confirmed, p.paymentId);
    }
  }
  for (const d of bundle.documents) {
    let at = orderAt;
    if (d.documentType === "balance_invoice" || d.documentType === "tax_invoice") at = credit ? deliverAt : deliverAt;
    if (d.documentType === "receipt") at = credit ? payAt ?? deliverAt : deliverAt;
    if (d.documentType === "deposit_invoice") at = orderAt;
    stmt.doc.run(at, at, d.documentId);
  }
  for (const e of stmt.events.all(order.orderId)) {
    const at =
      e.event_type === "created"
        ? orderAt
        : e.event_type.startsWith("payment")
          ? credit ? payAt ?? deliverAt : iso(o.orderDay, 12)
          : deliverAt;
    stmt.event.run(at, e.id);
  }
  for (const j of stmt.journals.all(order.orderId)) {
    let at = deliverAt;
    if (String(j.source_key).startsWith("cash:")) at = credit ? payAt ?? deliverAt : iso(o.orderDay, 12);
    stmt.journal.run(at.slice(0, 10), at, j.entry_id);
  }
  stmt.customer.run(orderAt, orderAt, CUSTOMER_TYPES[c.type].creditDays, c.email);

  n += 1;
  if (n % 50 === 0) console.log(`… ${n}/${sim.orders.length} orders`);
}

// Renumber billing documents so PREFIX-YYMM (Buddhist era) matches the backdated issue month.
{
  const bePeriod = (isoAt) => {
    const d = new Date(Date.parse(isoAt) + 7 * 3_600_000);
    return `${d.getUTCFullYear() + 543}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const docs = db.prepare("SELECT id, document_id, issued_at FROM billing_documents ORDER BY issued_at, id").all();
  const seq = new Map();
  const renames = docs.map((d) => {
    const prefix = String(d.document_id).split("-")[0];
    const period = bePeriod(d.issued_at);
    const key = `${prefix}|${period}`;
    const next = (seq.get(key) ?? 0) + 1;
    seq.set(key, next);
    return { id: d.id, documentId: `${prefix}-${period.slice(2)}-${String(next).padStart(4, "0")}` };
  });
  db.exec("BEGIN");
  const tmp = db.prepare("UPDATE billing_documents SET document_id = 'TMP-' || id WHERE id = ?");
  const set = db.prepare("UPDATE billing_documents SET document_id = ? WHERE id = ?");
  for (const r of renames) tmp.run(r.id);
  for (const r of renames) set.run(r.documentId, r.id);
  db.exec("DELETE FROM document_sequences");
  const ins = db.prepare("INSERT INTO document_sequences (kind, period, last_value) VALUES (?, ?, ?)");
  for (const [key, last] of seq) {
    const [kind, period] = key.split("|");
    ins.run(kind, period, last);
  }
  db.exec("COMMIT");
}

const t = sim.totals;
console.log(
  [
    `seeded ${n} orders for ${sim.customers.length} simulated customers into ${process.env.SQLITE_PATH}`,
    `revenue ex VAT ${Math.round(t.revenueExVat).toLocaleString("en-US")} · cartridges ${t.cartridges} · receivable ${t.receivableEndIncVat.toLocaleString("en-US")}`,
    "open /ops/receivables, /ops/dropship, /ops/orders, /ops/finance to explore",
  ].join("\n"),
);
closeDb();
