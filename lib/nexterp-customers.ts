/**
 * NextERP MySQL customers (ops CRM shared with staging DB).
 */

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { nexterpExecute, nexterpQuery } from "@/lib/nexterp-mysql";
import type {
  CustomerRecord,
  CustomerStatus,
  ListCustomersOptions,
  UpdateCustomerParams,
  UpsertCustomerFromQuoteParams,
} from "@/lib/customer-types";

type CustomerRow = RowDataPacket & {
  id: number;
  company: string;
  email: string;
  phone: string | null;
  contact_name: string | null;
  notes: string | null;
  status: CustomerStatus;
  quote_count: number;
  last_quote_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function mapCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    company: row.company,
    email: row.email,
    phone: row.phone,
    contactName: row.contact_name,
    notes: row.notes,
    status: row.status,
    quoteCount: Number(row.quote_count || 0),
    lastQuoteAt: toIso(row.last_quote_at),
    lineId: null,
    taxId: null,
    billingName: null,
    billingAddress: null,
    billingBranch: "สำนักงานใหญ่",
    customerType: "company",
    source: "web_rfq",
    tags: [],
    defaultShipProvince: null,
    orderCount: 0,
    lastOrderAt: null,
    mergedIntoId: null,
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
  };
}

export async function upsertMysqlCustomerFromQuote(
  params: UpsertCustomerFromQuoteParams,
): Promise<CustomerRecord> {
  const email = params.email.trim().toLowerCase();
  await nexterpExecute(
    `INSERT INTO customers (
       company, email, phone, contact_name, status, quote_count, last_quote_at, source
     ) VALUES (
       :company, :email, :phone, :contactName, 'active', 1, :quotedAt, 'web_rfq'
     )
     ON DUPLICATE KEY UPDATE
       company = VALUES(company),
       phone = VALUES(phone),
       contact_name = VALUES(contact_name),
       quote_count = quote_count + 1,
       last_quote_at = VALUES(last_quote_at),
       updated_at = CURRENT_TIMESTAMP`,
    {
      company: params.company.trim(),
      email,
      phone: params.phone.trim(),
      contactName: params.contactName.trim(),
      quotedAt: params.quoteSubmittedAt,
    },
  );

  const rows = await nexterpQuery<CustomerRow[]>(
    `SELECT * FROM customers WHERE email = :email LIMIT 1`,
    { email },
  );
  const row = rows[0];
  if (!row) throw new Error("Failed to upsert MySQL customer");
  return mapCustomer(row);
}

export async function getMysqlCustomerById(
  id: number,
): Promise<CustomerRecord | null> {
  const rows = await nexterpQuery<CustomerRow[]>(
    `SELECT * FROM customers WHERE id = :id LIMIT 1`,
    { id },
  );
  return rows[0] ? mapCustomer(rows[0]) : null;
}

export async function getMysqlCustomerByEmail(
  email: string,
): Promise<CustomerRecord | null> {
  const rows = await nexterpQuery<CustomerRow[]>(
    `SELECT * FROM customers WHERE email = :email LIMIT 1`,
    { email: email.trim().toLowerCase() },
  );
  return rows[0] ? mapCustomer(rows[0]) : null;
}

export async function listMysqlCustomers(
  options: ListCustomersOptions = {},
): Promise<CustomerRecord[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);
  const params: Record<string, unknown> = { limit, offset };
  const where: string[] = [];

  if (options.status && options.status !== "all") {
    where.push("status = :status");
    params.status = options.status;
  }
  if (options.q?.trim()) {
    where.push(
      "(company LIKE :q OR email LIKE :q OR contact_name LIKE :q OR phone LIKE :q)",
    );
    params.q = `%${options.q.trim()}%`;
  }

  const sql = `SELECT * FROM customers
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY updated_at DESC
    LIMIT ${limit} OFFSET ${offset}`;

  const rows = await nexterpQuery<CustomerRow[]>(sql, params);
  return rows.map(mapCustomer);
}

export async function updateMysqlCustomer(
  params: UpdateCustomerParams,
): Promise<CustomerRecord | null> {
  const existing = await getMysqlCustomerById(params.id);
  if (!existing) return null;

  await nexterpExecute(
    `UPDATE customers SET
       company = :company,
       phone = :phone,
       contact_name = :contactName,
       notes = :notes,
       status = :status,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = :id`,
    {
      id: params.id,
      company: params.company ?? existing.company,
      phone: params.phone !== undefined ? params.phone : existing.phone,
      contactName:
        params.contactName !== undefined
          ? params.contactName
          : existing.contactName,
      notes: params.notes !== undefined ? params.notes : existing.notes,
      status: params.status ?? existing.status,
    },
  );

  const updated = await getMysqlCustomerById(params.id);
  if (!updated) throw new Error("Customer update failed");
  return updated;
}

export async function countMysqlCustomers(): Promise<number> {
  const rows = await nexterpQuery<Array<RowDataPacket & { c: number }>>(
    `SELECT COUNT(*) AS c FROM customers`,
  );
  return Number(rows[0]?.c ?? 0);
}

export type { ResultSetHeader };
