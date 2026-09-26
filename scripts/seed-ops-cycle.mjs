/**
 * Idempotent ops-cycle sample for local testing.
 * Rows use DEMO- ids and demo-cycle-*@example.test.
 */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new DatabaseSync(path.join(root, ".data", "leads.sqlite"));
const now = new Date();

function iso(daysAgo) {
  return new Date(now.getTime() - daysAgo * 86400000).toISOString();
}
function day(daysAgo) {
  return iso(daysAgo).slice(0, 10);
}
function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
function money(qty, unitExVat) {
  const subtotal = Math.round(qty * unitExVat * 100) / 100;
  const vat = Math.round(subtotal * 0.07 * 100) / 100;
  const total = Math.round((subtotal + vat) * 100) / 100;
  const deposit = Math.round(total * 0.5 * 100) / 100;
  const remaining = Math.round((total - deposit) * 100) / 100;
  return { subtotal, vat, total, deposit, remaining };
}

const factories = [
  ["DEMO-YW-CUP", "อี้อู ถ้วยและกระบอกเก็บอุณหภูมิ", "义乌保温杯厂", "1688", "yiwu", "Yiwu", "หลี่ เหว่ย", "yiwu-cup-demo", "+86-13000001001", "CNY", 18, "active", "กระบอกสกรีนขั้นต่ำ 50 ใบ"],
  ["DEMO-GZ-BAG", "กว่างโจว กระเป๋าผ้าและถุงของขวัญ", "广州帆布袋厂", "factory_direct", "guangzhou_shenzhen", "Guangzhou", "เฉิน หมิ่น", "gz-bag-demo", "+86-13000001002", "CNY", 21, "active", "ถุงผ้าสกรีนขั้นต่ำ 100 ใบ"],
  ["DEMO-SZ-TECH", "เซินเจิ้น อุปกรณ์ไอที", "深圳电子礼品厂", "alibaba", "guangzhou_shenzhen", "Shenzhen", "หวัง เจีย", "sz-tech-demo", "+86-13000001003", "USD", 25, "active", "พาวเวอร์แบงก์สกรีนขั้นต่ำ 50 ชิ้น"],
  ["DEMO-YW-PACK", "อี้อู กล่องและบรรจุภัณฑ์", "义乌包装厂", "1688", "yiwu", "Yiwu", "จ้าว หลิน", "yiwu-pack-demo", "+86-13000001004", "CNY", 14, "active", "กล่องพิมพ์สีขั้นต่ำ 200 ใบ"],
  ["DEMO-GZ-TEXTILE", "กว่างโจว สิ่งทอและเสื้อ", "广州服饰厂", "factory_direct", "guangzhou_shenzhen", "Guangzhou", "หลิว หยาน", "gz-textile-demo", "+86-13000001005", "CNY", 30, "paused", "เสื้อโปโลปักขั้นต่ำ 50 ตัว"],
  ["DEMO-BLOCKED", "โรงงานทดสอบที่ระงับ", "停用工厂", "other", "yiwu", "Yiwu", "ทดสอบ", "blocked-demo", "+86-13000001006", "CNY", null, "blocked", "ห้ามเปิดใบสั่งใหม่"],
];

const customers = [
  ["siam", "บริษัท สยามเวิร์คเพลส จำกัด", "คุณมาลี ตั้งตรง", "0800001001", "กรุงเทพมหานคร", "0100000001001"],
  ["napa", "บริษัท นภา อีเวนต์ จำกัด", "คุณนภา แสงดี", "0800001002", "เชียงใหม่", "0100000001002"],
  ["green", "บริษัท กรีนออฟฟิศ จำกัด", "คุณกรีน ใจดี", "0800001003", "ขอนแก่น", "0100000001003"],
  ["tech", "บริษัท เทคคิท จำกัด", "คุณเทพ คิตติ", "0800001004", "ชลบุรี", "0100000001004"],
  ["season", "บริษัท ซีซันกิฟต์ จำกัด", "คุณซีซัน ของขวัญ", "0800001005", "ภูเก็ต", "0100000001005"],
  ["north", "บริษัท นอร์ทเทรนนิ่ง จำกัด", "คุณเหนือ ฝึกงาน", "0800001006", "เชียงราย", "0100000001006"],
  ["river", "บริษัท ริเวอร์มาร์เก็ต จำกัด", "คุณริเวอร์ ตลาด", "0800001007", "นนทบุรี", "0100000001007"],
  ["campus", "มูลนิธิแคมปัสทดสอบ", "คุณแคมปัส เรียน", "0800001008", "นครปฐม", "0990000001008"],
];

function clearDemo() {
  db.exec(`
    DELETE FROM journal_lines WHERE entry_id LIKE 'DEMO-JE-%';
    DELETE FROM journal_entries WHERE entry_id LIKE 'DEMO-JE-%';
    DELETE FROM payment_slips WHERE slip_id LIKE 'DEMO-SLIP-%';
    DELETE FROM supplier_payments WHERE pay_id LIKE 'DEMO-SP-%';
    DELETE FROM goods_receipts WHERE receipt_id LIKE 'DEMO-GR-%';
    DELETE FROM claims WHERE claim_id LIKE 'DEMO-CL-%';
    DELETE FROM issue_tickets WHERE issue_id LIKE 'DEMO-IS-%';
    DELETE FROM assets WHERE asset_code LIKE 'DEMO-AS-%';
    DELETE FROM wms_movements WHERE movement_key LIKE 'DEMO-MV-%';
    DELETE FROM wms_reservations WHERE reservation_id LIKE 'DEMO-RSV-%';
    DELETE FROM wms_balances WHERE product_key = 'DEMO-CUP';
    DELETE FROM billing_documents WHERE document_id LIKE 'DEMO-DOC-%';
    DELETE FROM payments WHERE payment_id LIKE 'DEMO-PAY-%';
    DELETE FROM order_events WHERE order_id LIKE 'DEMO-O-%';
    DELETE FROM factory_pos WHERE po_id LIKE 'DEMO-PO-%';
    DELETE FROM orders WHERE order_id LIKE 'DEMO-O-%';
    DELETE FROM quote_sales_timeline WHERE request_id LIKE 'DEMO-Q-%';
    DELETE FROM quote_requests WHERE request_id LIKE 'DEMO-Q-%';
    DELETE FROM contact_inquiries WHERE inquiry_id LIKE 'DEMO-INQ-%';
    DELETE FROM customers WHERE email LIKE 'demo-cycle-%@example.test';
    DELETE FROM factories WHERE factory_code LIKE 'DEMO-%';
  `);
}

db.exec("BEGIN");
try {
  clearDemo();
  const factoryStmt = db.prepare(`
    INSERT INTO factories (
      factory_code, name, name_cn, legal_name, platform, origin, city, address,
      contact_name, wechat, phone, default_currency, payment_terms, moq_notes,
      lead_days, qc_notes, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of factories) {
    factoryStmt.run(
      row[0], row[1], row[2], row[1], row[3], row[4], row[5],
      `${row[5]} industrial sample`, row[6], row[7], row[8], row[9],
      "มัดจำก่อนผลิต ส่วนที่เหลือก่อนออกจากจีน", row[12], row[10],
      "ตรวจสกรีนโลโก้ก่อนแพ็ก", row[11],
      "ข้อมูลทดสอบวงจรงาน", iso(60), iso(1),
    );
  }
  const factoryId = (code) =>
    db.prepare(`SELECT id FROM factories WHERE factory_code = ?`).get(code).id;

  const customerStmt = db.prepare(`
    INSERT INTO customers (
      company, email, phone, contact_name, notes, status, quote_count,
      created_at, updated_at, tax_id, billing_name, billing_address,
      billing_branch, customer_type, source, tags, default_ship_province,
      order_count
    ) VALUES (?, ?, ?, ?, 'ลูกค้าทดสอบวงจรงาน', 'active', 0, ?, ?, ?, ?, ?, 'สำนักงานใหญ่', 'company', 'web_rfq', 'demo-cycle', ?, 0)
  `);
  const customerIds = new Map();
  for (const row of customers) {
    const result = customerStmt.run(
      row[1], `demo-cycle-${row[0]}@example.test`, row[3], row[2],
      iso(50), iso(1), row[5], row[1], `99/1 ถนนทดสอบ ${row[4]}`, row[4],
    );
    customerIds.set(row[0], Number(result.lastInsertRowid));
  }
  const customerOf = (key) => customers.find((row) => row[0] === key);

  const quoteStmt = db.prepare(`
    INSERT INTO quote_requests (
      request_id, submitted_at, name, company, email, phone, quantity,
      needed_date, province, product_interest, product_slug, decoration_method,
      detail, consent_at, landing_path, utm_source, utm_medium, utm_campaign,
      ip_hash, user_agent, lead_status, webhook_status, webhook_attempt_count,
      raw_payload, created_at, updated_at, customer_id, sales_notes, billing_branch
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '/contact', 'demo', 'seed', 'ops-cycle', ?, 'seed-ops-cycle', ?, 'skipped', 0, ?, ?, ?, ?, 'ข้อมูลทดสอบวงจรงาน', 'สำนักงานใหญ่')
  `);
  const timelineStmt = db.prepare(`
    INSERT INTO quote_sales_timeline (
      request_id, created_at, actor_email, actor_name, actor_role,
      from_status, to_status, note
    ) VALUES (?, ?, 'seed@example.test', 'ชุดทดสอบ', 'admin', NULL, ?, 'ข้อมูลทดสอบวงจรงาน')
  `);
  const openQuotes = [
    ["DEMO-Q-NEW", "new", "siam", 80, "tumbler-notebook-pen-set", "screen-print", "กระบอกน้ำพนักงานใหม่", 1],
    ["DEMO-Q-CONTACT", "contacted", "napa", 120, "eco-tote-bamboo-set", "full-color", "ถุงผ้างานอีเวนต์", 3],
    ["DEMO-Q-QUOTED", "quoted", "green", 60, "it-powerbank-set", "laser", "พาวเวอร์แบงก์เลเซอร์โลโก้", 5],
    ["DEMO-Q-LOST", "lost", "season", 40, "tumbler-notebook-pen-set", "embroidery", "งบไม่พอในปีนี้", 12],
    ["DEMO-Q-ARCHIVED", "archived", "campus", 30, "eco-tote-bamboo-set", "not-sure", "เก็บไว้รอบหน้า", 40],
  ];
  for (const row of openQuotes) {
    const customer = customerOf(row[2]);
    quoteStmt.run(
      row[0], iso(row[7]), customer[2], customer[1], `demo-cycle-${row[2]}@example.test`,
      customer[3], row[3], day(10), customer[4], row[4], row[4], row[5], row[6],
      iso(row[7]), hash(row[0]), row[1], JSON.stringify({ seed: row[0] }),
      iso(row[7]), iso(row[7]), customerIds.get(row[2]),
    );
    timelineStmt.run(row[0], iso(row[7]), row[1]);
  }

  const cycles = [
    ["DEMO-Q-WON-01", "DEMO-O-01", null, "river", "กระบอกสแตนเลส สกรีนโลโก้", "screen-print", 100, 189, "deposit_due", "reserved", null, "DEMO-YW-CUP", 2],
    ["DEMO-Q-WON-02", "DEMO-O-02", "DEMO-PO-02", "siam", "กระบอกสแตนเลส สกรีนโลโก้", "screen-print", 150, 179, "deposit_paid", "awaiting_production", "draft", "DEMO-YW-CUP", 6],
    ["DEMO-Q-WON-03", "DEMO-O-03", "DEMO-PO-03", "napa", "ถุงผ้าแคนวาส พิมพ์สี", "full-color", 200, 95, "deposit_paid", "producing", "sent", "DEMO-GZ-BAG", 9],
    ["DEMO-Q-WON-04", "DEMO-O-04", "DEMO-PO-04", "green", "ถุงผ้าแคนวาส สกรีน 1 สี", "screen-print", 300, 79, "deposit_paid", "producing", "confirmed", "DEMO-GZ-BAG", 12],
    ["DEMO-Q-WON-05", "DEMO-O-05", "DEMO-PO-05", "tech", "พาวเวอร์แบงก์ เลเซอร์โลโก้", "laser", 80, 320, "deposit_paid", "producing", "producing", "DEMO-SZ-TECH", 16],
    ["DEMO-Q-WON-06", "DEMO-O-06", "DEMO-PO-06", "north", "สมุดโน้ต ปั๊มนูนโลโก้", "emboss", 120, 145, "balance_due", "in_transit", "shipped", "DEMO-YW-PACK", 20],
    ["DEMO-Q-WON-07", "DEMO-O-07", "DEMO-PO-07", "season", "กล่องของขวัญ พิมพ์สี", "full-color", 100, 210, "balance_due", "inbound", "inbound", "DEMO-YW-PACK", 24],
    ["DEMO-Q-WON-08", "DEMO-O-08", "DEMO-PO-08", "campus", "กระบอกสแตนเลส พิมพ์ยูวี", "uv-print", 90, 199, "paid", "warehouse", "received", "DEMO-YW-CUP", 30],
    ["DEMO-Q-WON-09", "DEMO-O-09", "DEMO-PO-09", "siam", "เสื้อโปโล ปักโลโก้", "embroidery", 50, 390, "paid", "delivered", "received", "DEMO-GZ-TEXTILE", 45],
    ["DEMO-Q-WON-10", "DEMO-O-10", "DEMO-PO-10", "river", "ชุดของขวัญยกเลิก", "not-sure", 40, 150, "deposit_due", "cancelled", "cancelled", "DEMO-BLOCKED", 18],
  ];

  const orderStmt = db.prepare(`
    INSERT INTO orders (
      order_id, quote_request_id, customer_id, company, contact_name, email, phone,
      billing_name, billing_tax_id, billing_address, billing_branch, product_summary,
      quantity, currency, vat_rate, vat_mode, subtotal_ex_vat, vat_amount, total_amount,
      deposit_mode, deposit_percent, deposit_amount, remaining_amount, paid_amount,
      payment_status, fulfillment_status, access_token, notes, created_at, updated_at,
      ship_to_name, ship_to_phone, ship_to_address, ship_to_province, tags
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'สำนักงานใหญ่', ?, ?, 'THB', 7, 'exclusive',
      ?, ?, ?, 'percent', 50, ?, ?, ?, ?, ?, ?, 'ออเดอร์ทดสอบวงจรงาน', ?, ?,
      ?, ?, ?, ?, 'demo-cycle'
    )
  `);
  const payStmt = db.prepare(`
    INSERT INTO payments (
      payment_id, order_id, kind, amount, method, status, customer_reference,
      confirmed_at, confirmed_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'promptpay_qr', ?, ?, ?, ?, ?, ?)
  `);
  const docStmt = db.prepare(`
    INSERT INTO billing_documents (
      document_id, document_type, order_id, payment_id, status, subtotal_ex_vat,
      vat_amount, grand_total, amount_text, line_description, issued_at,
      buyer_name, buyer_tax_id, buyer_address, buyer_branch, created_at
    ) VALUES (?, ?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'สำนักงานใหญ่', ?)
  `);
  const poStmt = db.prepare(`
    INSERT INTO factory_pos (
      po_id, order_id, status, factory_name, factory_contact, factory_platform,
      product_name, quantity, color, material, decoration_method, logo_position,
      logo_notes, packaging_notes, qc_notes, fx_cny_thb, factory_unit_cny,
      factory_amount_cny, factory_thb, inland_thb, freight_thb, import_duty_thb,
      customs_fee_thb, packing_thb, last_mile_thb, landed_total_thb, freight_mode,
      tracking_cn, tracking_th, notes, created_at, updated_at, destination_mode,
      received_qty, factory_currency, factory_id, asn_eta, asn_qty, asn_container,
      receive_mode
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, 'ขาว', 'ตามแบบโรงงาน', ?, 'กลางชิ้น',
      'โลโก้ทดสอบ', 'กล่องลูกฟูก', 'สุ่มตรวจสกรีน', ?, ?,
      ?, ?, 800, 2200, 700, 350, 400, 600, ?, ?, ?, ?, 'ใบสั่งทดสอบวงจรงาน', ?, ?,
      'warehouse', ?, ?, ?, ?, ?, ?, 'stock'
    )
  `);

  for (const row of cycles) {
    const customer = customerOf(row[3]);
    const figures = money(row[6], row[7]);
    const email = `demo-cycle-${row[3]}@example.test`;
    const address = `99/1 ถนนทดสอบ ${customer[4]}`;
    quoteStmt.run(
      row[0], iso(row[12] + 2), customer[2], customer[1], email, customer[3],
      row[6], day(10), customer[4], row[4], "tumbler-notebook-pen-set", row[5],
      row[4], iso(row[12] + 2), hash(row[0]), "won", JSON.stringify({ seed: row[0] }),
      iso(row[12] + 2), iso(row[12]), customerIds.get(row[3]),
    );
    timelineStmt.run(row[0], iso(row[12]), "won");
    const paid = row[8] === "paid" ? figures.total : row[8] === "deposit_due" ? 0 : figures.deposit;
    orderStmt.run(
      row[1], row[0], customerIds.get(row[3]), customer[1], customer[2], email,
      customer[3], customer[1], customer[5], address, row[4], row[6],
      figures.subtotal, figures.vat, figures.total, figures.deposit,
      Math.round((figures.total - paid) * 100) / 100, paid, row[8], row[9],
      `demo-token-${row[1]}`, iso(row[12]), iso(row[12]), customer[2], customer[3],
      address, customer[4],
    );
    db.prepare(`INSERT INTO order_events (order_id, event_type, message, actor, created_at) VALUES (?, 'seed', ?, 'seed-ops-cycle', ?)`).run(
      row[1], `เปิดออเดอร์ทดสอบสถานะ ${row[9]}`, iso(row[12]),
    );
    if (row[8] !== "deposit_due") {
      payStmt.run(`DEMO-PAY-${row[1]}-DEP`, row[1], "deposit", figures.deposit, "confirmed", `DEP-${row[1]}`, iso(row[12] - 1), "seed-ops-cycle", iso(row[12]), iso(row[12] - 1));
      docStmt.run(`DEMO-DOC-${row[1]}-DEP`, "deposit_invoice", row[1], `DEMO-PAY-${row[1]}-DEP`, figures.deposit, 0, figures.deposit, `${figures.deposit} บาท`, `มัดจำ ${row[4]}`, iso(row[12]), customer[1], customer[5], address, iso(row[12]));
    }
    if (row[8] === "paid") {
      payStmt.run(`DEMO-PAY-${row[1]}-BAL`, row[1], "remaining", figures.remaining, "confirmed", `BAL-${row[1]}`, iso(row[12] - 4), "seed-ops-cycle", iso(row[12] - 3), iso(row[12] - 4));
      docStmt.run(`DEMO-DOC-${row[1]}-TAX`, "tax_invoice", row[1], `DEMO-PAY-${row[1]}-BAL`, figures.subtotal, figures.vat, figures.total, `${figures.total} บาท`, row[4], iso(row[12] - 3), customer[1], customer[5], address, iso(row[12] - 3));
    }
    if (row[8] === "balance_due") {
      payStmt.run(`DEMO-PAY-${row[1]}-BAL`, row[1], "remaining", figures.remaining, "submitted", `WAIT-${row[1]}`, null, null, iso(1), iso(1));
      db.prepare(`
        INSERT INTO payment_slips (
          slip_id, payment_id, file_path, content_type, byte_size, original_name,
          check_status, expected_amount, notes, created_at
        ) VALUES (?, ?, ?, 'text/plain', 32, ?, 'pending', ?, 'สลิปทดสอบ ยังไม่ใช่ไฟล์โอนจริง', ?)
      `).run(`DEMO-SLIP-${row[1]}`, `DEMO-PAY-${row[1]}-BAL`, `.data/demo-slips/${row[1]}.txt`, `${row[1]}.txt`, figures.remaining, iso(1));
    }
    if (!row[2]) continue;
    const factory = factories.find((item) => item[0] === row[11]);
    const fx = factory[9] === "USD" ? 36 : 5;
    const unitCny = factory[9] === "USD" ? 4.5 : 28;
    const amountCny = Math.round(row[6] * unitCny * 100) / 100;
    const factoryThb = Math.round(amountCny * fx * 100) / 100;
    const moving = ["shipped", "inbound", "received"].includes(row[10]);
    poStmt.run(
      row[2], row[1], row[10], factory[1], `${factory[6]} · ${factory[7]}`, factory[3],
      row[4], row[6], row[5], fx, unitCny, amountCny, factoryThb, factoryThb + 5050,
      moving ? "sea" : "truck",
      moving ? `CN${row[2].slice(-2)}DEMO` : null,
      row[10] === "received" ? `TH${row[2].slice(-2)}DEMO` : null,
      iso(row[12] - 1), iso(row[12] - 1),
      row[10] === "received" ? row[6] : 0,
      factory[9], factoryId(factory[0]),
      row[10] === "inbound" ? day(-7) : null,
      row[10] === "inbound" ? row[6] : null,
      row[10] === "inbound" ? `CONT-${row[2]}` : null,
    );
    if (row[10] === "received") {
      db.prepare(`
        INSERT INTO goods_receipts (
          receipt_id, po_id, order_id, destination, qty_ordered, qty_received,
          qty_damaged, qty_short, unit_thb, amount_thb, qc_notes, tracking_th,
          status, received_at, created_by, created_at
        ) VALUES (?, ?, ?, 'warehouse', ?, ?, 0, 0, ?, ?, 'รับครบ สกรีนตรงแบบ', ?, 'posted', ?, 'seed-ops-cycle', ?)
      `).run(`DEMO-GR-${row[1]}`, row[2], row[1], row[6], row[6], row[7], row[6] * row[7], `TH${row[2].slice(-2)}DEMO`, iso(row[12] - 5), iso(row[12] - 5));
      db.prepare(`
        INSERT INTO supplier_payments (
          pay_id, po_id, receipt_id, amount, method, status, paid_at, notes, created_by, created_at
        ) VALUES (?, ?, ?, ?, 'bank', 'posted', ?, 'จ่ายโรงงานหลังรับของทดสอบ', 'seed-ops-cycle', ?)
      `).run(`DEMO-SP-${row[1]}`, row[2], `DEMO-GR-${row[1]}`, factoryThb, iso(row[12] - 4), iso(row[12] - 4));
      db.prepare(`
        INSERT INTO assets (
          asset_code, kind, name, qty, unit, value_thb, location, po_id, order_id,
          receipt_id, status, notes, created_at, updated_at
        ) VALUES (?, 'inventory_lot', ?, ?, 'ชิ้น', ?, 'คลังไทย', ?, ?, ?, 'active', 'ล็อตทดสอบ', ?, ?)
      `).run(`DEMO-AS-${row[1]}`, row[4], row[6], row[6] * row[7], row[2], row[1], `DEMO-GR-${row[1]}`, iso(row[12] - 5), iso(1));
    }
  }

  db.prepare(`
    INSERT INTO claims (
      claim_id, against, po_id, order_id, receipt_id, issue_id, qty, amount_thb,
      reason, status, created_by, created_at, updated_at
    ) VALUES ('DEMO-CL-01', 'factory', 'DEMO-PO-08', 'DEMO-O-08', 'DEMO-GR-DEMO-O-08', 'DEMO-IS-01', 2, 398, 'สกรีนเอียง 2 ใบจากล็อตทดสอบ', 'open', 'seed-ops-cycle', ?, ?)
  `).run(iso(4), iso(1));
  db.prepare(`
    INSERT INTO issue_tickets (
      issue_id, source, company, contact_name, email, phone, order_id, po_id,
      category, title, detail, status, created_at, updated_at
    ) VALUES ('DEMO-IS-01', 'ops', 'มูลนิธิแคมปัสทดสอบ', 'คุณแคมปัส เรียน', 'demo-cycle-campus@example.test', '0800001008', 'DEMO-O-08', 'DEMO-PO-08', 'quality', 'สกรีนเอียงในล็อตทดสอบ', 'เปิดเคลมกับโรงงาน 2 ชิ้น', 'open', ?, ?)
  `).run(iso(4), iso(1));
  db.prepare(`
    INSERT INTO contact_inquiries (
      inquiry_id, submitted_at, topic, name, company, email, phone, callback_channel,
      message, consent_at, status, mail_status, ip_hash, user_agent, landing_path,
      created_at, updated_at
    ) VALUES ('DEMO-INQ-01', ?, 'quote', 'คุณทดสอบ ติดต่อ', 'บริษัท สยามเวิร์คเพลส จำกัด', 'demo-cycle-siam@example.test', '0800001001', 'phone', 'ขอให้โทรกลับเรื่องกระบอกสกรีนโลโก้', ?, 'new', 'skipped', ?, 'seed-ops-cycle', '/contact', ?, ?)
  `).run(iso(1), iso(1), hash("DEMO-INQ-01"), iso(1), iso(1));

  const bin = db.prepare(`SELECT id FROM wms_locations WHERE location_code = 'BIN-DEFAULT'`).get();
  if (bin) {
    db.prepare(`
      INSERT INTO wms_balances (product_key, location_id, qty_on_hand, qty_reserved, updated_at)
      VALUES ('DEMO-CUP', ?, 90, 20, ?)
    `).run(bin.id, iso(1));
    db.prepare(`
      INSERT INTO wms_movements (
        movement_key, kind, product_key, location_id, qty_delta, qty_reserved_delta,
        receipt_id, order_id, po_id, memo, actor, created_at
      ) VALUES ('DEMO-MV-01', 'receive', 'DEMO-CUP', ?, 90, 0, 'DEMO-GR-DEMO-O-08', 'DEMO-O-08', 'DEMO-PO-08', 'รับเข้าจากใบสั่งทดสอบ', 'seed-ops-cycle', ?)
    `).run(bin.id, iso(5));
    db.prepare(`
      INSERT INTO wms_reservations (
        reservation_id, order_id, product_key, location_id, qty, status, created_at, updated_at
      ) VALUES ('DEMO-RSV-01', 'DEMO-O-08', 'DEMO-CUP', ?, 20, 'open', ?, ?)
    `).run(bin.id, iso(2), iso(1));
  }

  const closed = money(50, 390);
  db.prepare(`
    INSERT INTO journal_entries (entry_id, source_key, entry_date, memo, order_id, po_id, posted_by, created_at)
    VALUES ('DEMO-JE-01', 'seed:DEMO-O-09', ?, 'ปิดออเดอร์ทดสอบที่ส่งแล้ว', 'DEMO-O-09', 'DEMO-PO-09', 'seed-ops-cycle', ?)
  `).run(day(3), iso(3));
  const line = db.prepare(`INSERT INTO journal_lines (entry_id, line_no, account_code, debit, credit, memo) VALUES ('DEMO-JE-01', ?, ?, ?, ?, ?)`);
  line.run(1, "1110", closed.total, 0, "รับชำระครบ");
  line.run(2, "4100", 0, closed.subtotal, "รายได้ขาย");
  line.run(3, "2120", 0, closed.vat, "ภาษีขาย");

  for (const [key] of customers) {
    const id = customerIds.get(key);
    const quotes = db.prepare(`SELECT COUNT(*) AS n, MAX(submitted_at) AS last_at FROM quote_requests WHERE customer_id = ?`).get(id);
    const orders = db.prepare(`SELECT COUNT(*) AS n, MAX(created_at) AS last_at FROM orders WHERE customer_id = ?`).get(id);
    db.prepare(`UPDATE customers SET quote_count = ?, last_quote_at = ?, order_count = ?, last_order_at = ? WHERE id = ?`).run(
      quotes.n, quotes.last_at, orders.n, orders.last_at, id,
    );
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

const summary = {
  factories: db.prepare(`SELECT COUNT(*) AS n FROM factories WHERE factory_code LIKE 'DEMO-%'`).get().n,
  customers: db.prepare(`SELECT COUNT(*) AS n FROM customers WHERE email LIKE 'demo-cycle-%@example.test'`).get().n,
  quotes: db.prepare(`SELECT COUNT(*) AS n FROM quote_requests WHERE request_id LIKE 'DEMO-Q-%'`).get().n,
  orders: db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE order_id LIKE 'DEMO-O-%'`).get().n,
  factoryPos: db.prepare(`SELECT COUNT(*) AS n FROM factory_pos WHERE po_id LIKE 'DEMO-PO-%'`).get().n,
  receipts: db.prepare(`SELECT COUNT(*) AS n FROM goods_receipts WHERE receipt_id LIKE 'DEMO-GR-%'`).get().n,
  payments: db.prepare(`SELECT COUNT(*) AS n FROM payments WHERE payment_id LIKE 'DEMO-PAY-%'`).get().n,
};
console.log(JSON.stringify(summary));
db.close();
