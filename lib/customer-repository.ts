/**
 * SQLite customer repository for local CRM / ops console.
 * When NEXTERP_MYSQL_ENABLED=true, also mirrors customers into MySQL staging.
 */

import { getDb } from "@/lib/database";
import { namesLookAlike } from "@/lib/customer-dedupe";
import type {
  CreateCustomerParams,
  CustomerContactRecord,
  CustomerRecord,
  CustomerSource,
  CustomerStatus,
  CustomerType,
  ListCustomersOptions,
  UpdateCustomerParams,
  UpsertCustomerContactParams,
  UpsertCustomerFromQuoteParams,
} from "@/lib/customer-types";
import {
  isCustomerSource,
  isCustomerType,
  parseCustomerTags,
  serializeCustomerTags,
} from "@/lib/customer-types";
import { isNexterpMysqlEnabled } from "@/lib/nexterp-mysql";
import {
  updateMysqlCustomer,
  upsertMysqlCustomerFromQuote,
} from "@/lib/nexterp-customers";
import { normalizeThaiTaxId } from "@/lib/th-billing";
import { replaceEntityTags } from "@/lib/ops-tag-links";

type CustomerRow = {
  id: number;
  company: string;
  email: string;
  phone: string | null;
  contact_name: string | null;
  notes: string | null;
  status: string;
  quote_count: number;
  last_quote_at: string | null;
  line_id?: string | null;
  tax_id?: string | null;
  billing_name?: string | null;
  billing_address?: string | null;
  billing_branch?: string | null;
  customer_type?: string | null;
  source?: string | null;
  tags?: string | null;
  default_ship_province?: string | null;
  order_count?: number | null;
  last_order_at?: string | null;
  merged_into_id?: number | null;
  created_at: string;
  updated_at: string;
};

type ContactRow = {
  id: number;
  customer_id: number;
  name: string | null;
  email: string;
  phone: string | null;
  line_id: string | null;
  line_user_id?: string | null;
  line_display_name?: string | null;
  role_title: string | null;
  is_primary: number;
  is_billing: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function asType(value: string | null | undefined): CustomerType {
  return isCustomerType(String(value || "")) ? (value as CustomerType) : "company";
}

function asSource(value: string | null | undefined): CustomerSource {
  return isCustomerSource(String(value || ""))
    ? (value as CustomerSource)
    : "web_rfq";
}

function mapRow(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    company: row.company,
    email: row.email,
    phone: row.phone,
    contactName: row.contact_name,
    notes: row.notes,
    status: row.status as CustomerStatus,
    quoteCount: row.quote_count,
    lastQuoteAt: row.last_quote_at,
    lineId: row.line_id ?? null,
    taxId: row.tax_id ?? null,
    billingName: row.billing_name ?? null,
    billingAddress: row.billing_address ?? null,
    billingBranch: row.billing_branch || "สำนักงานใหญ่",
    customerType: asType(row.customer_type),
    source: asSource(row.source),
    tags: parseCustomerTags(row.tags),
    defaultShipProvince: row.default_ship_province ?? null,
    orderCount: Number(row.order_count || 0),
    lastOrderAt: row.last_order_at ?? null,
    mergedIntoId: row.merged_into_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContact(row: ContactRow): CustomerContactRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    lineId: row.line_id,
    lineUserId: row.line_user_id ?? null,
    lineDisplayName: row.line_display_name ?? null,
    roleTitle: row.role_title,
    isPrimary: Boolean(row.is_primary),
    isBilling: Boolean(row.is_billing),
    status: row.status as CustomerContactRecord["status"],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mirrorMysqlUpsert(params: UpsertCustomerFromQuoteParams): void {
  if (!isNexterpMysqlEnabled()) return;
  void upsertMysqlCustomerFromQuote(params).catch((error) => {
    console.error("[nexterp] customer mirror failed", error);
  });
}

function mirrorMysqlUpdate(record: CustomerRecord): void {
  if (!isNexterpMysqlEnabled()) return;
  void updateMysqlCustomer({
    id: record.id,
    company: record.company,
    phone: record.phone,
    contactName: record.contactName,
    notes: record.notes,
    status: record.status,
  }).catch((error) => {
    console.error("[nexterp] customer update mirror failed", error);
  });
}

export function resolveCustomerId(id: number, seen = new Set<number>()): number {
  if (seen.has(id)) return id;
  seen.add(id);
  const row = getDb()
    .prepare(`SELECT merged_into_id FROM customers WHERE id = ?`)
    .get(id) as { merged_into_id: number | null } | undefined;
  if (row?.merged_into_id) return resolveCustomerId(row.merged_into_id, seen);
  return id;
}

export function getCustomerById(id: number): CustomerRecord | null {
  const resolved = resolveCustomerId(id);
  const row = getDb()
    .prepare(`SELECT * FROM customers WHERE id = ?`)
    .get(resolved) as CustomerRow | undefined;
  return row ? mapRow(row) : null;
}

export function getCustomerByEmail(email: string): CustomerRecord | null {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return null;
  const contact = getContactByEmail(wanted);
  if (contact) return getCustomerById(contact.customerId);
  const row = getDb()
    .prepare(`SELECT * FROM customers WHERE email = ? COLLATE NOCASE`)
    .get(wanted) as CustomerRow | undefined;
  return row ? mapRow(row) : null;
}

export function getCustomerByTaxId(taxId: string): CustomerRecord | null {
  const id = normalizeThaiTaxId(taxId);
  if (!id) return null;
  const row = getDb()
    .prepare(
      `SELECT * FROM customers
       WHERE tax_id = ? AND merged_into_id IS NULL
       ORDER BY id ASC LIMIT 1`,
    )
    .get(id) as CustomerRow | undefined;
  return row ? mapRow(row) : null;
}

export function getContactByEmail(email: string): CustomerContactRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM customer_contacts WHERE email = ? COLLATE NOCASE`)
    .get(email.trim().toLowerCase()) as ContactRow | undefined;
  return row ? mapContact(row) : null;
}

export function listCustomerContacts(customerId: number): CustomerContactRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM customer_contacts
       WHERE customer_id = ?
       ORDER BY is_primary DESC, id ASC`,
    )
    .all(customerId) as ContactRow[];
  return rows.map(mapContact);
}

function ensurePrimaryContact(customer: CustomerRecord): void {
  const email = customer.email.trim().toLowerCase();
  if (!email) return;
  const existing = getContactByEmail(email);
  if (existing) return;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO customer_contacts (
        customer_id, name, email, phone, line_id, role_title,
        is_primary, is_billing, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, 1, 1, 'active', NULL, ?, ?)`,
    )
    .run(
      customer.id,
      customer.contactName,
      email,
      customer.phone,
      customer.lineId,
      now,
      now,
    );
}

export function upsertCustomerFromQuote(
  params: UpsertCustomerFromQuoteParams,
): CustomerRecord {
  const db = getDb();
  const email = params.email.trim().toLowerCase();
  const now = params.quoteSubmittedAt;
  const province = params.province?.trim() || null;
  const existing = getCustomerByEmail(email);

  if (!existing) {
    const result = db
      .prepare(
        `INSERT INTO customers (
          company, email, phone, contact_name, notes, status,
          quote_count, last_quote_at, created_at, updated_at,
          source, default_ship_province, customer_type, billing_branch, tax_id
        ) VALUES (?, ?, ?, ?, NULL, 'active', 1, ?, ?, ?, 'web_rfq', ?, 'company', ?, ?)`,
      )
      .run(
        params.company.trim(),
        email,
        params.phone.trim(),
        params.contactName.trim(),
        now,
        now,
        now,
        province,
        params.billingBranch?.trim() || "สำนักงานใหญ่",
        normalizeThaiTaxId(params.taxId),
      ) as { lastInsertRowid: number | bigint };

    const row = db
      .prepare(`SELECT * FROM customers WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as CustomerRow;
    const created = mapRow(row);
    ensurePrimaryContact(created);
    mirrorMysqlUpsert(params);
    return created;
  }

  db.prepare(
    `UPDATE customers SET
      company = ?,
      phone = COALESCE(?, phone),
      contact_name = COALESCE(?, contact_name),
      quote_count = quote_count + 1,
      last_quote_at = ?,
      default_ship_province = COALESCE(?, default_ship_province),
      tax_id = COALESCE(?, tax_id),
      billing_branch = COALESCE(?, billing_branch),
      updated_at = ?
     WHERE id = ?`,
  ).run(
    params.company.trim() || existing.company,
    params.phone.trim() || null,
    params.contactName.trim() || null,
    now,
    province,
    normalizeThaiTaxId(params.taxId),
    params.billingBranch?.trim() || null,
    now,
    existing.id,
  );

  const contact = getContactByEmail(email);
  if (contact) {
    db.prepare(
      `UPDATE customer_contacts SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        updated_at = ?
       WHERE id = ?`,
    ).run(
      params.contactName.trim() || null,
      params.phone.trim() || null,
      now,
      contact.id,
    );
  } else {
    ensurePrimaryContact({
      ...existing,
      email,
      phone: params.phone.trim() || existing.phone,
      contactName: params.contactName.trim() || existing.contactName,
    });
  }

  const row = db
    .prepare(`SELECT * FROM customers WHERE id = ?`)
    .get(existing.id) as CustomerRow;
  mirrorMysqlUpsert(params);
  return mapRow(row);
}

function listWhere(options: ListCustomersOptions): {
  sql: string;
  params: (string | number)[];
} {
  const status = options.status ?? "all";
  const q = (options.q || "").trim();
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (!options.includeMerged) {
    where.push("merged_into_id IS NULL");
  }
  if (status !== "all") {
    where.push("status = ?");
    params.push(status);
  }
  if (options.customerType && options.customerType !== "all") {
    where.push("customer_type = ?");
    params.push(options.customerType);
  }
  if (options.source && options.source !== "all") {
    where.push("source = ?");
    params.push(options.source);
  }
  if (options.province?.trim()) {
    where.push("default_ship_province LIKE ?");
    params.push(`%${options.province.trim()}%`);
  }
  if (options.hasOrders === "yes") {
    where.push("order_count > 0");
  } else if (options.hasOrders === "no") {
    where.push("order_count = 0");
  }
  if (options.taxReady === "ready") {
    where.push(
      `tax_id IS NOT NULL AND length(replace(tax_id, ' ', '')) = 13
       AND billing_address IS NOT NULL AND trim(billing_address) != ''`,
    );
  } else if (options.taxReady === "missing") {
    where.push(
      `(tax_id IS NULL OR length(replace(coalesce(tax_id, ''), ' ', '')) != 13
        OR billing_address IS NULL OR trim(billing_address) = '')`,
    );
  }
  if (options.tag?.trim()) {
    where.push("tags LIKE ?");
    params.push(`%${options.tag.trim().toLowerCase()}%`);
  }
  if (q) {
    where.push(
      `(company LIKE ? OR email LIKE ? OR contact_name LIKE ? OR phone LIKE ?
        OR tax_id LIKE ? OR line_id LIKE ? OR id IN (
          SELECT customer_id FROM customer_contacts
          WHERE email LIKE ? OR name LIKE ? OR phone LIKE ? OR line_id LIKE ?
        ))`,
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like, like, like, like);
  }

  return {
    sql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

export function listCustomers(
  options: ListCustomersOptions = {},
): CustomerRecord[] {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);
  const { sql, params } = listWhere(options);
  const rows = getDb()
    .prepare(
      `SELECT * FROM customers
       ${sql}
       ORDER BY updated_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as CustomerRow[];
  return rows.map(mapRow);
}

export function countCustomers(
  options: Pick<
    ListCustomersOptions,
    | "q"
    | "status"
    | "customerType"
    | "source"
    | "tag"
    | "taxReady"
    | "province"
    | "hasOrders"
    | "includeMerged"
  > = {},
): number {
  const { sql, params } = listWhere(options);
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM customers ${sql}`)
    .get(...params) as { c: number };
  return row.c;
}

export function createCustomer(params: CreateCustomerParams): CustomerRecord {
  const email = params.email.trim().toLowerCase();
  if (!email) throw new Error("email_required");
  if (getCustomerByEmail(email)) throw new Error("email_taken");

  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO customers (
        company, email, phone, contact_name, notes, status,
        quote_count, last_quote_at, created_at, updated_at,
        line_id, tax_id, billing_name, billing_address, billing_branch,
        customer_type, source, tags, default_ship_province, order_count
      ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      params.company.trim(),
      email,
      params.phone?.trim() || null,
      params.contactName?.trim() || null,
      params.notes?.trim() || null,
      params.status || "active",
      now,
      now,
      params.lineId?.trim() || null,
      normalizeThaiTaxId(params.taxId),
      params.billingName?.trim() || null,
      params.billingAddress?.trim() || null,
      params.billingBranch?.trim() || "สำนักงานใหญ่",
      params.customerType || "company",
      params.source || "manual",
      serializeCustomerTags(params.tags),
      params.defaultShipProvince?.trim() || null,
    ) as { lastInsertRowid: number | bigint };

  const created = getCustomerById(Number(result.lastInsertRowid));
  if (!created) throw new Error("customer_insert_failed");
  replaceEntityTags("customer", String(created.id), created.tags);
  ensurePrimaryContact(created);
  return created;
}

export function updateCustomer(
  params: UpdateCustomerParams,
): CustomerRecord | null {
  const existing = getCustomerById(params.id);
  if (!existing) return null;
  if (existing.mergedIntoId) return getCustomerById(existing.mergedIntoId);

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE customers SET
        company = ?,
        phone = ?,
        contact_name = ?,
        notes = ?,
        status = ?,
        line_id = ?,
        tax_id = ?,
        billing_name = ?,
        billing_address = ?,
        billing_branch = ?,
        customer_type = ?,
        source = ?,
        tags = ?,
        default_ship_province = ?,
        updated_at = ?
       WHERE id = ?`,
    )
    .run(
      params.company?.trim() || existing.company,
      params.phone !== undefined ? params.phone : existing.phone,
      params.contactName !== undefined ? params.contactName : existing.contactName,
      params.notes !== undefined ? params.notes : existing.notes,
      params.status || existing.status,
      params.lineId !== undefined ? params.lineId : existing.lineId,
      params.taxId !== undefined
        ? normalizeThaiTaxId(params.taxId)
        : existing.taxId,
      params.billingName !== undefined ? params.billingName : existing.billingName,
      params.billingAddress !== undefined
        ? params.billingAddress
        : existing.billingAddress,
      params.billingBranch?.trim() || existing.billingBranch,
      params.customerType || existing.customerType,
      params.source || existing.source,
      params.tags !== undefined
        ? serializeCustomerTags(params.tags)
        : serializeCustomerTags(existing.tags),
      params.defaultShipProvince !== undefined
        ? params.defaultShipProvince
        : existing.defaultShipProvince,
      now,
      existing.id,
    );

  const updated = getCustomerById(existing.id);
  if (updated) {
    replaceEntityTags("customer", String(updated.id), updated.tags);
    ensurePrimaryContact(updated);
    mirrorMysqlUpdate(updated);
  }
  return updated;
}

export function upsertCustomerContact(
  params: UpsertCustomerContactParams,
): CustomerContactRecord {
  const email = params.email.trim().toLowerCase();
  if (!email) throw new Error("email_required");
  const now = new Date().toISOString();
  const taken = getContactByEmail(email);
  if (taken && taken.id !== params.id && taken.customerId !== params.customerId) {
    throw new Error("email_taken");
  }

  if (params.isPrimary) {
    getDb()
      .prepare(
        `UPDATE customer_contacts SET is_primary = 0, updated_at = ? WHERE customer_id = ?`,
      )
      .run(now, params.customerId);
  }

  if (params.id) {
    const existing = getDb()
      .prepare(`SELECT * FROM customer_contacts WHERE id = ? AND customer_id = ?`)
      .get(params.id, params.customerId) as ContactRow | undefined;
    if (!existing) throw new Error("contact_not_found");
    getDb()
      .prepare(
        `UPDATE customer_contacts SET
          name = ?, email = ?, phone = ?, line_id = ?, role_title = ?,
          is_primary = ?, is_billing = ?, status = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        params.name?.trim() || null,
        email,
        params.phone?.trim() || null,
        params.lineId?.trim() || null,
        params.roleTitle?.trim() || null,
        params.isPrimary ? 1 : 0,
        params.isBilling ? 1 : 0,
        params.status || existing.status,
        params.notes !== undefined ? params.notes : existing.notes,
        now,
        params.id,
      );
  } else {
    getDb()
      .prepare(
        `INSERT INTO customer_contacts (
          customer_id, name, email, phone, line_id, role_title,
          is_primary, is_billing, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.customerId,
        params.name?.trim() || null,
        email,
        params.phone?.trim() || null,
        params.lineId?.trim() || null,
        params.roleTitle?.trim() || null,
        params.isPrimary ? 1 : 0,
        params.isBilling ? 1 : 0,
        params.status || "active",
        params.notes?.trim() || null,
        now,
        now,
      );
  }

  const contact = getContactByEmail(email);
  if (!contact) throw new Error("contact_upsert_failed");

  if (contact.isPrimary) {
    getDb()
      .prepare(
        `UPDATE customers SET
          email = ?, contact_name = ?, phone = COALESCE(?, phone),
          line_id = COALESCE(?, line_id), updated_at = ?
         WHERE id = ?`,
      )
      .run(
        contact.email,
        contact.name,
        contact.phone,
        contact.lineId,
        now,
        params.customerId,
      );
  }
  return contact;
}

export function recomputeCustomerRollups(customerId: number): CustomerRecord | null {
  const customer = getCustomerById(customerId);
  if (!customer) return null;
  const db = getDb();
  const orderStats = db
    .prepare(
      `SELECT COUNT(*) AS c, MAX(created_at) AS last_at
       FROM orders WHERE customer_id = ?`,
    )
    .get(customerId) as { c: number; last_at: string | null };
  const province = db
    .prepare(
      `SELECT province FROM quote_requests
       WHERE customer_id = ? AND province IS NOT NULL AND trim(province) != ''
       ORDER BY submitted_at DESC, id DESC LIMIT 1`,
    )
    .get(customerId) as { province: string } | undefined;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE customers SET
      order_count = ?,
      last_order_at = ?,
      default_ship_province = COALESCE(?, default_ship_province),
      updated_at = ?
     WHERE id = ?`,
  ).run(
    Number(orderStats.c || 0),
    orderStats.last_at,
    province?.province || null,
    now,
    customerId,
  );
  return getCustomerById(customerId);
}

export function findPossibleDuplicates(customer: CustomerRecord): CustomerRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM customers
       WHERE id != ? AND merged_into_id IS NULL AND status = 'active'`,
    )
    .all(customer.id) as CustomerRow[];
  const tax = customer.taxId;
  return rows
    .map(mapRow)
    .filter((other) => {
      if (tax && other.taxId && tax === other.taxId) return true;
      return namesLookAlike(customer.company, other.company);
    })
    .slice(0, 8);
}

export function mergeCustomers(params: {
  sourceId: number;
  targetId: number;
  actorEmail?: string | null;
}): CustomerRecord {
  const sourceId = resolveCustomerId(params.sourceId);
  const targetId = resolveCustomerId(params.targetId);
  if (sourceId === targetId) throw new Error("self_merge");

  const source = getCustomerById(sourceId);
  const target = getCustomerById(targetId);
  if (!source || !target) throw new Error("customer_not_found");

  const db = getDb();
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare(`UPDATE quote_requests SET customer_id = ? WHERE customer_id = ?`).run(
      targetId,
      sourceId,
    );
    db.prepare(`UPDATE orders SET customer_id = ? WHERE customer_id = ?`).run(
      targetId,
      sourceId,
    );

    const contacts = listCustomerContacts(sourceId);
    for (const contact of contacts) {
      const clash = getContactByEmail(contact.email);
      if (clash && clash.customerId === targetId) {
        db.prepare(`DELETE FROM customer_contacts WHERE id = ?`).run(contact.id);
        continue;
      }
      db.prepare(
        `UPDATE customer_contacts SET customer_id = ?, is_primary = 0, updated_at = ? WHERE id = ?`,
      ).run(targetId, now, contact.id);
    }

    const tags = [...new Set([...target.tags, ...source.tags])];
    const notes = [target.notes, source.notes].filter(Boolean).join("\n---\n") || null;
    db.prepare(
      `UPDATE customers SET
        phone = COALESCE(phone, ?),
        contact_name = COALESCE(contact_name, ?),
        line_id = COALESCE(line_id, ?),
        tax_id = COALESCE(tax_id, ?),
        billing_name = COALESCE(billing_name, ?),
        billing_address = COALESCE(billing_address, ?),
        notes = ?,
        tags = ?,
        quote_count = quote_count + ?,
        updated_at = ?
       WHERE id = ?`,
    ).run(
      source.phone,
      source.contactName,
      source.lineId,
      source.taxId,
      source.billingName,
      source.billingAddress,
      notes,
      serializeCustomerTags(tags),
      source.quoteCount,
      now,
      targetId,
    );

    db.prepare(
      `UPDATE customers SET
        merged_into_id = ?, status = 'inactive',
        email = ?, updated_at = ?
       WHERE id = ?`,
    ).run(targetId, `merged+${sourceId}@internal.invalid`, now, sourceId);

    db.prepare(
      `INSERT INTO customer_merges (source_id, target_id, actor_email, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(sourceId, targetId, params.actorEmail || null, now);

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }

  recomputeCustomerRollups(targetId);
  const merged = getCustomerById(targetId);
  if (!merged) throw new Error("merge_failed");
  replaceEntityTags("customer", String(merged.id), merged.tags);
  return merged;
}
