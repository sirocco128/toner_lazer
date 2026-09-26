import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

function resolveProjectRoot(): string {
  if (process.env.PROJECT_ROOT && existsSync(join(process.env.PROJECT_ROOT, "package.json"))) {
    return process.env.PROJECT_ROOT;
  }
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = join(dir, "..");
  }
  return join(__dirname, "..");
}

const ROOT = resolveProjectRoot();

describe("migration-idempotent (§31 required)", () => {
  it("second migrate applies 0 new files and keeps quote_requests + customers schema", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "giftset-migrate-"));
    const sqlitePath = join(dataDir, "leads.sqlite");

    try {
      const first = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
        cwd: ROOT,
        env: { ...process.env, SQLITE_PATH: sqlitePath },
        encoding: "utf8",
      });
      assert.equal(first.status, 0, first.stderr || first.stdout);
      assert.match(first.stdout, /Applied \d+ new file/);

      const second = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
        cwd: ROOT,
        env: { ...process.env, SQLITE_PATH: sqlitePath },
        encoding: "utf8",
      });
      assert.equal(second.status, 0, second.stderr || second.stdout);
      assert.match(second.stdout, /Applied 0 new file/);
      assert.match(second.stdout, /skip\s+001_create_quote_requests\.sql/);
      assert.match(second.stdout, /skip\s+002_customers_and_lead_workflow\.sql/);
      assert.match(second.stdout, /skip\s+004_page_seo_overrides\.sql/);
      assert.match(second.stdout, /skip\s+003_ops_roles_and_audit\.sql/);
      assert.match(second.stdout, /skip\s+005_orders_payments_billing\.sql/);
      assert.match(second.stdout, /skip\s+006_customer_crm_depth\.sql/);
      assert.match(second.stdout, /skip\s+007_customer_contacts_merge\.sql/);
      assert.match(second.stdout, /skip\s+008_customer_line_oa\.sql/);
      assert.match(second.stdout, /skip\s+009_factory_po_and_ledger\.sql/);
      assert.match(second.stdout, /skip\s+010_goods_receipts_claims_assets\.sql/);
      assert.match(second.stdout, /skip\s+011_catalog_source_images\.sql/);
      assert.match(second.stdout, /skip\s+012_payment_slips\.sql/);
      assert.match(second.stdout, /skip\s+013_payment_reject_reason\.sql/);
      assert.match(second.stdout, /skip\s+014_ops_entity_tags\.sql/);
      assert.match(second.stdout, /skip\s+015_ops_staff\.sql/);
      assert.match(second.stdout, /skip\s+016_quote_sales_timeline\.sql/);
      assert.match(second.stdout, /skip\s+017_factory_po_currency\.sql/);
      assert.match(second.stdout, /skip\s+018_ops_price_batches\.sql/);
      assert.match(second.stdout, /skip\s+019_quote_billing_branch\.sql/);
      assert.match(second.stdout, /skip\s+020_coa_books_accountant\.sql/);
      assert.match(second.stdout, /skip\s+021_factory_registry\.sql/);
      assert.match(second.stdout, /skip\s+022_ops_audit_context\.sql/);
      assert.match(second.stdout, /skip\s+023_object_legal_holds\.sql/);
      assert.match(second.stdout, /skip\s+024_catalog_albums\.sql/);
      assert.match(second.stdout, /skip\s+025_contact_inquiries\.sql/);
      assert.match(second.stdout, /skip\s+026_schedule\.sql/);
      assert.match(second.stdout, /skip\s+027_partner_api_keys\.sql/);

      const db = new DatabaseSync(sqlitePath);
      try {
        const columns = db
          .prepare("PRAGMA table_info(quote_requests)")
          .all() as Array<{ name: string }>;
        assert.equal(columns.length, 38);
        const names = new Set(columns.map((c) => c.name));
        assert.ok(names.has("customer_id"));
        assert.ok(names.has("sales_notes"));
        assert.ok(names.has("billing_branch"));

        const customers = db
          .prepare("PRAGMA table_info(customers)")
          .all() as Array<{ name: string }>;
        assert.ok(customers.length >= 10);

        const seoCols = db
          .prepare("PRAGMA table_info(page_seo_overrides)")
          .all() as Array<{ name: string }>;
        const seoNames = new Set(seoCols.map((c) => c.name));
        assert.ok(seoNames.has("path"));
        assert.ok(seoNames.has("seo_title"));
        assert.ok(seoNames.has("meta_description"));

        const audit = db
          .prepare("PRAGMA table_info(ops_audit_log)")
          .all() as Array<{ name: string }>;
        assert.ok(audit.length >= 10);
        const auditNames = new Set(audit.map((c) => c.name));
        assert.ok(auditNames.has("ip_address"));
        assert.ok(auditNames.has("geo_label"));
        assert.ok(auditNames.has("device_label"));
        assert.ok(auditNames.has("machine_hint"));
        assert.ok(auditNames.has("impact"));
        assert.ok(auditNames.has("report_name"));
        assert.ok(auditNames.has("report_filters"));

        const orders = db
          .prepare("PRAGMA table_info(orders)")
          .all() as Array<{ name: string }>;
        assert.ok(orders.length >= 20);
        const orderNames = new Set(orders.map((c) => c.name));
        assert.ok(orderNames.has("vat_amount"));
        assert.ok(orderNames.has("deposit_amount"));
        assert.ok(orderNames.has("ship_to_province"));
        assert.ok(orderNames.has("tags"));

        const customerNames = new Set(
          customers.map((c: { name: string }) => c.name),
        );
        assert.ok(customerNames.has("tax_id"));
        assert.ok(customerNames.has("line_id"));
        assert.ok(customerNames.has("merged_into_id"));

        const albums = db
          .prepare("PRAGMA table_info(catalog_albums)")
          .all() as Array<{ name: string }>;
        const albumNames = new Set(albums.map((c) => c.name));
        assert.ok(albumNames.has("album_id"));
        assert.ok(albumNames.has("snapshot_json"));
        const albumFiles = db
          .prepare("PRAGMA table_info(catalog_album_files)")
          .all() as Array<{ name: string }>;
        assert.ok(albumFiles.some((c) => c.name === "group_slug"));

        const contacts = db
          .prepare("PRAGMA table_info(customer_contacts)")
          .all() as Array<{ name: string }>;
        const contactNames = new Set(contacts.map((c) => c.name));
        assert.ok(contactNames.has("email"));
        assert.ok(contactNames.has("line_user_id"));

        const payments = db
          .prepare("PRAGMA table_info(payments)")
          .all() as Array<{ name: string }>;
        assert.ok(payments.length >= 10);

        const factoryPos = db
          .prepare("PRAGMA table_info(factory_pos)")
          .all() as Array<{ name: string }>;
        const poNames = new Set(factoryPos.map((c) => c.name));
        assert.ok(poNames.has("landed_total_thb"));
        assert.ok(poNames.has("last_mile_thb"));
        assert.ok(poNames.has("destination_mode"));
        assert.ok(poNames.has("received_qty"));
        assert.ok(poNames.has("factory_currency"));
        assert.ok(poNames.has("factory_id"));

        const factories = db
          .prepare("PRAGMA table_info(factories)")
          .all() as Array<{ name: string }>;
        const factoryNames = new Set(factories.map((c) => c.name));
        assert.ok(factoryNames.has("factory_code"));
        assert.ok(factoryNames.has("wechat"));
        assert.ok(factoryNames.has("status"));

        const goodsReceipts = db
          .prepare("PRAGMA table_info(goods_receipts)")
          .all() as Array<{ name: string }>;
        const grNames = new Set(goodsReceipts.map((c) => c.name));
        assert.ok(grNames.has("destination"));
        assert.ok(grNames.has("amount_thb"));

        const journals = db
          .prepare("PRAGMA table_info(journal_entries)")
          .all() as Array<{ name: string }>;
        const jeNames = new Set(journals.map((c) => c.name));
        assert.ok(jeNames.has("source_key"));
        assert.ok(jeNames.has("book_type"));

        const catalogImages = db
          .prepare("PRAGMA table_info(catalog_source_images)")
          .all() as Array<{ name: string }>;
        const catalogNames = new Set(catalogImages.map((c) => c.name));
        assert.ok(catalogNames.has("image_id"));
        assert.ok(catalogNames.has("source_page_url"));
        assert.ok(catalogNames.has("source_image_url"));
        assert.ok(catalogNames.has("local_path"));

        const slips = db
          .prepare("PRAGMA table_info(payment_slips)")
          .all() as Array<{ name: string }>;
        const slipNames = new Set(slips.map((c) => c.name));
        assert.ok(slipNames.has("slip_id"));
        assert.ok(slipNames.has("check_status"));
        const cashCols = db
          .prepare("PRAGMA table_info(cash_receipts)")
          .all() as Array<{ name: string }>;
        assert.ok(cashCols.some((c) => c.name === "access_token"));
        assert.ok(cashCols.some((c) => c.name === "tags"));
        const tagLinks = db
          .prepare("PRAGMA table_info(ops_tag_links)")
          .all() as Array<{ name: string }>;
        const tagLinkNames = new Set(tagLinks.map((c) => c.name));
        assert.ok(tagLinkNames.has("tag"));
        assert.ok(tagLinkNames.has("entity_type"));
        assert.ok(tagLinkNames.has("entity_id"));

        const staff = db
          .prepare("PRAGMA table_info(ops_staff)")
          .all() as Array<{ name: string }>;
        const staffNames = new Set(staff.map((c) => c.name));
        assert.ok(staffNames.has("email"));
        assert.ok(staffNames.has("password_hash"));
        assert.ok(staffNames.has("extra_grants"));
        assert.ok(staffNames.has("extra_denies"));
        assert.ok(staffNames.has("booking_slug"));

        const scheduleEvents = db
          .prepare("PRAGMA table_info(schedule_events)")
          .all() as Array<{ name: string }>;
        const scheduleNames = new Set(scheduleEvents.map((c) => c.name));
        assert.ok(scheduleNames.has("id"));
        assert.ok(scheduleNames.has("kind"));
        assert.ok(scheduleNames.has("starts_at"));
        assert.ok(scheduleNames.has("host_email"));
        const scheduleAttendees = db
          .prepare("PRAGMA table_info(schedule_attendees)")
          .all() as Array<{ name: string }>;
        assert.ok(scheduleAttendees.some((c) => c.name === "event_id"));
        assert.ok(scheduleAttendees.some((c) => c.name === "notify"));
        const scheduleAvail = db
          .prepare("PRAGMA table_info(schedule_availability)")
          .all() as Array<{ name: string }>;
        assert.ok(scheduleAvail.some((c) => c.name === "staff_email"));
        assert.ok(scheduleAvail.some((c) => c.name === "start_minute"));

        const timeline = db
          .prepare("PRAGMA table_info(quote_sales_timeline)")
          .all() as Array<{ name: string }>;
        const timelineNames = new Set(timeline.map((c) => c.name));
        assert.ok(timelineNames.has("request_id"));
        assert.ok(timelineNames.has("from_status"));
        assert.ok(timelineNames.has("to_status"));
        assert.ok(timelineNames.has("note"));
        assert.ok(timelineNames.has("actor_name"));

        const priceConfigs = db
          .prepare("PRAGMA table_info(ops_price_configs)")
          .all() as Array<{ name: string }>;
        const priceConfigNames = new Set(priceConfigs.map((c) => c.name));
        assert.ok(priceConfigNames.has("payload_json"));
        const priceBatches = db
          .prepare("PRAGMA table_info(ops_price_batches)")
          .all() as Array<{ name: string }>;
        const priceBatchNames = new Set(priceBatches.map((c) => c.name));
        assert.ok(priceBatchNames.has("payload_json"));
        assert.ok(priceBatchNames.has("status"));

        const holds = db
          .prepare("PRAGMA table_info(object_legal_holds)")
          .all() as Array<{ name: string }>;
        const holdNames = new Set(holds.map((c) => c.name));
        assert.ok(holdNames.has("object_key"));
        assert.ok(holdNames.has("held_by_email"));
        assert.ok(holdNames.has("released_at"));
        assert.ok(holdNames.has("release_reason"));

        const inquiries = db
          .prepare("PRAGMA table_info(contact_inquiries)")
          .all() as Array<{ name: string }>;
        const inquiryNames = new Set(inquiries.map((c) => c.name));
        assert.ok(inquiryNames.has("inquiry_id"));
        assert.ok(inquiryNames.has("topic"));
        assert.ok(inquiryNames.has("callback_channel"));
        assert.ok(inquiryNames.has("mail_status"));

        const partnerKeys = db
          .prepare("PRAGMA table_info(partner_api_keys)")
          .all() as Array<{ name: string }>;
        const partnerNames = new Set(partnerKeys.map((c) => c.name));
        assert.ok(partnerNames.has("key_id"));
        assert.ok(partnerNames.has("secret_hash"));
        assert.ok(partnerNames.has("scopes_json"));
        assert.ok(partnerNames.has("revoked_at"));
      } finally {
        db.close();
      }
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
