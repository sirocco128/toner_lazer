"use server";

import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import { getCustomerById, updateCustomer } from "@/lib/customer-repository";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { getCashReceipt, setCashReceiptTags } from "@/lib/ops-cycle-service";
import { getOrderRepository } from "@/lib/order-repository";
import { isOpsTagEntityType, parseOpsTags } from "@/lib/ops-tags";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";

export async function updateEntityTagsAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const entityTypeRaw = String(formData.get("entityType") || "").trim();
  const entityId = String(formData.get("entityId") || "").trim();
  const tags = parseOpsTags(String(formData.get("tags") || ""));

  if (!isOpsTagEntityType(entityTypeRaw) || !entityId) {
    return { ok: false, error: "ไม่พบรายการที่จะติดแท็ก" };
  }

  const permission =
    entityTypeRaw === "customer" ? "customers.write" : "orders.write";
  const actor = await requireOpsActor(permission);
  const meta = await requestMeta();
  if (!actor) {
    return { ok: false, error: "ไม่มีสิทธิ์แก้แท็ก" };
  }

  if (entityTypeRaw === "customer") {
    const id = Number(entityId);
    const existing = Number.isFinite(id) ? getCustomerById(id) : null;
    if (!existing) return { ok: false, error: "ไม่พบลูกค้า" };
    updateCustomer({ id: existing.id, tags });
    revalidatePath("/ops/customers");
    revalidatePath(`/ops/customers/${existing.id}`);
  } else if (entityTypeRaw === "order") {
    const order = getOrderRepository().getOrderByOrderId(entityId);
    if (!order) return { ok: false, error: "ไม่พบออเดอร์" };
    getOrderRepository().updateOrderTags(order.orderId, tags);
    revalidatePath("/ops/orders");
    revalidatePath(`/ops/orders/${order.orderId}`);
  } else {
    const voucher = getCashReceipt(entityId);
    if (!voucher) return { ok: false, error: "ไม่พบใบรับเงิน" };
    setCashReceiptTags(voucher.voucherId, tags);
    revalidatePath("/ops/receipts");
  }

  writeOpsAudit({
    actor,
    action: "tags.update",
    status: "ok",
    resourceType: entityTypeRaw,
    resourceId: entityId,
    detail: { tags },
    ...meta,
  });

  return { ok: true };
}
