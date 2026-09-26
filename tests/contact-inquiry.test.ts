import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { closeDb } from "../lib/database";
import { teardownTempDir } from "./teardown-temp";

function resolveProjectRoot(): string {
  if (
    process.env.PROJECT_ROOT &&
    existsSync(join(process.env.PROJECT_ROOT, "package.json"))
  ) {
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

describe("contact inquiry mail copy", () => {
  it("thanks the customer and signs off with the company name", async () => {
    const prev = process.env.MAIL_SIGN_OFF;
    process.env.MAIL_SIGN_OFF = "เทราบิส";
    const { composeContactAutoReply, wantsEmailCallback } = await import(
      "../lib/contact-inquiry-mail"
    );
    const letter = composeContactAutoReply({
      name: "สมชาย",
      inquiryId: "CT-20260906-ABCDEF",
      topic: "complaint",
      callbackChannel: "email",
    });
    assert.match(letter.subject, /ได้รับข้อความของท่านแล้ว/);
    assert.match(letter.text, /ขอขอบคุณที่ลูกค้าติดต่อเข้ามา/);
    assert.match(letter.text, /จะรีบประสานงาน/);
    assert.match(letter.text, /เทราบิส/);
    assert.match(letter.text, /CT-20260906-ABCDEF/);
    assert.equal(wantsEmailCallback("email"), true);
    assert.equal(wantsEmailCallback("both"), true);
    assert.equal(wantsEmailCallback("phone"), false);
    if (prev) process.env.MAIL_SIGN_OFF = prev;
    else delete process.env.MAIL_SIGN_OFF;
  });

  it("uses Thai labels for mail status instead of raw English", async () => {
    const {
      CONTACT_MAIL_STATUS_LABELS,
      contactMailErrorLabel,
    } = await import("../lib/contact-inquiry-types");
    assert.equal(CONTACT_MAIL_STATUS_LABELS.sent, "ส่งแล้ว");
    assert.equal(CONTACT_MAIL_STATUS_LABELS.skipped, "ไม่ส่งจดหมาย");
    assert.equal(contactMailErrorLabel("not_configured"), "ยังไม่ได้ตั้งค่าจดหมายตอบรับ");
    assert.equal(contactMailErrorLabel("ECONNRESET"), "ส่งจดหมายไม่สำเร็จ");
  });
});

describe("gmail smtp config", () => {
  it("requires a gmail user and a 16-character app password", async () => {
    const prevUser = process.env.GMAIL_USER;
    const prevPass = process.env.GMAIL_APP_PASSWORD;
    process.env.GMAIL_USER = "ops@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    const { gmailAppPassword, isGmailSmtpConfigured } = await import(
      "../lib/gmail-smtp"
    );
    assert.equal(gmailAppPassword(), "abcdefghijklmnop");
    assert.equal(isGmailSmtpConfigured(), true);
    process.env.GMAIL_APP_PASSWORD = "short";
    assert.equal(isGmailSmtpConfigured(), false);
    if (prevUser) process.env.GMAIL_USER = prevUser;
    else delete process.env.GMAIL_USER;
    if (prevPass) process.env.GMAIL_APP_PASSWORD = prevPass;
    else delete process.env.GMAIL_APP_PASSWORD;
  });
});

describe("contact inquiry persistence", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-inquiry-"));
    sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    process.env.LEAD_STORAGE_MODE = "sqlite";
    process.env.IP_HASH_SECRET = "test-ip-hash-secret-at-least-32-chars!!";
    delete process.env.GMAIL_APP_PASSWORD;
    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: sqlitePath },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
    closeDb();
  });

  after(() => {
    teardownTempDir(dataDir);
  });

  it("stores an inquiry and skips mail when smtp is not configured", async () => {
    const { parseContactInquiryFormData } = await import(
      "../lib/contact-inquiry-schema"
    );
    const { submitContactInquiryPayload } = await import(
      "../lib/contact-inquiry-service"
    );
    const { getContactInquiryById } = await import(
      "../lib/contact-inquiry-repository"
    );
    const form = new FormData();
    form.set("topic", "inquiry");
    form.set("name", "สมชาย ใจดี");
    form.set("email", "somchai@acme.co.th");
    form.set("phone", "0812345678");
    form.set("callbackChannel", "email");
    form.set("message", "อยากสอบถามเรื่องระยะเวลาผลิตชุดของขวัญ");
    form.set("consent", "true");
    form.set("startedAt", String(Date.now() - 5_000));
    const parsed = parseContactInquiryFormData(form);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const result = await submitContactInquiryPayload(parsed.data, {
      headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      userAgent: "test",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.mailSent, false);
    assert.equal(result.mailStatus, "skipped");
    assert.match(result.inquiryId, /^CT-/);
    const row = getContactInquiryById(result.inquiryId);
    assert.ok(row);
    assert.equal(row?.topic, "inquiry");
    assert.equal(row?.mailStatus, "skipped");
  });
});
