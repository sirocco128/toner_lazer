"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import {
  claimFromIssue,
  confirmCashReceipt,
  createCashReceipt,
  createClaim,
  createFixedAsset,
  createIssueTicket,
  getClaimByReceiptId,
  payFactoryForReceived,
  receiveGoods,
  rejectCashReceipt,
  setClaimStatus,
  setIssueStatus,
} from "@/lib/ops-cycle-service";
import { parseOpsTags } from "@/lib/ops-tags";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";

function text(form: FormData, key: string): string {
  return String(form.get(key) || "").trim();
}

function money(form: FormData, key: string): number {
  const raw = String(form.get(key) || "").replace(/,/g, "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const ERRORS: Record<string, string> = {
  po_not_found: "ไม่พบใบสั่งโรงงาน",
  po_not_receivable: "ใบสั่งนี้ยังรับของไม่ได้",
  qty_required: "กรุณาระบุจำนวนที่รับ",
  over_received: "รับเกินจำนวนในใบสั่งโรงงาน",
  product_key_required: "กรุณาระบุรหัสสินค้าในคลัง (เมื่อรับเข้าคลัง)",
  location_not_found: "ไม่พบที่เก็บในคลัง",
  amount_required: "กรุณาระบุยอดเงิน",
  void_blocked_by_payment: "ยกเลิกใบรับไม่ได้ เพราะจ่ายโรงงานเกินยอดรับที่เหลือ",
  pay_exceeds_received: "จ่ายเจ้าหนี้โรงงานได้ไม่เกินยอดของที่รับตาม PO",
  pay_exceeds_freight: "จ่ายเจ้าหนี้ขนส่งได้ไม่เกินยอดที่ตั้งค้าง",
  receipt_not_found: "ไม่พบใบรับสินค้า",
  payer_required: "กรุณาระบุชื่อผู้จ่าย",
  lines_required: "กรุณาระบุรายการรับอย่างน้อยหนึ่งบรรทัด",
  voucher_not_found: "ไม่พบใบรับเงิน",
  voucher_not_open: "ใบรับเงินนี้ยืนยันแล้วหรือยกเลิกแล้ว",
  reject_reason_required: "กรุณาใส่เหตุผลอย่างน้อย 4 ตัวอักษร",
  payment_already_confirmed: "รายการนี้รับเงินแล้ว ปฏิเสธไม่ได้",
  asset_name_required: "กรุณาระบุชื่อทรัพย์สิน",
  invalid_claim_against: "คู่กรณีเคลมไม่ถูกต้อง",
  reason_required: "กรุณาระบุเหตุผลเคลม",
  claim_not_found: "ไม่พบใบเคลม",
  invalid_claim_status: "สถานะเคลมไม่ถูกต้อง",
  title_required: "กรุณาระบุหัวข้อ",
  detail_required: "กรุณาระบุรายละเอียด",
  invalid_issue_status: "สถานะเรื่องไม่ถูกต้อง",
  issue_not_found: "ไม่พบเรื่องที่แจ้ง",
};

function fail(error: unknown): OpsActionResult {
  const code = error instanceof Error ? error.message : "";
  return { ok: false, error: ERRORS[code] || "บันทึกไม่สำเร็จ" };
}

function safeOpsNext(form: FormData, fallback: string): string {
  const next = String(form.get("next") || "").trim();
  if (next.startsWith("/ops/") && !next.startsWith("//") && !next.includes("\\")) {
    return next;
  }
  return fallback;
}

export async function receiveGoodsAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("factory.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์รับสินค้าเข้า" };
  let receipt;
  try {
    receipt = receiveGoods({
      poId: text(formData, "poId"),
      qtyReceived: Math.floor(money(formData, "qtyReceived")),
      qtyDamaged: Math.floor(money(formData, "qtyDamaged")),
      destination: text(formData, "destination") || undefined,
      qcNotes: text(formData, "qcNotes"),
      trackingTh: text(formData, "trackingTh"),
      productKey: text(formData, "productKey") || undefined,
      locationCode: text(formData, "locationCode") || undefined,
      receiveMode: (text(formData, "receiveMode") as "stock" | "cross_dock") || undefined,
      actor: actor.email,
    });
  } catch (error) {
    return fail(error);
  }
  writeOpsAudit({
    actor,
    action: "goods_receipt.create",
    status: "ok",
    resourceType: "goods_receipt",
    resourceId: receipt.receiptId,
    detail: { poId: receipt.poId, qty: receipt.qtyReceived, dest: receipt.destination },
    ...meta,
  });
  revalidatePath("/ops/inbound");
  revalidatePath("/ops/stock");
  revalidatePath("/ops/cycle");
  revalidatePath("/ops/assets");
  revalidatePath("/ops/claims");
  revalidatePath("/ops/pay-factory");
  revalidatePath(`/ops/factory-po/${receipt.poId}`);
  const autoClaim = getClaimByReceiptId(receipt.receiptId);
  const claimQ = autoClaim ? `&claim=${encodeURIComponent(autoClaim.claimId)}` : "";
  const orderQ = receipt.orderId
    ? `&orderId=${encodeURIComponent(receipt.orderId)}`
    : "";
  const modeQ =
    text(formData, "receiveMode") === "stock"
      ? "&mode=stock"
      : "&mode=cross_dock";
  redirect(
    `/ops/inbound?ok=${encodeURIComponent(receipt.receiptId)}${claimQ}${orderQ}${modeQ}`,
  );
}

export async function payFactoryAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("finance.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จ่ายโรงงาน" };
  let pay;
  try {
    pay = payFactoryForReceived({
      poId: text(formData, "poId"),
      amount: money(formData, "amount"),
      receiptId: text(formData, "receiptId") || null,
      method: text(formData, "method") || "bank",
      notes: text(formData, "notes"),
      actor: actor.email,
      payableKind: text(formData, "payableKind") || "factory",
    });
  } catch (error) {
    return fail(error);
  }
  writeOpsAudit({
    actor,
    action: "supplier_pay.create",
    status: "ok",
    resourceType: "supplier_payment",
    resourceId: pay.payId,
    detail: { poId: pay.poId, amount: pay.amount },
    ...meta,
  });
  revalidatePath("/ops/pay-factory");
  revalidatePath("/ops/finance");
  revalidatePath("/ops/cycle");
  redirect(`/ops/pay-factory?ok=${encodeURIComponent(pay.payId)}`);
}

export async function createCashReceiptAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("orders.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ออกใบรับเงิน" };
  const kinds = formData.getAll("kind").map((v) => String(v));
  const descriptions = formData.getAll("description").map((v) => String(v));
  const amounts = formData.getAll("amount").map((v) => Number(String(v).replace(/,/g, "")));
  const paymentIds = formData.getAll("paymentId").map((v) => String(v));
  const lineOrderIds = formData.getAll("lineOrderId").map((v) => String(v));
  const lines = kinds.map((kind, index) => ({
    kind,
    description: descriptions[index] || "",
    amount: Number.isFinite(amounts[index]) ? Number(amounts[index]) : 0,
    paymentId: paymentIds[index] || null,
    orderId: lineOrderIds[index] || null,
  }));
  let voucher;
  try {
    voucher = createCashReceipt({
      orderId: text(formData, "orderId") || null,
      payerName: text(formData, "payerName"),
      notes: text(formData, "notes"),
      tags: parseOpsTags(text(formData, "tags")),
      lines,
      actor: actor.email,
    });
  } catch (error) {
    return fail(error);
  }
  writeOpsAudit({
    actor,
    action: "cash_receipt.create",
    status: "ok",
    resourceType: "cash_receipt",
    resourceId: voucher.voucherId,
    detail: { total: voucher.totalAmount, lines: voucher.lines.length },
    ...meta,
  });
  revalidatePath("/ops/receipts");
  revalidatePath("/ops/qr-pay");
  revalidatePath("/ops/cycle");
  redirect(`/ops/receipts?ok=${encodeURIComponent(voucher.voucherId)}`);
}

export async function confirmCashReceiptAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("orders.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ยืนยันรับเงิน" };
  let voucher;
  try {
    voucher = confirmCashReceipt({
      voucherId: text(formData, "voucherId"),
      actor: actor.email,
    });
  } catch (error) {
    return fail(error);
  }
  writeOpsAudit({
    actor,
    action: "cash_receipt.confirm",
    status: "ok",
    resourceType: "cash_receipt",
    resourceId: voucher.voucherId,
    detail: { total: voucher.totalAmount },
    ...meta,
  });
  revalidatePath("/ops/receipts");
  revalidatePath("/ops/qr-pay");
  revalidatePath("/ops/orders");
  revalidatePath("/ops/approvals");
  revalidatePath("/ops/cycle");
  redirect(
    safeOpsNext(
      formData,
      `/ops/receipts?ok=${encodeURIComponent(voucher.voucherId)}`,
    ),
  );
}

export async function rejectCashReceiptAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("orders.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ปฏิเสธยอด" };
  let voucher;
  try {
    voucher = rejectCashReceipt({
      voucherId: text(formData, "voucherId"),
      actor: actor.email,
      reason: text(formData, "reason"),
    });
  } catch (error) {
    return fail(error);
  }
  writeOpsAudit({
    actor,
    action: "cash_receipt.reject",
    status: "ok",
    resourceType: "cash_receipt",
    resourceId: voucher.voucherId,
    detail: { reason: voucher.rejectReason },
    ...meta,
  });
  revalidatePath("/ops/receipts");
  revalidatePath("/ops/qr-pay");
  revalidatePath("/ops/orders");
  revalidatePath("/ops/approvals");
  revalidatePath("/ops/cycle");
  const next = safeOpsNext(formData, "");
  if (next) redirect(next);
  return { ok: true };
}

export async function confirmCashReceiptFormAction(formData: FormData): Promise<void> {
  await confirmCashReceiptAction(null, formData);
}

export async function createAssetAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("finance.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ลงทะเบียนทรัพย์" };
  let asset;
  try {
    asset = createFixedAsset({
      name: text(formData, "name"),
      qty: money(formData, "qty") || 1,
      unit: text(formData, "unit") || "ชิ้น",
      valueThb: money(formData, "valueThb"),
      location: text(formData, "location") || "office",
      notes: text(formData, "notes"),
      actor: actor.email,
    });
  } catch (error) {
    return fail(error);
  }
  writeOpsAudit({
    actor,
    action: "asset.create",
    status: "ok",
    resourceType: "asset",
    resourceId: asset.assetCode,
    detail: { name: asset.name, value: asset.valueThb },
    ...meta,
  });
  revalidatePath("/ops/assets");
  redirect(`/ops/assets?ok=${encodeURIComponent(asset.assetCode)}`);
}

export async function createClaimAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("factory.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์เปิดเคลม" };
  let claim;
  try {
    claim = createClaim({
      against: text(formData, "against") || "factory",
      reason: text(formData, "reason"),
      qty: Math.floor(money(formData, "qty")),
      amountThb: money(formData, "amountThb"),
      poId: text(formData, "poId") || null,
      orderId: text(formData, "orderId") || null,
      receiptId: text(formData, "receiptId") || null,
      issueId: text(formData, "issueId") || null,
      actor: actor.email,
    });
  } catch (error) {
    return fail(error);
  }
  writeOpsAudit({
    actor,
    action: "claim.create",
    status: "ok",
    resourceType: "claim",
    resourceId: claim.claimId,
    detail: { against: claim.against },
    ...meta,
  });
  revalidatePath("/ops/claims");
  redirect(`/ops/claims?ok=${encodeURIComponent(claim.claimId)}`);
}

export async function claimFromIssueAction(formData: FormData): Promise<void> {
  const actor = await requireOpsActor("factory.write");
  if (!actor) return;
  const meta = await requestMeta();
  const claim = claimFromIssue({
    issueId: text(formData, "issueId"),
    actor: actor.email,
  });
  writeOpsAudit({
    actor,
    action: "claim.from_issue",
    status: "ok",
    resourceType: "claim",
    resourceId: claim.claimId,
    detail: { issueId: text(formData, "issueId") },
    ...meta,
  });
  revalidatePath("/ops/claims");
  revalidatePath("/ops/issues");
  redirect(`/ops/claims?ok=${encodeURIComponent(claim.claimId)}`);
}

export async function setClaimStatusAction(formData: FormData): Promise<void> {
  const actor = await requireOpsActor("factory.write");
  if (!actor) return;
  const meta = await requestMeta();
  const claim = setClaimStatus({
    claimId: text(formData, "claimId"),
    status: text(formData, "status"),
  });
  writeOpsAudit({
    actor,
    action: "claim.status",
    status: "ok",
    resourceType: "claim",
    resourceId: claim.claimId,
    detail: { status: text(formData, "status") },
    ...meta,
  });
  revalidatePath("/ops/claims");
  redirect(`/ops/claims?ok=${encodeURIComponent(claim.claimId)}`);
}

export async function createOpsIssueAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("orders.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์รับเรื่อง" };
  let issue;
  try {
    issue = createIssueTicket({
      source: "ops",
      company: text(formData, "company"),
      contactName: text(formData, "contactName"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      orderId: text(formData, "orderId"),
      category: text(formData, "category") || "other",
      title: text(formData, "title"),
      detail: text(formData, "detail"),
    });
  } catch (error) {
    return fail(error);
  }
  writeOpsAudit({
    actor,
    action: "issue.create",
    status: "ok",
    resourceType: "issue",
    resourceId: issue.issueId,
    ...meta,
  });
  revalidatePath("/ops/issues");
  redirect(`/ops/issues?ok=${encodeURIComponent(issue.issueId)}`);
}

export async function setIssueStatusAction(formData: FormData): Promise<void> {
  const actor = await requireOpsActor("orders.write");
  if (!actor) return;
  const meta = await requestMeta();
  const issue = setIssueStatus({
    issueId: text(formData, "issueId"),
    status: text(formData, "status"),
  });
  writeOpsAudit({
    actor,
    action: "issue.status",
    status: "ok",
    resourceType: "issue",
    resourceId: issue.issueId,
    detail: { status: text(formData, "status") },
    ...meta,
  });
  revalidatePath("/ops/issues");
  redirect(`/ops/issues?ok=${encodeURIComponent(issue.issueId)}`);
}
