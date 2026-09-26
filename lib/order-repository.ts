import { getDb } from "@/lib/database";
import { parseOpsTags, serializeOpsTags } from "@/lib/ops-tags";
import { replaceEntityTags } from "@/lib/ops-tag-links";
import { buddhistPeriod } from "@/lib/th-billing";
import type {
  BillingDocumentRecord,
  BillingDocumentType,
  FulfillmentStatus,
  OrderEventRecord,
  OrderRecord,
  PaymentKind,
  PaymentRecord,
  PaymentRecordStatus,
  PaymentStatus,
} from "@/lib/order-types";

type OrderRow = {
  id: number;
  order_id: string;
  quote_request_id: string | null;
  customer_id: number | null;
  company: string;
  contact_name: string;
  email: string;
  phone: string;
  billing_name: string;
  billing_tax_id: string | null;
  billing_address: string | null;
  billing_branch: string;
  ship_to_name?: string | null;
  ship_to_phone?: string | null;
  ship_to_address?: string | null;
  ship_to_province?: string | null;
  product_summary: string;
  quantity: number;
  currency: string;
  vat_rate: number;
  vat_mode: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_amount: number;
  deposit_mode: string;
  deposit_percent: number;
  deposit_amount: number;
  remaining_amount: number;
  paid_amount: number;
  payment_status: string;
  fulfillment_status: string;
  access_token: string;
  notes: string | null;
  tags?: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: number;
  payment_id: string;
  order_id: string;
  kind: string;
  amount: number;
  method: string;
  status: string;
  qr_payload: string | null;
  customer_reference: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  reject_reason?: string | null;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: number;
  document_id: string;
  document_type: string;
  order_id: string;
  payment_id: string | null;
  status: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  grand_total: number;
  amount_text: string;
  line_description: string;
  issued_at: string;
  voided_at: string | null;
  buyer_name: string;
  buyer_tax_id: string | null;
  buyer_address: string | null;
  buyer_branch: string | null;
  created_at: string;
};

function mapOrder(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    quoteRequestId: row.quote_request_id,
    customerId: row.customer_id,
    company: row.company,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    billingName: row.billing_name,
    billingTaxId: row.billing_tax_id,
    billingAddress: row.billing_address,
    billingBranch: row.billing_branch,
    shipToName: row.ship_to_name ?? null,
    shipToPhone: row.ship_to_phone ?? null,
    shipToAddress: row.ship_to_address ?? null,
    shipToProvince: row.ship_to_province ?? null,
    productSummary: row.product_summary,
    quantity: row.quantity,
    currency: row.currency,
    vatRate: row.vat_rate,
    vatMode: row.vat_mode as OrderRecord["vatMode"],
    subtotalExVat: row.subtotal_ex_vat,
    vatAmount: row.vat_amount,
    totalAmount: row.total_amount,
    depositMode: row.deposit_mode as OrderRecord["depositMode"],
    depositPercent: row.deposit_percent,
    depositAmount: row.deposit_amount,
    remainingAmount: row.remaining_amount,
    paidAmount: row.paid_amount,
    paymentStatus: row.payment_status as PaymentStatus,
    fulfillmentStatus: row.fulfillment_status as FulfillmentStatus,
    accessToken: row.access_token,
    notes: row.notes,
    tags: parseOpsTags(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    paymentId: row.payment_id,
    orderId: row.order_id,
    kind: row.kind as PaymentKind,
    amount: row.amount,
    method: row.method,
    status: row.status as PaymentRecordStatus,
    qrPayload: row.qr_payload,
    customerReference: row.customer_reference,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    rejectReason: row.reject_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocument(row: DocumentRow): BillingDocumentRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    documentType: row.document_type as BillingDocumentType,
    orderId: row.order_id,
    paymentId: row.payment_id,
    status: row.status as BillingDocumentRecord["status"],
    subtotalExVat: row.subtotal_ex_vat,
    vatAmount: row.vat_amount,
    grandTotal: row.grand_total,
    amountText: row.amount_text,
    lineDescription: row.line_description,
    issuedAt: row.issued_at,
    voidedAt: row.voided_at,
    buyerName: row.buyer_name,
    buyerTaxId: row.buyer_tax_id,
    buyerAddress: row.buyer_address,
    buyerBranch: row.buyer_branch,
    createdAt: row.created_at,
  };
}

export type InsertOrderParams = Omit<
  OrderRecord,
  "id" | "createdAt" | "updatedAt" | "tags"
> & { createdAt: string; tags?: string[] };

export type ListOrdersOptions = {
  q?: string;
  paymentStatus?: PaymentStatus | "all";
  fulfillmentStatus?: FulfillmentStatus | "all";
  customerId?: number;
  email?: string;
  tag?: string;
  limit?: number;
  offset?: number;
};

export type InsertPaymentParams = {
  paymentId: string;
  orderId: string;
  kind: PaymentKind;
  amount: number;
  method: string;
  status: PaymentRecordStatus;
  qrPayload: string | null;
  createdAt: string;
};

export type InsertDocumentParams = {
  documentId: string;
  documentType: BillingDocumentType;
  orderId: string;
  paymentId: string | null;
  subtotalExVat: number;
  vatAmount: number;
  grandTotal: number;
  amountText: string;
  lineDescription: string;
  issuedAt: string;
  buyerName: string;
  buyerTaxId: string | null;
  buyerAddress: string | null;
  buyerBranch: string | null;
};

const DOCUMENT_PREFIX: Record<BillingDocumentType, string> = {
  deposit_invoice: "INV",
  balance_invoice: "INV",
  deposit_receipt: "REC",
  receipt: "REC",
  tax_invoice: "TAX",
};

export class SqliteOrderRepository {
  insertOrder(params: InsertOrderParams): OrderRecord {
    const db = getDb();
    db.prepare(
      `INSERT INTO orders (
        order_id, quote_request_id, customer_id, company, contact_name, email, phone,
        billing_name, billing_tax_id, billing_address, billing_branch,
        ship_to_name, ship_to_phone, ship_to_address, ship_to_province,
        product_summary, quantity, currency, vat_rate, vat_mode,
        subtotal_ex_vat, vat_amount, total_amount,
        deposit_mode, deposit_percent, deposit_amount, remaining_amount, paid_amount,
        payment_status, fulfillment_status, access_token, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )`,
    ).run(
      params.orderId,
      params.quoteRequestId,
      params.customerId,
      params.company,
      params.contactName,
      params.email,
      params.phone,
      params.billingName,
      params.billingTaxId,
      params.billingAddress,
      params.billingBranch,
      params.shipToName,
      params.shipToPhone,
      params.shipToAddress,
      params.shipToProvince,
      params.productSummary,
      params.quantity,
      params.currency,
      params.vatRate,
      params.vatMode,
      params.subtotalExVat,
      params.vatAmount,
      params.totalAmount,
      params.depositMode,
      params.depositPercent,
      params.depositAmount,
      params.remainingAmount,
      params.paidAmount,
      params.paymentStatus,
      params.fulfillmentStatus,
      params.accessToken,
      params.notes,
      params.createdAt,
      params.createdAt,
    );
    const row = this.getOrderByOrderId(params.orderId);
    if (!row) throw new Error("order_insert_failed");
    return row;
  }

  getOrderByOrderId(orderId: string): OrderRecord | null {
    const row = getDb()
      .prepare(`SELECT * FROM orders WHERE order_id = ?`)
      .get(orderId) as OrderRow | undefined;
    return row ? mapOrder(row) : null;
  }

  getOrderByAccessToken(token: string): OrderRecord | null {
    const row = getDb()
      .prepare(`SELECT * FROM orders WHERE access_token = ?`)
      .get(token) as OrderRow | undefined;
    return row ? mapOrder(row) : null;
  }

  getOrderByQuoteRequestId(requestId: string): OrderRecord | null {
    const row = getDb()
      .prepare(`SELECT * FROM orders WHERE quote_request_id = ?`)
      .get(requestId) as OrderRow | undefined;
    return row ? mapOrder(row) : null;
  }

  listOrders(options: ListOrdersOptions = {}): OrderRecord[] {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (options.paymentStatus && options.paymentStatus !== "all") {
      where.push("payment_status = ?");
      params.push(options.paymentStatus);
    }
    if (options.fulfillmentStatus && options.fulfillmentStatus !== "all") {
      where.push("fulfillment_status = ?");
      params.push(options.fulfillmentStatus);
    }
    if (options.customerId != null) {
      where.push("customer_id = ?");
      params.push(options.customerId);
    }
    if (options.email) {
      where.push("email = ? COLLATE NOCASE");
      params.push(options.email.trim().toLowerCase());
    }
    const tag = (options.tag || "").trim().toLowerCase();
    if (tag) {
      where.push("tags LIKE ?");
      params.push(`%${tag}%`);
    }
    const q = (options.q || "").trim();
    if (q) {
      where.push(
        `(order_id LIKE ? OR company LIKE ? OR email LIKE ? OR contact_name LIKE ? OR quote_request_id LIKE ?)`,
      );
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    const sql = `SELECT * FROM orders
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const rows = getDb().prepare(sql).all(...params) as OrderRow[];
    return rows.map(mapOrder);
  }

  listOrdersInDateRange(fromDate: string, toDate: string): OrderRecord[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM orders
         WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)
         ORDER BY created_at DESC, id DESC`,
      )
      .all(fromDate, toDate) as OrderRow[];
    return rows.map(mapOrder);
  }

  countOrders(options: Omit<ListOrdersOptions, "limit" | "offset"> = {}): number {
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (options.paymentStatus && options.paymentStatus !== "all") {
      where.push("payment_status = ?");
      params.push(options.paymentStatus);
    }
    if (options.fulfillmentStatus && options.fulfillmentStatus !== "all") {
      where.push("fulfillment_status = ?");
      params.push(options.fulfillmentStatus);
    }
    if (options.customerId != null) {
      where.push("customer_id = ?");
      params.push(options.customerId);
    }
    if (options.email) {
      where.push("email = ? COLLATE NOCASE");
      params.push(options.email.trim().toLowerCase());
    }
    const tag = (options.tag || "").trim().toLowerCase();
    if (tag) {
      where.push("tags LIKE ?");
      params.push(`%${tag}%`);
    }
    const q = (options.q || "").trim();
    if (q) {
      where.push(
        `(order_id LIKE ? OR company LIKE ? OR email LIKE ? OR contact_name LIKE ? OR quote_request_id LIKE ?)`,
      );
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM orders
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
      )
      .get(...params) as { c: number };
    return row.c;
  }

  updateOrderMoney(params: {
    orderId: string;
    paidAmount: number;
    paymentStatus: PaymentStatus;
    remainingAmount: number;
  }): void {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE orders SET paid_amount = ?, payment_status = ?, remaining_amount = ?, updated_at = ?
         WHERE order_id = ?`,
      )
      .run(
        params.paidAmount,
        params.paymentStatus,
        params.remainingAmount,
        now,
        params.orderId,
      );
  }

  updateFulfillment(orderId: string, status: FulfillmentStatus): void {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE orders SET fulfillment_status = ?, updated_at = ? WHERE order_id = ?`,
      )
      .run(status, now, orderId);
  }

  updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): void {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE orders SET payment_status = ?, updated_at = ? WHERE order_id = ?`,
      )
      .run(paymentStatus, now, orderId);
  }

  updateOrderTags(orderId: string, tags: string[]): string[] {
    const unique = replaceEntityTags("order", orderId, tags);
    const now = new Date().toISOString();
    getDb()
      .prepare(`UPDATE orders SET tags = ?, updated_at = ? WHERE order_id = ?`)
      .run(serializeOpsTags(unique), now, orderId);
    return unique;
  }

  insertPayment(params: InsertPaymentParams): PaymentRecord {
    const db = getDb();
    db.prepare(
      `INSERT INTO payments (
        payment_id, order_id, kind, amount, method, status, qr_payload,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      params.paymentId,
      params.orderId,
      params.kind,
      params.amount,
      params.method,
      params.status,
      params.qrPayload,
      params.createdAt,
      params.createdAt,
    );
    const row = this.getPaymentByPaymentId(params.paymentId);
    if (!row) throw new Error("payment_insert_failed");
    return row;
  }

  getPaymentByPaymentId(paymentId: string): PaymentRecord | null {
    const row = getDb()
      .prepare(`SELECT * FROM payments WHERE payment_id = ?`)
      .get(paymentId) as PaymentRow | undefined;
    return row ? mapPayment(row) : null;
  }

  listPaymentsByOrder(orderId: string): PaymentRecord[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM payments WHERE order_id = ? ORDER BY created_at ASC, id ASC`,
      )
      .all(orderId) as PaymentRow[];
    return rows.map(mapPayment);
  }

  listOpenPayments(limit = 80): PaymentRecord[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM payments
         WHERE status IN ('pending', 'submitted', 'rejected')
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(Math.min(200, Math.max(1, limit))) as PaymentRow[];
    return rows.map(mapPayment);
  }

  findOpenPayment(orderId: string, kind: PaymentKind): PaymentRecord | null {
    const row = getDb()
      .prepare(
        `SELECT * FROM payments
         WHERE order_id = ? AND kind = ? AND status IN ('pending', 'submitted', 'rejected')
         ORDER BY id DESC LIMIT 1`,
      )
      .get(orderId, kind) as PaymentRow | undefined;
    return row ? mapPayment(row) : null;
  }

  listSubmittedPayments(limit = 80): PaymentRecord[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM payments
         WHERE status = 'submitted'
         ORDER BY updated_at DESC, id DESC
         LIMIT ?`,
      )
      .all(Math.min(200, Math.max(1, limit))) as PaymentRow[];
    return rows.map(mapPayment);
  }

  updatePayment(params: {
    paymentId: string;
    status: PaymentRecordStatus;
    customerReference?: string | null;
    confirmedAt?: string | null;
    confirmedBy?: string | null;
    rejectReason?: string | null;
  }): void {
    const existing = this.getPaymentByPaymentId(params.paymentId);
    if (!existing) return;
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `UPDATE payments SET
          status = ?,
          customer_reference = ?,
          confirmed_at = ?,
          confirmed_by = ?,
          reject_reason = ?,
          updated_at = ?
         WHERE payment_id = ?`,
      )
      .run(
        params.status,
        params.customerReference !== undefined
          ? params.customerReference
          : existing.customerReference,
        params.confirmedAt !== undefined
          ? params.confirmedAt
          : existing.confirmedAt,
        params.confirmedBy !== undefined
          ? params.confirmedBy
          : existing.confirmedBy,
        params.rejectReason !== undefined
          ? params.rejectReason
          : existing.rejectReason,
        now,
        params.paymentId,
      );
  }

  nextDocumentNumber(type: BillingDocumentType, now = new Date()): string {
    const prefix = DOCUMENT_PREFIX[type];
    const period = buddhistPeriod(now);
    const db = getDb();
    db.exec("BEGIN IMMEDIATE");
    try {
      const existing = db
        .prepare(
          `SELECT last_value FROM document_sequences WHERE kind = ? AND period = ?`,
        )
        .get(prefix, period) as { last_value: number } | undefined;
      const next = (existing?.last_value ?? 0) + 1;
      if (existing) {
        db.prepare(
          `UPDATE document_sequences SET last_value = ? WHERE kind = ? AND period = ?`,
        ).run(next, prefix, period);
      } else {
        db.prepare(
          `INSERT INTO document_sequences (kind, period, last_value) VALUES (?, ?, ?)`,
        ).run(prefix, period, next);
      }
      db.exec("COMMIT");
      return `${prefix}-${period.slice(2)}-${String(next).padStart(4, "0")}`;
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // ignore
      }
      throw error;
    }
  }

  insertDocument(params: InsertDocumentParams): BillingDocumentRecord {
    getDb()
      .prepare(
        `INSERT INTO billing_documents (
          document_id, document_type, order_id, payment_id, status,
          subtotal_ex_vat, vat_amount, grand_total, amount_text, line_description,
          issued_at, buyer_name, buyer_tax_id, buyer_address, buyer_branch, created_at
        ) VALUES (?, ?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.documentId,
        params.documentType,
        params.orderId,
        params.paymentId,
        params.subtotalExVat,
        params.vatAmount,
        params.grandTotal,
        params.amountText,
        params.lineDescription,
        params.issuedAt,
        params.buyerName,
        params.buyerTaxId,
        params.buyerAddress,
        params.buyerBranch,
        params.issuedAt,
      );
    const row = this.getDocumentById(params.documentId);
    if (!row) throw new Error("document_insert_failed");
    return row;
  }

  getDocumentById(documentId: string): BillingDocumentRecord | null {
    const row = getDb()
      .prepare(`SELECT * FROM billing_documents WHERE document_id = ?`)
      .get(documentId) as DocumentRow | undefined;
    return row ? mapDocument(row) : null;
  }

  listDocumentsByOrder(orderId: string): BillingDocumentRecord[] {
    const rows = getDb()
      .prepare(
        `SELECT * FROM billing_documents
         WHERE order_id = ? AND status = 'issued'
         ORDER BY issued_at ASC, id ASC`,
      )
      .all(orderId) as DocumentRow[];
    return rows.map(mapDocument);
  }

  hasDocument(orderId: string, type: BillingDocumentType): boolean {
    const row = getDb()
      .prepare(
        `SELECT 1 AS ok FROM billing_documents
         WHERE order_id = ? AND document_type = ? AND status = 'issued' LIMIT 1`,
      )
      .get(orderId, type) as { ok: number } | undefined;
    return Boolean(row);
  }

  insertEvent(params: {
    orderId: string;
    eventType: string;
    message: string;
    actor?: string | null;
    createdAt: string;
  }): void {
    getDb()
      .prepare(
        `INSERT INTO order_events (order_id, event_type, message, actor, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        params.orderId,
        params.eventType,
        params.message,
        params.actor ?? null,
        params.createdAt,
      );
  }

  listEvents(orderId: string): OrderEventRecord[] {
    const rows = getDb()
      .prepare(
        `SELECT id, order_id, event_type, message, actor, created_at
         FROM order_events WHERE order_id = ? ORDER BY created_at ASC, id ASC`,
      )
      .all(orderId) as Array<{
      id: number;
      order_id: string;
      event_type: string;
      message: string;
      actor: string | null;
      created_at: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      eventType: row.event_type,
      message: row.message,
      actor: row.actor,
      createdAt: row.created_at,
    }));
  }
}

let defaultRepo: SqliteOrderRepository | null = null;

export function getOrderRepository(): SqliteOrderRepository {
  if (!defaultRepo) defaultRepo = new SqliteOrderRepository();
  return defaultRepo;
}

export function resetOrderRepository(): void {
  defaultRepo = null;
}
