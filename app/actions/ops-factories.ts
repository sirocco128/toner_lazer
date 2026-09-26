"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";
import { saveFactory } from "@/lib/factory-registry-service";

function text(form: FormData, key: string): string {
  return String(form.get(key) || "").trim();
}

function optionalNumber(form: FormData, key: string): number | null {
  const raw = text(form, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const ERRORS: Record<string, string> = {
  factory_name_required: "กรุณาใส่ชื่อโรงงาน",
  factory_code_required: "กรุณาใส่รหัสโรงงาน",
  factory_code_too_long: "รหัสโรงงานยาวเกิน 32 ตัว",
  factory_code_is_sku: "ห้ามใช้รหัสขาย A00001 / B00001 / C00003 เป็นรหัสโรงงาน",
  factory_code_taken: "รหัสโรงงานนี้มีอยู่แล้ว",
  factory_not_found: "ไม่พบทะเบียนโรงงาน",
};

export async function saveFactoryAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("factory.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์บันทึกทะเบียนโรงงาน" };
  const meta = await requestMeta();
  const id = Number(text(formData, "id")) || undefined;

  let saved;
  try {
    saved = saveFactory({
      id,
      factoryCode: text(formData, "factoryCode"),
      name: text(formData, "name"),
      nameCn: text(formData, "nameCn"),
      legalName: text(formData, "legalName"),
      platform: text(formData, "platform") || "other",
      shopUrl: text(formData, "shopUrl"),
      shopId: text(formData, "shopId"),
      origin: text(formData, "origin"),
      city: text(formData, "city"),
      address: text(formData, "address"),
      contactName: text(formData, "contactName"),
      wechat: text(formData, "wechat"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      defaultCurrency: text(formData, "defaultCurrency") || "CNY",
      paymentTerms: text(formData, "paymentTerms"),
      bankName: text(formData, "bankName"),
      bankAccount: text(formData, "bankAccount"),
      alipay: text(formData, "alipay"),
      moqNotes: text(formData, "moqNotes"),
      leadDays: optionalNumber(formData, "leadDays"),
      qcNotes: text(formData, "qcNotes"),
      status: text(formData, "status") || "active",
      notes: text(formData, "notes"),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { ok: false, error: ERRORS[code] || "บันทึกทะเบียนโรงงานไม่สำเร็จ" };
  }

  writeOpsAudit({
    actor,
    action: id ? "factory.update" : "factory.create",
    status: "ok",
    resourceType: "factory",
    resourceId: saved.factoryCode,
    detail: { id: saved.id, name: saved.name },
    ...meta,
  });
  revalidatePath("/ops/factories");
  revalidatePath(`/ops/factories/${saved.id}`);
  revalidatePath("/ops/factory-po");
  revalidatePath("/ops/products/ori");
  redirect(`/ops/factories/${saved.id}`);
}
