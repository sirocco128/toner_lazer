import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { getDb, getSqlitePath } from "@/lib/database";
import { getObject, objectKey, putObject } from "@/lib/object-storage";
import { recordObjectAccess } from "@/lib/object-access";
import { bangkokDateYmd } from "@/lib/bangkok-date";
import type { SlipCheckStatus } from "@/lib/slip-verify";

export const SLIP_MAX_BYTES = 4_000_000;
export const SLIP_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export type PaymentSlipRecord = {
  id: number;
  slipId: string;
  paymentId: string | null;
  voucherId: string | null;
  filePath: string;
  contentType: string;
  byteSize: number;
  originalName: string | null;
  checkStatus: SlipCheckStatus;
  expectedAmount: number;
  extractedAmount: number | null;
  extractedPayee: string | null;
  extractedPromptPay: string | null;
  extractedTime: string | null;
  extractedRef: string | null;
  notes: string | null;
  model: string | null;
  createdAt: string;
};

type Row = {
  id: number;
  slip_id: string;
  payment_id: string | null;
  voucher_id: string | null;
  file_path: string;
  content_type: string;
  byte_size: number;
  original_name: string | null;
  check_status: string;
  expected_amount: number;
  extracted_amount: number | null;
  extracted_payee: string | null;
  extracted_promptpay: string | null;
  extracted_time: string | null;
  extracted_ref: string | null;
  notes: string | null;
  model: string | null;
  created_at: string;
};

function mapRow(row: Row): PaymentSlipRecord {
  return {
    id: row.id,
    slipId: row.slip_id,
    paymentId: row.payment_id,
    voucherId: row.voucher_id,
    filePath: row.file_path,
    contentType: row.content_type,
    byteSize: row.byte_size,
    originalName: row.original_name,
    checkStatus: row.check_status as SlipCheckStatus,
    expectedAmount: row.expected_amount,
    extractedAmount: row.extracted_amount,
    extractedPayee: row.extracted_payee,
    extractedPromptPay: row.extracted_promptpay,
    extractedTime: row.extracted_time,
    extractedRef: row.extracted_ref,
    notes: row.notes,
    model: row.model,
    createdAt: row.created_at,
  };
}

export function paymentSlipsDir(): string {
  return path.join(path.dirname(getSqlitePath()), "payment-slips");
}

export function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function createSlipId(now = new Date()): string {
  return `SLP-${bangkokDateYmd(now)}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function insertPaymentSlip(
  row: Omit<PaymentSlipRecord, "id">,
): PaymentSlipRecord {
  getDb()
    .prepare(
      `INSERT INTO payment_slips (
        slip_id, payment_id, voucher_id, file_path, content_type, byte_size,
        original_name, check_status, expected_amount, extracted_amount,
        extracted_payee, extracted_promptpay, extracted_time, extracted_ref,
        notes, model, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.slipId,
      row.paymentId,
      row.voucherId,
      row.filePath,
      row.contentType,
      row.byteSize,
      row.originalName,
      row.checkStatus,
      row.expectedAmount,
      row.extractedAmount,
      row.extractedPayee,
      row.extractedPromptPay,
      row.extractedTime,
      row.extractedRef,
      row.notes,
      row.model,
      row.createdAt,
    );
  return getPaymentSlip(row.slipId)!;
}

export function getPaymentSlip(slipId: string): PaymentSlipRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM payment_slips WHERE slip_id = ?`)
    .get(slipId) as Row | undefined;
  return row ? mapRow(row) : null;
}

export function getLatestSlipForPayment(paymentId: string): PaymentSlipRecord | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM payment_slips WHERE payment_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
    )
    .get(paymentId) as Row | undefined;
  return row ? mapRow(row) : null;
}

export function getLatestSlipForVoucher(voucherId: string): PaymentSlipRecord | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM payment_slips WHERE voucher_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
    )
    .get(voucherId) as Row | undefined;
  return row ? mapRow(row) : null;
}

export async function saveSlipFile(input: {
  slipId: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<string> {
  const rel = `${input.slipId}.${extensionForMime(input.mimeType)}`;
  await putObject({
    kind: "slips",
    fileName: rel,
    bytes: input.bytes,
    contentType: input.mimeType,
  });
  recordObjectAccess({
    action: "object.upload",
    status: "ok",
    kind: "slips",
    key: objectKey("slips", rel),
    resourceId: input.slipId,
    purpose: "payment_slip",
  });
  return rel;
}

export async function readSlipFile(relPath: string): Promise<Buffer | null> {
  const base = path.basename(relPath);
  const stored = await getObject(objectKey("slips", base));
  if (stored) return stored;
  const abs = path.join(paymentSlipsDir(), base);
  if (!existsSync(abs)) return null;
  return readFileSync(abs);
}

export function isAllowedSlipMime(mime: string): boolean {
  return SLIP_MIME.has(mime);
}
