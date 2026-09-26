"use server";

import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { saveFactoryPo } from "@/lib/factory-po-service";
import {
  FACTORY_PO_STATUSES,
  type FactoryPoStatus,
} from "@/lib/factory-po-types";

function money(form: FormData, key: string): number {
  const raw = String(form.get(key) || "").replace(/,/g, "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function text(form: FormData, key: string): string {
  return String(form.get(key) || "").trim();
}

const ERRORS: Record<string, string> = {
  order_not_found: "ไม่พบออเดอร์ลูกค้า",
  factory_name_required: "กรุณาระบุชื่อโรงงาน หรือเลือกจากทะเบียน",
  factory_not_found: "ไม่พบโรงงานในทะเบียน",
  factory_blocked: "โรงงานนี้ถูกระงับ — สั่งไม่ได้",
  po_status_locked: "ใบสั่งนี้ยกเลิกแล้ว แก้สถานะไม่ได้",
  invalid_po_transition: "เลื่อนสถานะใบสั่งโรงงานย้อนหลังไม่ได้",
};

export async function saveFactoryPoAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("factory.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์บันทึกใบสั่งโรงงาน" };

  const orderId = text(formData, "orderId");
  const poId = text(formData, "poId");
  const statusRaw = text(formData, "status") || "draft";
  if (!orderId) return { ok: false, error: "ไม่มีเลขออเดอร์" };
  if (!(FACTORY_PO_STATUSES as readonly string[]).includes(statusRaw)) {
    return { ok: false, error: "สถานะใบสั่งโรงงานไม่ถูกต้อง" };
  }

  let saved;
  try {
    saved = saveFactoryPo({
      poId: poId || undefined,
      orderId,
      status: statusRaw as FactoryPoStatus,
      factoryId: Number(text(formData, "factoryId")) || null,
      factoryName: text(formData, "factoryName"),
      factoryContact: text(formData, "factoryContact"),
      factoryPlatform: text(formData, "factoryPlatform") || "other",
      sourceOfferId: text(formData, "sourceOfferId"),
      productName: text(formData, "productName"),
      quantity: Math.floor(money(formData, "quantity")) || undefined,
      color: text(formData, "color"),
      material: text(formData, "material"),
      decorationMethod: text(formData, "decorationMethod"),
      logoPosition: text(formData, "logoPosition"),
      logoNotes: text(formData, "logoNotes"),
      packagingNotes: text(formData, "packagingNotes"),
      qcNotes: text(formData, "qcNotes"),
      factoryCurrency: text(formData, "factoryCurrency") || "CNY",
      fxCnyThb: money(formData, "fxCnyThb") || undefined,
      factoryUnitCny: money(formData, "factoryUnitCny"),
      factoryAmountCny: money(formData, "factoryAmountCny") || undefined,
      inlandThb: money(formData, "inlandThb"),
      freightThb: money(formData, "freightThb"),
      importDutyThb: money(formData, "importDutyThb"),
      customsFeeThb: money(formData, "customsFeeThb"),
      packingThb: money(formData, "packingThb"),
      lastMileThb: money(formData, "lastMileThb"),
      freightMode: text(formData, "freightMode") || null,
      shipToName: text(formData, "shipToName"),
      shipToPhone: text(formData, "shipToPhone"),
      shipToAddress: text(formData, "shipToAddress"),
      shipToProvince: text(formData, "shipToProvince"),
      trackingCn: text(formData, "trackingCn"),
      trackingTh: text(formData, "trackingTh"),
      notes: text(formData, "notes"),
      destinationMode: text(formData, "destinationMode") || "warehouse",
      receiveMode: text(formData, "receiveMode") || "cross_dock",
      asnEta: text(formData, "asnEta"),
      asnQty: (() => {
        const raw = text(formData, "asnQty");
        if (!raw) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      })(),
      asnContainer: text(formData, "asnContainer"),
      actor: actor.email,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { ok: false, error: ERRORS[code] || "บันทึกใบสั่งโรงงานไม่สำเร็จ" };
  }

  writeOpsAudit({
    actor,
    action: poId ? "factory_po.update" : "factory_po.create",
    status: "ok",
    resourceType: "factory_po",
    resourceId: saved.poId,
    detail: { orderId: saved.orderId, landed: saved.landedTotalThb, status: saved.status },
    ...meta,
  });
  revalidatePath("/ops/factory-po");
  revalidatePath(`/ops/factory-po/${saved.poId}`);
  revalidatePath(`/ops/orders/${saved.orderId}`);
  revalidatePath("/ops/finance");
  redirect(`/ops/factory-po/${saved.poId}`);
}
