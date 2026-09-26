import { getDb } from "@/lib/database";
import { parseOpsTags, serializeOpsTags } from "@/lib/ops-tags";
import { replaceEntityTags } from "@/lib/ops-tag-links";
import type {
  AssetRecord,
  CashLineKind,
  CashReceiptLine,
  CashReceiptRecord,
  ClaimAgainst,
  ClaimRecord,
  ClaimStatus,
  DestinationMode,
  GoodsReceiptRecord,
  IssueCategory,
  IssueStatus,
  IssueTicketRecord,
  PayableKind,
  SupplierPaymentRecord,
} from "@/lib/ops-cycle-types";
import { isPayableKind } from "@/lib/ops-cycle-types";

type GrRow = {
  id: number;
  receipt_id: string;
  po_id: string;
  order_id: string | null;
  destination: string;
  qty_ordered: number;
  qty_received: number;
  qty_damaged: number;
  qty_short: number;
  unit_thb: number;
  amount_thb: number;
  qc_notes: string | null;
  tracking_th: string | null;
  status: string;
  product_key?: string | null;
  location_id?: number | null;
  received_at: string;
  created_by: string | null;
  created_at: string;
};

type VoucherRow = {
  id: number;
  voucher_id: string;
  order_id: string | null;
  payer_name: string;
  status: string;
  total_amount: number;
  qr_payload: string | null;
  method: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
  access_token?: string | null;
  reject_reason?: string | null;
  tags?: string | null;
  created_at: string;
  updated_at: string;
};

type LineRow = {
  id: number;
  voucher_id: string;
  line_no: number;
  kind: string;
  description: string;
  amount: number;
  payment_id: string | null;
  order_id: string | null;
};

function mapGr(row: GrRow): GoodsReceiptRecord {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    poId: row.po_id,
    orderId: row.order_id,
    destination: row.destination as DestinationMode,
    qtyOrdered: row.qty_ordered,
    qtyReceived: row.qty_received,
    qtyDamaged: row.qty_damaged,
    qtyShort: row.qty_short,
    unitThb: row.unit_thb,
    amountThb: row.amount_thb,
    qcNotes: row.qc_notes,
    trackingTh: row.tracking_th,
    status: row.status as GoodsReceiptRecord["status"],
    productKey: row.product_key ?? null,
    locationId: row.location_id ?? null,
    receivedAt: row.received_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapLine(row: LineRow): CashReceiptLine {
  return {
    id: row.id,
    voucherId: row.voucher_id,
    lineNo: row.line_no,
    kind: row.kind as CashLineKind,
    description: row.description,
    amount: row.amount,
    paymentId: row.payment_id,
    orderId: row.order_id,
  };
}

function mapVoucher(row: VoucherRow, lines: CashReceiptLine[]): CashReceiptRecord {
  return {
    id: row.id,
    voucherId: row.voucher_id,
    orderId: row.order_id,
    payerName: row.payer_name,
    status: row.status as CashReceiptRecord["status"],
    totalAmount: row.total_amount,
    qrPayload: row.qr_payload,
    method: row.method,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    notes: row.notes,
    accessToken: row.access_token ?? null,
    rejectReason: row.reject_reason ?? null,
    tags: parseOpsTags(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines,
  };
}

export function insertGoodsReceipt(row: Omit<GoodsReceiptRecord, "id">): GoodsReceiptRecord {
  getDb()
    .prepare(
      `INSERT INTO goods_receipts (
        receipt_id, po_id, order_id, destination, qty_ordered, qty_received,
        qty_damaged, qty_short, unit_thb, amount_thb, qc_notes, tracking_th,
        status, product_key, location_id, received_at, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.receiptId,
      row.poId,
      row.orderId,
      row.destination,
      row.qtyOrdered,
      row.qtyReceived,
      row.qtyDamaged,
      row.qtyShort,
      row.unitThb,
      row.amountThb,
      row.qcNotes,
      row.trackingTh,
      row.status,
      row.productKey,
      row.locationId,
      row.receivedAt,
      row.createdBy,
      row.createdAt,
    );
  return getGoodsReceipt(row.receiptId)!;
}

export function getGoodsReceipt(receiptId: string): GoodsReceiptRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM goods_receipts WHERE receipt_id = ?`)
    .get(receiptId) as GrRow | undefined;
  return row ? mapGr(row) : null;
}

export function setGoodsReceiptStatus(params: {
  receiptId: string;
  status: "posted" | "void";
}): void {
  getDb()
    .prepare(`UPDATE goods_receipts SET status = ? WHERE receipt_id = ?`)
    .run(params.status, params.receiptId);
}

export function listGoodsReceipts(params?: { poId?: string; limit?: number }): GoodsReceiptRecord[] {
  const limit = Math.min(200, Math.max(1, params?.limit ?? 80));
  if (params?.poId) {
    const rows = getDb()
      .prepare(
        `SELECT * FROM goods_receipts WHERE po_id = ? AND status = 'posted'
         ORDER BY received_at DESC, id DESC LIMIT ?`,
      )
      .all(params.poId, limit) as GrRow[];
    return rows.map(mapGr);
  }
  const rows = getDb()
    .prepare(
      `SELECT * FROM goods_receipts WHERE status = 'posted'
       ORDER BY received_at DESC, id DESC LIMIT ?`,
    )
    .all(limit) as GrRow[];
  return rows.map(mapGr);
}

export function sumReceivedQty(poId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(qty_received), 0) AS qty
       FROM goods_receipts WHERE po_id = ? AND status = 'posted'`,
    )
    .get(poId) as { qty: number };
  return row.qty;
}

export function sumReceivedAmount(poId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount_thb), 0) AS amt
       FROM goods_receipts WHERE po_id = ? AND status = 'posted'`,
    )
    .get(poId) as { amt: number };
  return row.amt;
}

export function insertCashReceipt(
  voucher: Omit<CashReceiptRecord, "id" | "lines">,
  lines: Array<Omit<CashReceiptLine, "id" | "voucherId">>,
): CashReceiptRecord {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO cash_receipts (
        voucher_id, order_id, payer_name, status, total_amount, qr_payload,
        method, notes, access_token, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      voucher.voucherId,
      voucher.orderId,
      voucher.payerName,
      voucher.status,
      voucher.totalAmount,
      voucher.qrPayload,
      voucher.method,
      voucher.notes,
      voucher.accessToken,
      serializeOpsTags(voucher.tags),
      voucher.createdAt,
      voucher.updatedAt,
    );
    const insertLine = db.prepare(
      `INSERT INTO cash_receipt_lines (
        voucher_id, line_no, kind, description, amount, payment_id, order_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    lines.forEach((line) => {
      insertLine.run(
        voucher.voucherId,
        line.lineNo,
        line.kind,
        line.description,
        line.amount,
        line.paymentId,
        line.orderId,
      );
    });
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  }
  replaceEntityTags("voucher", voucher.voucherId, parseOpsTags(voucher.tags));
  return getCashReceipt(voucher.voucherId)!;
}

function loadLines(voucherId: string): CashReceiptLine[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM cash_receipt_lines WHERE voucher_id = ? ORDER BY line_no ASC, id ASC`,
    )
    .all(voucherId) as LineRow[];
  return rows.map(mapLine);
}

export function getCashReceipt(voucherId: string): CashReceiptRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM cash_receipts WHERE voucher_id = ?`)
    .get(voucherId) as VoucherRow | undefined;
  if (!row) return null;
  return mapVoucher(row, loadLines(row.voucher_id));
}

export function listCashReceipts(params?: { status?: string; limit?: number }): CashReceiptRecord[] {
  const limit = Math.min(200, Math.max(1, params?.limit ?? 80));
  const status = params?.status;
  const rows = (
    status && status !== "all"
      ? (getDb()
          .prepare(
            `SELECT * FROM cash_receipts WHERE status = ? ORDER BY created_at DESC LIMIT ?`,
          )
          .all(status, limit) as VoucherRow[])
      : (getDb()
          .prepare(`SELECT * FROM cash_receipts ORDER BY created_at DESC LIMIT ?`)
          .all(limit) as VoucherRow[])
  );
  return rows.map((row) => mapVoucher(row, loadLines(row.voucher_id)));
}

export function getCashReceiptByAccessToken(token: string): CashReceiptRecord | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const row = getDb()
    .prepare(`SELECT * FROM cash_receipts WHERE access_token = ?`)
    .get(trimmed) as VoucherRow | undefined;
  if (!row) return null;
  return mapVoucher(row, loadLines(row.voucher_id));
}

export function setCashReceiptAccessToken(voucherId: string, token: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(`UPDATE cash_receipts SET access_token = ?, updated_at = ? WHERE voucher_id = ?`)
    .run(token, now, voucherId);
}

export function confirmCashReceiptRow(params: {
  voucherId: string;
  confirmedAt: string;
  confirmedBy: string | null;
}): void {
  getDb()
    .prepare(
      `UPDATE cash_receipts SET status = 'confirmed', confirmed_at = ?, confirmed_by = ?,
        reject_reason = NULL, updated_at = ?
       WHERE voucher_id = ?`,
    )
    .run(params.confirmedAt, params.confirmedBy, params.confirmedAt, params.voucherId);
}

export function setCashReceiptRejectReason(
  voucherId: string,
  reason: string | null,
): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE cash_receipts SET reject_reason = ?, updated_at = ? WHERE voucher_id = ?`,
    )
    .run(reason, now, voucherId);
}

export function setCashReceiptTags(voucherId: string, tags: string[]): string[] {
  const unique = replaceEntityTags("voucher", voucherId, tags);
  const now = new Date().toISOString();
  getDb()
    .prepare(`UPDATE cash_receipts SET tags = ?, updated_at = ? WHERE voucher_id = ?`)
    .run(serializeOpsTags(unique), now, voucherId);
  return unique;
}

function mapSupplierPayment(row: {
  id: number;
  pay_id: string;
  po_id: string;
  receipt_id: string | null;
  amount: number;
  method: string;
  status: string;
  paid_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  payable_kind?: string;
}): SupplierPaymentRecord {
  const payableKind: PayableKind = isPayableKind(row.payable_kind)
    ? row.payable_kind
    : "factory";
  return {
    id: row.id,
    payId: row.pay_id,
    poId: row.po_id,
    receiptId: row.receipt_id,
    amount: row.amount,
    method: row.method,
    status: row.status,
    paidAt: row.paid_at,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    payableKind,
  };
}

export function insertSupplierPayment(row: Omit<SupplierPaymentRecord, "id">): SupplierPaymentRecord {
  getDb()
    .prepare(
      `INSERT INTO supplier_payments (
        pay_id, po_id, receipt_id, amount, method, status, paid_at, notes, created_by, created_at,
        payable_kind
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.payId,
      row.poId,
      row.receiptId,
      row.amount,
      row.method,
      row.status,
      row.paidAt,
      row.notes,
      row.createdBy,
      row.createdAt,
      row.payableKind,
    );
  return getSupplierPayment(row.payId)!;
}

export function getSupplierPayment(payId: string): SupplierPaymentRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM supplier_payments WHERE pay_id = ?`)
    .get(payId) as {
    id: number;
    pay_id: string;
    po_id: string;
    receipt_id: string | null;
    amount: number;
    method: string;
    status: string;
    paid_at: string;
    notes: string | null;
    created_by: string | null;
    created_at: string;
  } | undefined;
  if (!row) return null;
  return mapSupplierPayment(row);
}

export function listSupplierPayments(poId?: string): SupplierPaymentRecord[] {
  const rows = (
    poId
      ? getDb()
          .prepare(
            `SELECT * FROM supplier_payments WHERE po_id = ? ORDER BY paid_at DESC, id DESC`,
          )
          .all(poId)
      : getDb()
          .prepare(`SELECT * FROM supplier_payments ORDER BY paid_at DESC, id DESC LIMIT 80`)
          .all()
  ) as Array<{
    id: number;
    pay_id: string;
    po_id: string;
    receipt_id: string | null;
    amount: number;
    method: string;
    status: string;
    paid_at: string;
    notes: string | null;
    created_by: string | null;
    created_at: string;
  }>;
  return rows.map(mapSupplierPayment);
}

export function sumSupplierPaid(poId: string, payableKind?: PayableKind): number {
  if (payableKind) {
    const row = getDb()
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS amt FROM supplier_payments
         WHERE po_id = ? AND status = 'posted' AND payable_kind = ?`,
      )
      .get(poId, payableKind) as { amt: number };
    return row.amt;
  }
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS amt FROM supplier_payments WHERE po_id = ? AND status = 'posted'`,
    )
    .get(poId) as { amt: number };
  return row.amt;
}

export function insertAsset(row: Omit<AssetRecord, "id">): AssetRecord {
  getDb()
    .prepare(
      `INSERT INTO assets (
        asset_code, kind, name, qty, unit, value_thb, location, po_id, order_id,
        receipt_id, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.assetCode,
      row.kind,
      row.name,
      row.qty,
      row.unit,
      row.valueThb,
      row.location,
      row.poId,
      row.orderId,
      row.receiptId,
      row.status,
      row.notes,
      row.createdAt,
      row.updatedAt,
    );
  return getAsset(row.assetCode)!;
}

export function getAsset(assetCode: string): AssetRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM assets WHERE asset_code = ?`)
    .get(assetCode) as {
    id: number;
    asset_code: string;
    kind: string;
    name: string;
    qty: number;
    unit: string;
    value_thb: number;
    location: string;
    po_id: string | null;
    order_id: string | null;
    receipt_id: string | null;
    status: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    assetCode: row.asset_code,
    kind: row.kind as AssetRecord["kind"],
    name: row.name,
    qty: row.qty,
    unit: row.unit,
    valueThb: row.value_thb,
    location: row.location,
    poId: row.po_id,
    orderId: row.order_id,
    receiptId: row.receipt_id,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listAssets(limit = 80): AssetRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM assets ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(limit) as Array<{
    id: number;
    asset_code: string;
    kind: string;
    name: string;
    qty: number;
    unit: string;
    value_thb: number;
    location: string;
    po_id: string | null;
    order_id: string | null;
    receipt_id: string | null;
    status: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    assetCode: row.asset_code,
    kind: row.kind as AssetRecord["kind"],
    name: row.name,
    qty: row.qty,
    unit: row.unit,
    valueThb: row.value_thb,
    location: row.location,
    poId: row.po_id,
    orderId: row.order_id,
    receiptId: row.receipt_id,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function insertClaim(row: Omit<ClaimRecord, "id">): ClaimRecord {
  getDb()
    .prepare(
      `INSERT INTO claims (
        claim_id, against, po_id, order_id, receipt_id, issue_id, qty, amount_thb,
        reason, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.claimId,
      row.against,
      row.poId,
      row.orderId,
      row.receiptId,
      row.issueId,
      row.qty,
      row.amountThb,
      row.reason,
      row.status,
      row.createdBy,
      row.createdAt,
      row.updatedAt,
    );
  return getClaim(row.claimId)!;
}

export function getClaim(claimId: string): ClaimRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM claims WHERE claim_id = ?`)
    .get(claimId) as {
    id: number;
    claim_id: string;
    against: string;
    po_id: string | null;
    order_id: string | null;
    receipt_id: string | null;
    issue_id: string | null;
    qty: number;
    amount_thb: number;
    reason: string;
    status: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    claimId: row.claim_id,
    against: row.against as ClaimAgainst,
    poId: row.po_id,
    orderId: row.order_id,
    receiptId: row.receipt_id,
    issueId: row.issue_id,
    qty: row.qty,
    amountThb: row.amount_thb,
    reason: row.reason,
    status: row.status as ClaimStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClaimRow(row: {
  id: number;
  claim_id: string;
  against: string;
  po_id: string | null;
  order_id: string | null;
  receipt_id: string | null;
  issue_id: string | null;
  qty: number;
  amount_thb: number;
  reason: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}): ClaimRecord {
  return {
    id: row.id,
    claimId: row.claim_id,
    against: row.against as ClaimAgainst,
    poId: row.po_id,
    orderId: row.order_id,
    receiptId: row.receipt_id,
    issueId: row.issue_id,
    qty: row.qty,
    amountThb: row.amount_thb,
    reason: row.reason,
    status: row.status as ClaimStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getClaimByIssueId(issueId: string): ClaimRecord | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM claims WHERE issue_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(issueId) as Parameters<typeof mapClaimRow>[0] | undefined;
  return row ? mapClaimRow(row) : null;
}

export function getClaimByReceiptId(receiptId: string): ClaimRecord | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM claims WHERE receipt_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(receiptId) as Parameters<typeof mapClaimRow>[0] | undefined;
  return row ? mapClaimRow(row) : null;
}

export function listClaims(limit = 80): ClaimRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM claims ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(limit) as Array<{
    id: number;
    claim_id: string;
    against: string;
    po_id: string | null;
    order_id: string | null;
    receipt_id: string | null;
    issue_id: string | null;
    qty: number;
    amount_thb: number;
    reason: string;
    status: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    claimId: row.claim_id,
    against: row.against as ClaimAgainst,
    poId: row.po_id,
    orderId: row.order_id,
    receiptId: row.receipt_id,
    issueId: row.issue_id,
    qty: row.qty,
    amountThb: row.amount_thb,
    reason: row.reason,
    status: row.status as ClaimStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function updateClaimStatus(claimId: string, status: ClaimStatus, at: string): void {
  getDb()
    .prepare(`UPDATE claims SET status = ?, updated_at = ? WHERE claim_id = ?`)
    .run(status, at, claimId);
}

export function insertIssue(row: Omit<IssueTicketRecord, "id">): IssueTicketRecord {
  getDb()
    .prepare(
      `INSERT INTO issue_tickets (
        issue_id, source, company, contact_name, email, phone, order_id, po_id,
        category, title, detail, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.issueId,
      row.source,
      row.company,
      row.contactName,
      row.email,
      row.phone,
      row.orderId,
      row.poId,
      row.category,
      row.title,
      row.detail,
      row.status,
      row.createdAt,
      row.updatedAt,
    );
  return getIssue(row.issueId)!;
}

export function getIssue(issueId: string): IssueTicketRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM issue_tickets WHERE issue_id = ?`)
    .get(issueId) as {
    id: number;
    issue_id: string;
    source: string;
    company: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    order_id: string | null;
    po_id: string | null;
    category: string;
    title: string;
    detail: string;
    status: string;
    created_at: string;
    updated_at: string;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    issueId: row.issue_id,
    source: row.source as IssueTicketRecord["source"],
    company: row.company,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    orderId: row.order_id,
    poId: row.po_id,
    category: row.category as IssueCategory,
    title: row.title,
    detail: row.detail,
    status: row.status as IssueStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listIssues(limit = 80): IssueTicketRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM issue_tickets ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(limit) as Array<{
    id: number;
    issue_id: string;
    source: string;
    company: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    order_id: string | null;
    po_id: string | null;
    category: string;
    title: string;
    detail: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    issueId: row.issue_id,
    source: row.source as IssueTicketRecord["source"],
    company: row.company,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    orderId: row.order_id,
    poId: row.po_id,
    category: row.category as IssueCategory,
    title: row.title,
    detail: row.detail,
    status: row.status as IssueStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function updateIssueStatus(issueId: string, status: IssueStatus, at: string): void {
  getDb()
    .prepare(`UPDATE issue_tickets SET status = ?, updated_at = ? WHERE issue_id = ?`)
    .run(status, at, issueId);
}

export function patchPoReceived(params: {
  poId: string;
  receivedQty: number;
  destinationMode: string;
  status?: string;
  at: string;
}): void {
  if (params.status) {
    getDb()
      .prepare(
        `UPDATE factory_pos
         SET received_qty = ?, destination_mode = ?, status = ?, updated_at = ?
         WHERE po_id = ?`,
      )
      .run(
        params.receivedQty,
        params.destinationMode,
        params.status,
        params.at,
        params.poId,
      );
    return;
  }
  getDb()
    .prepare(
      `UPDATE factory_pos SET received_qty = ?, destination_mode = ?, updated_at = ? WHERE po_id = ?`,
    )
    .run(params.receivedQty, params.destinationMode, params.at, params.poId);
}
