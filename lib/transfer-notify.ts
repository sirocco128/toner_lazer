import {
  createSlipId,
  insertPaymentSlip,
  isAllowedSlipMime,
  saveSlipFile,
  SLIP_MAX_BYTES,
} from "@/lib/payment-slips";
import { getPayeeDetails } from "@/lib/payee";
import { extractSlipFromImage } from "@/lib/slip-ocr";
import {
  evaluateSlip,
  type SlipCheckStatus,
} from "@/lib/slip-verify";

export type SlipFileInput = {
  bytes: Buffer;
  mimeType: string;
  name: string;
};

export type TransferNoticeResult = {
  slipId: string;
  checkStatus: SlipCheckStatus;
  notes: string;
  extractedAmount: number | null;
};

export async function fileToSlipInput(file: File): Promise<SlipFileInput | { error: string }> {
  if (file.size <= 0) return { error: "กรุณาแนบรูปสลิปการโอน" };
  if (file.size > SLIP_MAX_BYTES) return { error: "ไฟล์สลิปใหญ่เกิน 4 MB" };
  const mime = (file.type || "").toLowerCase();
  if (!isAllowedSlipMime(mime)) return { error: "แนบได้เฉพาะรูป JPG PNG หรือ WebP" };
  const bytes = Buffer.from(await file.arrayBuffer());
  return { bytes, mimeType: mime, name: file.name || "slip.jpg" };
}

export async function processTransferSlip(input: {
  expectedAmount: number;
  paymentId?: string | null;
  voucherId?: string | null;
  file: SlipFileInput;
}): Promise<TransferNoticeResult> {
  const payee = getPayeeDetails();
  const now = new Date();
  const slipId = createSlipId(now);
  const rel = await saveSlipFile({
    slipId,
    bytes: input.file.bytes,
    mimeType: input.file.mimeType,
  });
  const { extracted, model } = await extractSlipFromImage({
    imageBytes: input.file.bytes,
    mimeType: input.file.mimeType,
  });
  const check = evaluateSlip(
    {
      amount: input.expectedAmount,
      promptPayId: payee.promptPayId,
      accountName: payee.accountName,
      bankAccountNo: payee.bankAccountNo,
    },
    extracted,
  );
  let status: SlipCheckStatus = check.status;
  let notes = check.notes;
  if (!model && !extracted.readable) {
    status = "pending";
    notes = "บันทึกสลิปแล้ว รอเจ้าหน้าที่ตรวจ";
  }
  insertPaymentSlip({
    slipId,
    paymentId: input.paymentId ?? null,
    voucherId: input.voucherId ?? null,
    filePath: rel,
    contentType: input.file.mimeType,
    byteSize: input.file.bytes.length,
    originalName: input.file.name,
    checkStatus: status,
    expectedAmount: input.expectedAmount,
    extractedAmount: extracted.amount,
    extractedPayee: extracted.payeeName,
    extractedPromptPay: extracted.accountOrPromptPay,
    extractedTime: extracted.transferredAt,
    extractedRef: extracted.reference,
    notes,
    model,
    createdAt: now.toISOString(),
  });
  return {
    slipId,
    checkStatus: status,
    notes,
    extractedAmount: extracted.amount,
  };
}
