"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import { COMPANY } from "@/lib/company";
import {
  buildDropshipDraft,
  isDropshipStatus,
  parseDropshipLines,
} from "@/lib/dropship";
import { createDropshipOrder, setDropshipStatus } from "@/lib/dropship-repository";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";
import { getOrderBundle } from "@/lib/order-service";
import { tonerPricingConfigFromEnv } from "@/lib/toner-catalog";

function text(form: FormData, key: string): string {
  return String(form.get(key) || "").trim();
}

const ERRORS: Record<string, string> = {
  lines_required: "กรุณาใส่รายการอย่างน้อยหนึ่งบรรทัด เช่น 85A x 5",
  too_many_lines: "ใส่ได้ไม่เกิน 30 บรรทัดต่อใบ",
  ship_to_name_required: "กรุณาระบุชื่อผู้รับ",
  ship_to_phone_invalid: "เบอร์โทรผู้รับไม่ถูกต้อง",
  ship_to_address_required: "กรุณาระบุที่อยู่จัดส่งให้ครบ",
  order_not_found: "ไม่พบออเดอร์ที่ระบุ",
  dropship_not_found: "ไม่พบใบสั่งส่งตรง",
  invalid_transition: "เปลี่ยนสถานะนี้ไม่ได้",
  tracking_required: "กรุณาใส่เลขพัสดุก่อนบันทึกว่าส่งแล้ว",
};

function fail(error: unknown): OpsActionResult {
  const code = error instanceof Error ? error.message : "";
  const [key, detail] = code.split(":");
  if (key === "line_format") return { ok: false, error: `บรรทัดที่ ${detail} อ่านไม่ออก ใช้รูปแบบ รุ่น x จำนวน` };
  if (key === "qty_invalid") return { ok: false, error: `จำนวนในบรรทัดที่ ${detail} ไม่ถูกต้อง` };
  if (key === "unknown_toner") return { ok: false, error: `ไม่พบรุ่น "${detail}" ในแคตตาล็อก หรือพบหลายรุ่น` };
  return { ok: false, error: ERRORS[key || ""] || "บันทึกไม่สำเร็จ" };
}

export async function createDropshipAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("factory.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์สร้างใบสั่งส่งตรง" };
  const meta = await requestMeta();

  let created;
  try {
    const orderId = text(formData, "orderId") || null;
    let shipTo = {
      name: text(formData, "shipToName"),
      phone: text(formData, "shipToPhone"),
      address: text(formData, "shipToAddress"),
      province: text(formData, "shipToProvince") || null,
    };
    if (orderId) {
      const bundle = getOrderBundle(orderId);
      if (!bundle) throw new Error("order_not_found");
      const o = bundle.order;
      shipTo = {
        name: shipTo.name || o.shipToName || o.contactName || o.company,
        phone: shipTo.phone || o.shipToPhone || o.phone,
        address: shipTo.address || o.shipToAddress || o.billingAddress || "",
        province: shipTo.province || o.shipToProvince,
      };
    }
    const draft = buildDropshipDraft({
      orderId,
      shipTo,
      lines: parseDropshipLines(text(formData, "lines")),
      notes: text(formData, "notes") || null,
      pricing: tonerPricingConfigFromEnv(process.env),
    });
    created = createDropshipOrder(draft, actor.email);
  } catch (error) {
    return fail(error);
  }

  writeOpsAudit({
    actor,
    action: "dropship.create",
    status: "ok",
    resourceType: "dropship",
    resourceId: created.dropshipId,
    detail: { orderId: created.orderId, qty: created.totalQty, brand: COMPANY.brandName },
    ...meta,
  });
  revalidatePath("/ops/dropship");
  redirect(`/ops/dropship?ok=${encodeURIComponent(created.dropshipId)}#${created.dropshipId}`);
}

export async function setDropshipStatusAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("factory.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์แก้ใบสั่งส่งตรง" };
  const meta = await requestMeta();
  const status = text(formData, "status");
  if (!isDropshipStatus(status)) return { ok: false, error: "สถานะไม่ถูกต้อง" };

  let updated;
  try {
    updated = setDropshipStatus({
      dropshipId: text(formData, "dropshipId"),
      status,
      trackingNo: text(formData, "trackingNo") || null,
      carrier: text(formData, "carrier") || null,
    });
  } catch (error) {
    return fail(error);
  }

  writeOpsAudit({
    actor,
    action: "dropship.status",
    status: "ok",
    resourceType: "dropship",
    resourceId: updated.dropshipId,
    detail: { status: updated.status, trackingNo: updated.trackingNo },
    ...meta,
  });
  revalidatePath("/ops/dropship");
  redirect(`/ops/dropship?ok=${encodeURIComponent(updated.dropshipId)}#${updated.dropshipId}`);
}
