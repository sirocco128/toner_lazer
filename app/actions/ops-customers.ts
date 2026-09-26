"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import { importCustomersFromCsv } from "@/lib/customer-import";
import {
  createCustomer,
  getCustomerById,
  mergeCustomers,
  upsertCustomerContact,
} from "@/lib/customer-repository";
import {
  CUSTOMER_SOURCES,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  parseCustomerTags,
  type CustomerSource,
  type CustomerStatus,
  type CustomerType,
} from "@/lib/customer-types";
import { createLineLinkToken, isLineOaEnabled } from "@/lib/line-oa";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";

function readCustomerFields(formData: FormData) {
  const status = String(formData.get("status") || "active").trim() as CustomerStatus;
  const customerType = String(formData.get("customerType") || "company").trim() as CustomerType;
  const source = String(formData.get("source") || "manual").trim() as CustomerSource;
  if (!(CUSTOMER_STATUSES as readonly string[]).includes(status)) {
    throw new Error("สถานะไม่ถูกต้อง");
  }
  if (!(CUSTOMER_TYPES as readonly string[]).includes(customerType)) {
    throw new Error("ประเภทลูกค้าไม่ถูกต้อง");
  }
  if (!(CUSTOMER_SOURCES as readonly string[]).includes(source)) {
    throw new Error("ที่มาไม่ถูกต้อง");
  }
  return {
    company: String(formData.get("company") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "") || null,
    contactName: String(formData.get("contactName") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    status,
    lineId: String(formData.get("lineId") || "") || null,
    taxId: String(formData.get("taxId") || "") || null,
    billingName: String(formData.get("billingName") || "") || null,
    billingAddress: String(formData.get("billingAddress") || "") || null,
    billingBranch: String(formData.get("billingBranch") || "") || "สำนักงานใหญ่",
    customerType,
    source,
    tags: parseCustomerTags(String(formData.get("tags") || "")),
    defaultShipProvince: String(formData.get("defaultShipProvince") || "") || null,
  };
}

export async function createCustomerOpsAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("customers.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์สร้างลูกค้า" };

  let fields;
  try {
    fields = readCustomerFields(formData);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง" };
  }
  if (!fields.company) return { ok: false, error: "กรุณาระบุชื่อบริษัท" };
  if (!fields.email) return { ok: false, error: "กรุณาระบุอีเมล" };

  let createdId = 0;
  try {
    const created = createCustomer({ ...fields, source: fields.source || "manual" });
    createdId = created.id;
    writeOpsAudit({
      actor,
      action: "customer.create",
      status: "ok",
      resourceType: "customer",
      resourceId: String(created.id),
    ...meta,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "email_taken") return { ok: false, error: "อีเมลนี้มีในระบบแล้ว" };
    return { ok: false, error: "สร้างลูกค้าไม่สำเร็จ" };
  }
  revalidatePath("/ops/customers");
  redirect(`/ops/customers/${createdId}`);
}

export async function upsertCustomerContactAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("customers.write");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์แก้ไขผู้ติดต่อ" };

  const customerId = Number(formData.get("customerId"));
  const idRaw = String(formData.get("id") || "");
  if (!Number.isFinite(customerId) || customerId <= 0) {
    return { ok: false, error: "ไม่พบลูกค้า" };
  }
  const email = String(formData.get("email") || "").trim();
  if (!email) return { ok: false, error: "กรุณาระบุอีเมลผู้ติดต่อ" };

  try {
    upsertCustomerContact({
      id: idRaw ? Number(idRaw) : undefined,
      customerId,
      name: String(formData.get("name") || "") || null,
      email,
      phone: String(formData.get("phone") || "") || null,
      lineId: String(formData.get("lineId") || "") || null,
      roleTitle: String(formData.get("roleTitle") || "") || null,
      isPrimary: String(formData.get("isPrimary") || "") === "1",
      isBilling: String(formData.get("isBilling") || "") === "1",
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "email_taken") return { ok: false, error: "อีเมลนี้ผูกกับลูกค้าอื่นแล้ว" };
    return { ok: false, error: "บันทึกผู้ติดต่อไม่สำเร็จ" };
  }

  writeOpsAudit({
    actor,
    action: "customer.contact",
    status: "ok",
    resourceType: "customer",
    resourceId: String(customerId),
    ...meta,
  });
  revalidatePath(`/ops/customers/${customerId}`);
  return { ok: true };
}

export async function mergeCustomersAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("customers.merge");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "เฉพาะผู้ดูแลที่รวมรายลูกค้าได้" };

  const sourceId = Number(formData.get("sourceId"));
  const targetId = Number(formData.get("targetId"));
  if (!sourceId || !targetId) return { ok: false, error: "เลือกลูกค้าหลักและรายที่จะยุบ" };

  let mergedId = 0;
  try {
    const merged = mergeCustomers({
      sourceId,
      targetId,
      actorEmail: actor.email,
    });
    mergedId = merged.id;
    writeOpsAudit({
      actor,
      action: "customer.merge",
      status: "ok",
      resourceType: "customer",
      resourceId: String(merged.id),
      detail: { sourceId, targetId },
    ...meta,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "self_merge") return { ok: false, error: "ไม่สามารถรวมรายเดียวกันได้" };
    return { ok: false, error: "รวมรายไม่สำเร็จ" };
  }
  revalidatePath("/ops/customers");
  revalidatePath(`/ops/customers/${mergedId}`);
  redirect(`/ops/customers/${mergedId}`);
}

export async function importCustomersAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult & { created?: number; updated?: number }> {
  const actor = await requireOpsActor("customers.import");
  const meta = await requestMeta();
  if (!actor) return { ok: false, error: "เฉพาะผู้ดูแลที่นำเข้าลูกค้าได้" };

  const file = formData.get("file");
  const pasted = String(formData.get("csv") || "");
  let text = pasted;
  if (file && typeof file !== "string" && "text" in file) {
    const uploaded = await (file as File).text();
    if (uploaded.trim()) text = uploaded;
  }
  if (!text.trim()) return { ok: false, error: "วาง CSV หรือเลือกไฟล์" };

  const dryRun = String(formData.get("dryRun") || "") === "1";
  const result = importCustomersFromCsv(text, { dryRun });
  writeOpsAudit({
    actor,
    action: "customer.import",
    status: "ok",
    resourceType: "customer",
    detail: {
      dryRun,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
    },
    ...meta,
  });
  revalidatePath("/ops/customers");
  if (dryRun) {
    return {
      ok: true,
      error: `ตรวจสอบแล้ว ${result.preview.length} แถวตัวอย่าง · ข้อผิดพลาด ${result.errors.length} รายการ`,
      created: result.created,
      updated: result.updated,
    };
  }
  if (!result.created && !result.updated) {
    return { ok: false, error: result.errors[0] || "ไม่พบแถวที่นำเข้าได้" };
  }
  return {
    ok: true,
    error: `สร้าง ${result.created} อัปเดต ${result.updated} ข้าม ${result.skipped}`,
    created: result.created,
    updated: result.updated,
  };
}

export async function createLineLinkTokenAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult & { token?: string }> {
  const actor = await requireOpsActor("customers.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์" };
  if (!isLineOaEnabled()) {
    return { ok: false, error: "ยังไม่ได้เปิด LINE OA (ตั้ง LINE_OA_ENABLED และ Channel)" };
  }
  const contactId = Number(formData.get("contactId"));
  const customerId = Number(formData.get("customerId"));
  if (!contactId) return { ok: false, error: "ไม่พบผู้ติดต่อ" };
  const customer = customerId ? getCustomerById(customerId) : null;
  if (customerId && !customer) return { ok: false, error: "ไม่พบลูกค้า" };

  const token = createLineLinkToken(contactId);
  revalidatePath(`/ops/customers/${customerId}`);
  return { ok: true, token };
}
