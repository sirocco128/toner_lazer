import { getDb } from "@/lib/database";
import {
  CONTACT_CALLBACK_CHANNELS,
  CONTACT_INQUIRY_STATUSES,
  CONTACT_MAIL_STATUSES,
  CONTACT_TOPICS,
  type ContactCallbackChannel,
  type ContactInquiryRecord,
  type ContactInquiryStatus,
  type ContactMailStatus,
  type ContactTopic,
} from "@/lib/contact-inquiry-types";

type InquiryRow = {
  id: number;
  inquiry_id: string;
  submitted_at: string;
  topic: string;
  name: string;
  company: string | null;
  email: string;
  phone: string;
  callback_channel: string;
  message: string;
  consent_at: string;
  status: string;
  mail_status: string;
  mail_error: string | null;
  mail_sent_at: string | null;
  ip_hash: string;
  user_agent: string | null;
  landing_path: string | null;
  created_at: string;
  updated_at: string;
};

function asTopic(value: string): ContactTopic {
  return (CONTACT_TOPICS as readonly string[]).includes(value)
    ? (value as ContactTopic)
    : "other";
}

function asChannel(value: string): ContactCallbackChannel {
  return (CONTACT_CALLBACK_CHANNELS as readonly string[]).includes(value)
    ? (value as ContactCallbackChannel)
    : "email";
}

function asStatus(value: string): ContactInquiryStatus {
  return (CONTACT_INQUIRY_STATUSES as readonly string[]).includes(value)
    ? (value as ContactInquiryStatus)
    : "new";
}

function asMailStatus(value: string): ContactMailStatus {
  return (CONTACT_MAIL_STATUSES as readonly string[]).includes(value)
    ? (value as ContactMailStatus)
    : "pending";
}

function mapRow(row: InquiryRow): ContactInquiryRecord {
  return {
    id: row.id,
    inquiryId: row.inquiry_id,
    submittedAt: row.submitted_at,
    topic: asTopic(row.topic),
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    callbackChannel: asChannel(row.callback_channel),
    message: row.message,
    consentAt: row.consent_at,
    status: asStatus(row.status),
    mailStatus: asMailStatus(row.mail_status),
    mailError: row.mail_error,
    mailSentAt: row.mail_sent_at,
    ipHash: row.ip_hash,
    userAgent: row.user_agent,
    landingPath: row.landing_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type InsertContactInquiryParams = {
  inquiryId: string;
  submittedAt: string;
  topic: ContactTopic;
  name: string;
  company?: string | null;
  email: string;
  phone: string;
  callbackChannel: ContactCallbackChannel;
  message: string;
  consentAt: string;
  mailStatus: ContactMailStatus;
  mailError?: string | null;
  mailSentAt?: string | null;
  ipHash: string;
  userAgent?: string | null;
  landingPath?: string | null;
};

export type ListContactInquiriesOptions = {
  q?: string;
  status?: ContactInquiryStatus | "all";
  topic?: ContactTopic | "all";
  limit?: number;
  offset?: number;
};

export function insertContactInquiry(
  params: InsertContactInquiryParams,
): ContactInquiryRecord {
  const now = params.submittedAt;
  getDb()
    .prepare(
      `INSERT INTO contact_inquiries (
         inquiry_id, submitted_at, topic, name, company, email, phone,
         callback_channel, message, consent_at, status, mail_status, mail_error,
         mail_sent_at, ip_hash, user_agent, landing_path, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.inquiryId,
      params.submittedAt,
      params.topic,
      params.name,
      params.company || null,
      params.email,
      params.phone,
      params.callbackChannel,
      params.message,
      params.consentAt,
      params.mailStatus,
      params.mailError || null,
      params.mailSentAt || null,
      params.ipHash,
      params.userAgent || null,
      params.landingPath || null,
      now,
      now,
    );
  const created = getContactInquiryById(params.inquiryId);
  if (!created) throw new Error("contact inquiry insert failed");
  return created;
}

export function getContactInquiryById(
  inquiryId: string,
): ContactInquiryRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM contact_inquiries WHERE inquiry_id = ?`)
    .get(inquiryId) as InquiryRow | undefined;
  return row ? mapRow(row) : null;
}

function searchClause(q?: string): { sql: string; args: string[] } {
  const needle = (q || "").trim();
  if (!needle) return { sql: "", args: [] };
  const like = `%${needle}%`;
  return {
    sql: ` AND (inquiry_id LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ? OR company LIKE ? OR message LIKE ?)`,
    args: [like, like, like, like, like, like],
  };
}

export function listContactInquiries(
  options: ListContactInquiriesOptions = {},
): ContactInquiryRecord[] {
  const status = options.status && options.status !== "all" ? options.status : null;
  const topic = options.topic && options.topic !== "all" ? options.topic : null;
  const search = searchClause(options.q);
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const args: (string | number)[] = [];
  let sql = `SELECT * FROM contact_inquiries WHERE 1=1`;
  if (status) {
    sql += ` AND status = ?`;
    args.push(status);
  }
  if (topic) {
    sql += ` AND topic = ?`;
    args.push(topic);
  }
  sql += search.sql;
  args.push(...search.args);
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  args.push(limit, offset);
  const rows = getDb().prepare(sql).all(...args) as InquiryRow[];
  return rows.map(mapRow);
}

export function countContactInquiries(
  options: Omit<ListContactInquiriesOptions, "limit" | "offset"> = {},
): number {
  const status = options.status && options.status !== "all" ? options.status : null;
  const topic = options.topic && options.topic !== "all" ? options.topic : null;
  const search = searchClause(options.q);
  const args: (string | number)[] = [];
  let sql = `SELECT COUNT(*) AS n FROM contact_inquiries WHERE 1=1`;
  if (status) {
    sql += ` AND status = ?`;
    args.push(status);
  }
  if (topic) {
    sql += ` AND topic = ?`;
    args.push(topic);
  }
  sql += search.sql;
  args.push(...search.args);
  const row = getDb().prepare(sql).get(...args) as { n: number } | undefined;
  return Number(row?.n || 0);
}

export function updateContactInquiryStatus(
  inquiryId: string,
  status: ContactInquiryStatus,
): ContactInquiryRecord | null {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE contact_inquiries SET status = ?, updated_at = ? WHERE inquiry_id = ?`,
    )
    .run(status, now, inquiryId);
  return getContactInquiryById(inquiryId);
}
