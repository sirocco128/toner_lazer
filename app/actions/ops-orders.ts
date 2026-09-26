"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";
import {
  confirmPayment,
  createOrderFromQuote,
  rejectPayment,
  updateOrderFulfillment,
} from "@/lib/order-service";
import {
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
} from "@/lib/order-types";
import { DEPOSIT_MODES, VAT_MODES } from "@/lib/th-billing";
import { composeOrderShipTo } from "@/lib/thai-address-format";
import { getQuoteByRequestId } from "@/lib/quote-repository";
import { assertMeetsForcedMinQty } from "@/lib/alibaba/forced-min-qty";
import { getForcedMinQtyForCatalogSlug } from "@/lib/sku-master-repository";

function safeOpsNext(formData: FormData, fallback: string): string {
  const next = String(formData.get("next") || "").trim();
  if (next.startsWith("/ops/") && !next.startsWith("//") && !next.includes("\\")) {
    return next;
  }
  return fallback;
}

export async function createOrderFromQuoteAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("orders.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์สร้างใบสั่งซื้อ" };

  const quoteRequestId = String(formData.get("quoteRequestId") || "").trim();
  const amount = Number(formData.get("amount"));
  const vatModeRaw = String(formData.get("vatMode") || "exclusive");
  const depositModeRaw = String(formData.get("depositMode") || "auto");
  const depositPercentRaw = String(formData.get("depositPercent") || "");

  if (!quoteRequestId) return { ok: false, error: "ไม่มีเลขคำขอ" };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "กรุณาระบุยอดตามใบเสนอราคา" };
  }
  if (!(VAT_MODES as readonly string[]).includes(vatModeRaw)) {
    return { ok: false, error: "รูปแบบ VAT ไม่ถูกต้อง" };
  }
  if (!(DEPOSIT_MODES as readonly string[]).includes(depositModeRaw)) {
    return { ok: false, error: "รูปแบบมัดจำไม่ถูกต้อง" };
  }

  const quantity = Number(formData.get("quantity")) || undefined;
  const quote = getQuoteByRequestId(quoteRequestId);
  if (quote) {
    const forcedMinQty = await getForcedMinQtyForCatalogSlug(quote.productSlug);
    if (forcedMinQty) {
      try {
        assertMeetsForcedMinQty(quantity ?? quote.quantity, forcedMinQty);
      } catch {
        return { ok: false, error: `จำนวนขั้นต่ำ ${forcedMinQty} ชุด ตามสูตรต้นทุนลงเรือ` };
      }
    }
  }

  let order;
  try {
    const composedShip = composeOrderShipTo({
      streetAddress: String(formData.get("streetAddress") || formData.get("shipToAddress") || ""),
      province: String(formData.get("province") || formData.get("shipToProvince") || ""),
      district: String(formData.get("district") || ""),
      subdistrict: String(formData.get("subdistrict") || ""),
      zip: String(formData.get("zip") || ""),
    });
    order = createOrderFromQuote({
      quoteRequestId,
      amount,
      vatMode: vatModeRaw as "exclusive" | "inclusive",
      depositMode: depositModeRaw as "auto" | "percent" | "full",
      depositPercent: depositPercentRaw ? Number(depositPercentRaw) : undefined,
      billingName: String(formData.get("billingName") || "") || undefined,
      billingTaxId: String(formData.get("billingTaxId") || "") || undefined,
      billingAddress: String(formData.get("billingAddress") || "") || undefined,
      billingBranch: String(formData.get("billingBranch") || "") || undefined,
      shipToName: String(formData.get("shipToName") || "") || undefined,
      shipToPhone: String(formData.get("shipToPhone") || "") || undefined,
      shipToAddress: composedShip.shipToAddress || undefined,
      shipToProvince: composedShip.shipToProvince || undefined,
      saveBillingDefaults: String(formData.get("saveBillingDefaults") || "") === "1",
      productSummary: String(formData.get("productSummary") || "") || undefined,
      notes: String(formData.get("notes") || "") || undefined,
      quantity,
      actor: actor.email,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "quote_not_ready") {
      return { ok: false, error: "ต้องเป็นสถานะส่งใบเสนอราคาแล้ว หรือปิดการขายก่อนเปิดออเดอร์" };
    }
    if (code === "quote_not_found") {
      return { ok: false, error: "ไม่พบคำขอใบเสนอราคา" };
    }
    return { ok: false, error: "สร้างออเดอร์ไม่สำเร็จ" };
  }

  writeOpsAudit({
    actor,
    action: "order.create",
    status: "ok",
    resourceType: "order",
    resourceId: order.orderId,
    detail: { quoteRequestId, total: order.totalAmount },
    ...meta,
  });
  revalidatePath("/ops/orders");
  revalidatePath(`/ops/quotes/${quoteRequestId}`);
  redirect(`/ops/orders/${order.orderId}`);
}

export async function confirmOrderPaymentAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("orders.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์รับชำระเงิน" };

  const paymentId = String(formData.get("paymentId") || "").trim();
  const orderId = String(formData.get("orderId") || "").trim();
  if (!paymentId) return { ok: false, error: "ไม่มีเลขชำระเงิน" };

  try {
    const order = confirmPayment({ paymentId, actor: actor.email });
    writeOpsAudit({
      actor,
      action: "payment.confirm",
      status: "ok",
      resourceType: "payment",
      resourceId: paymentId,
      detail: { orderId: order.orderId, paymentStatus: order.paymentStatus },
    ...meta,
    });
    revalidatePath(`/ops/orders/${order.orderId}`);
    revalidatePath("/ops/orders");
    revalidatePath("/ops/approvals");
    revalidatePath("/ops/cycle");
    const next = safeOpsNext(formData, "");
    if (next) redirect(next);
    return { ok: true };
  } catch {
    revalidatePath(orderId ? `/ops/orders/${orderId}` : "/ops/orders");
    return { ok: false, error: "ยืนยันรับชำระไม่สำเร็จ" };
  }
}

export async function rejectOrderPaymentAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("orders.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ปฏิเสธยอด" };

  const paymentId = String(formData.get("paymentId") || "").trim();
  const orderId = String(formData.get("orderId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!paymentId) return { ok: false, error: "ไม่มีเลขชำระเงิน" };

  try {
    const payment = rejectPayment({
      paymentId,
      actor: actor.email,
      reason,
    });
    writeOpsAudit({
      actor,
      action: "payment.reject",
      status: "ok",
      resourceType: "payment",
      resourceId: paymentId,
      detail: { orderId: payment.orderId, reason: payment.rejectReason },
    ...meta,
    });
    revalidatePath(`/ops/orders/${payment.orderId}`);
    revalidatePath("/ops/orders");
    revalidatePath("/ops/approvals");
    revalidatePath("/ops/cycle");
    const next = safeOpsNext(formData, "");
    if (next) redirect(next);
    return { ok: true };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    revalidatePath(orderId ? `/ops/orders/${orderId}` : "/ops/orders");
    if (code === "reject_reason_required") {
      return { ok: false, error: "กรุณาใส่เหตุผลอย่างน้อย 4 ตัวอักษร" };
    }
    if (code === "payment_already_confirmed") {
      return { ok: false, error: "รายการนี้รับเงินแล้ว ปฏิเสธไม่ได้" };
    }
    return { ok: false, error: "ปฏิเสธยอดไม่สำเร็จ" };
  }
}

export async function updateOrderFulfillmentAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("orders.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์อัปเดตสถานะสินค้า" };

  const orderId = String(formData.get("orderId") || "").trim();
  const status = String(formData.get("status") || "").trim() as FulfillmentStatus;
  if (!orderId) return { ok: false, error: "ไม่มีเลขออเดอร์" };
  if (!(FULFILLMENT_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "สถานะไม่ถูกต้อง" };
  }

  try {
    const order = updateOrderFulfillment({
      orderId,
      status,
      actor: actor.email,
    });
    writeOpsAudit({
      actor,
      action: "order.fulfillment",
      status: "ok",
      resourceType: "order",
      resourceId: orderId,
      detail: { status: order.fulfillmentStatus },
    ...meta,
    });
    revalidatePath(`/ops/orders/${orderId}`);
    revalidatePath(`/ops/orders/${orderId}/pack`);
    revalidatePath("/ops/orders");
    revalidatePath("/ops/stock");
    return { ok: true };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "deposit_required") {
      return { ok: false, error: "ต้องรับมัดจำก่อนเริ่มผลิต" };
    }
    if (code === "balance_required") {
      return { ok: false, error: "ต้องชำระส่วนที่เหลือก่อนจัดส่งลูกค้า" };
    }
    if (code === "invalid_transition" || code === "status_locked") {
      return { ok: false, error: "เลื่อนสถานะได้เฉพาะไปข้างหน้า" };
    }
    return { ok: false, error: "อัปเดตสถานะไม่สำเร็จ" };
  }
}
