"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";
import {
  adjustStock,
  postCycleCount,
  transferStock,
} from "@/lib/wms-service";
import { voidGoodsReceipt } from "@/lib/ops-cycle-service";

function text(form: FormData, key: string): string {
  return String(form.get(key) || "").trim();
}

function intVal(form: FormData, key: string): number {
  const n = Number(String(form.get(key) || "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

const ERRORS: Record<string, string> = {
  product_key_required: "กรุณาระบุรหัสสินค้าในคลัง",
  qty_required: "กรุณาระบุจำนวน",
  insufficient_stock: "สต็อกไม่พอ",
  location_not_found: "ไม่พบที่เก็บ",
  same_location: "ที่เก็บต้นทางและปลายทางซ้ำกัน",
  receipt_not_found: "ไม่พบใบรับสินค้า",
  void_blocked_by_payment: "ยกเลิกใบรับไม่ได้ เพราะจ่ายโรงงานเกินยอดรับที่เหลือ",
  wms_locations_missing: "ยังไม่มีที่เก็บในระบบคลัง — รัน migrate ก่อน",
};

function fail(error: unknown): OpsActionResult {
  const code = error instanceof Error ? error.message : "";
  return { ok: false, error: ERRORS[code] || "บันทึกไม่สำเร็จ" };
}

export async function adjustStockAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("stock.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ปรับสต็อก" };
  const meta = await requestMeta();
  const productKey = text(formData, "productKey");
  try {
    const bal = adjustStock({
      productKey,
      qtyDelta: intVal(formData, "qtyDelta"),
      locationCodeOrId: text(formData, "locationCode") || undefined,
      memo: text(formData, "memo") || undefined,
      actor: actor.email,
    });
    writeOpsAudit({
      actor,
      action: "stock.adjust",
      status: "ok",
      resourceType: "wms_balance",
      resourceId: bal.productKey,
      detail: { qtyOnHand: bal.qtyOnHand, locationId: bal.locationId },
      ...meta,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/ops/stock");
  revalidatePath("/ops/stock/movements");
  revalidatePath("/ops/stock/adjust");
  if (productKey) {
    revalidatePath(`/ops/stock/${encodeURIComponent(productKey)}`);
  }
  redirect("/ops/stock/adjust?ok=1");
}

export async function transferStockAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("stock.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์โอนสต็อก" };
  const meta = await requestMeta();
  try {
    transferStock({
      productKey: text(formData, "productKey"),
      qty: intVal(formData, "qty"),
      fromLocationCodeOrId: text(formData, "fromLocation"),
      toLocationCodeOrId: text(formData, "toLocation"),
      memo: text(formData, "memo") || undefined,
      actor: actor.email,
    });
    writeOpsAudit({
      actor,
      action: "stock.transfer",
      status: "ok",
      resourceType: "wms_balance",
      resourceId: text(formData, "productKey"),
      detail: {
        qty: intVal(formData, "qty"),
        from: text(formData, "fromLocation"),
        to: text(formData, "toLocation"),
      },
      ...meta,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/ops/stock");
  revalidatePath("/ops/stock/movements");
  revalidatePath("/ops/stock/adjust");
  redirect("/ops/stock/adjust?ok=xfer");
}

export async function cycleCountAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("stock.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ตรวจนับ" };
  const meta = await requestMeta();
  let countId = "";
  try {
    const row = postCycleCount({
      productKey: text(formData, "productKey"),
      qtyCounted: intVal(formData, "qtyCounted"),
      locationCodeOrId: text(formData, "locationCode") || undefined,
      memo: text(formData, "memo") || undefined,
      actor: actor.email,
    });
    countId = row.countId;
    writeOpsAudit({
      actor,
      action: "stock.cycle_count",
      status: "ok",
      resourceType: "wms_cycle_count",
      resourceId: row.countId,
      detail: { variance: row.qtyVariance, productKey: row.productKey },
      ...meta,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/ops/stock");
  revalidatePath("/ops/stock/counts");
  revalidatePath("/ops/stock/movements");
  redirect(`/ops/stock/counts?ok=${encodeURIComponent(countId)}`);
}

export async function voidGoodsReceiptAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("factory.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ยกเลิกใบรับ" };
  const meta = await requestMeta();
  let receiptId = text(formData, "receiptId");
  try {
    const row = voidGoodsReceipt({ receiptId, actor: actor.email });
    receiptId = row.receiptId;
    writeOpsAudit({
      actor,
      action: "goods_receipt.void",
      status: "ok",
      resourceType: "goods_receipt",
      resourceId: row.receiptId,
      detail: { poId: row.poId },
      ...meta,
    });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/ops/inbound");
  revalidatePath("/ops/stock");
  revalidatePath("/ops/stock/movements");
  redirect(`/ops/inbound?voided=${encodeURIComponent(receiptId)}`);
}
