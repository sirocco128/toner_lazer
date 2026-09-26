"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  updateCustomer,
  getCustomerById,
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
import { writeOpsAudit } from "@/lib/ops-audit";
import {
  authenticateOpsUser,
  clearOpsSessionCookie,
  isOpsAuthConfigured,
  requireOpsActor,
  setOpsSessionCookie,
} from "@/lib/ops-auth";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";
import { updateQuoteOps } from "@/lib/quote-repository";
import type { LeadStatus } from "@/lib/quote-types";
import { LEAD_STATUSES } from "@/lib/quote-types";

export type OpsActionResult = {
  ok: boolean;
  error?: string;
};

export async function opsLoginAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const meta = await requestMeta();
  if (!isOpsAuthConfigured()) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่า ADMIN_SESSION_SECRET และรหัสผ่าน" };
  }
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const actor = authenticateOpsUser(email, password);
  if (!actor) {
    writeOpsAudit({
      action: "login",
      status: "denied",
      detail: { email: email.trim().toLowerCase() || null },
      ...meta,
      errorMessage: "invalid credentials",
    });
    return { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }
  await setOpsSessionCookie(actor);
  writeOpsAudit({
    actor,
    action: "login",
    status: "ok",
    ...meta,
  });
  redirect("/ops/quotes");
}

export async function opsLogoutAction(): Promise<void> {
  const actor = await requireOpsActor();
  const meta = await requestMeta();
  if (actor) {
    writeOpsAudit({
      actor,
      action: "logout",
      status: "ok",
      ...meta,
    });
  }
  await clearOpsSessionCookie();
  redirect("/ops/login");
}

export async function updateQuoteOpsAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("quotes.write");
  const meta = await requestMeta();
  if (!actor) {
    return { ok: false, error: "ไม่มีสิทธิ์แก้ไขใบเสนอราคา" };
  }

  const requestId = String(formData.get("requestId") || "").trim();
  const leadStatus = String(formData.get("leadStatus") || "").trim() as LeadStatus;
  const note = String(formData.get("salesNotes") || "").trim();

  if (!requestId) return { ok: false, error: "ไม่มีเลขคำขอ" };
  if (!(LEAD_STATUSES as readonly string[]).includes(leadStatus)) {
    return { ok: false, error: "สถานะไม่ถูกต้อง" };
  }

  const updated = updateQuoteOps({
    requestId,
    leadStatus,
    salesNotes: note || undefined,
    timelineNote: note || null,
    actor: {
      email: actor.email,
      name: actor.name,
      role: actor.role,
    },
  });
  if (!updated) return { ok: false, error: "ไม่พบคำขอ" };

  writeOpsAudit({
    actor,
    action: "quote.update",
    status: "ok",
    resourceType: "quote",
    resourceId: requestId,
    detail: {
      leadStatus,
      note: note || null,
    },
    ...meta,
  });

  revalidatePath("/ops/quotes");
  revalidatePath(`/ops/quotes/${requestId}`);
  if (updated.customerId) {
    revalidatePath(`/ops/customers/${updated.customerId}`);
  }
  return { ok: true };
}

export async function updateCustomerOpsAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("customers.write");
  const meta = await requestMeta();
  if (!actor) {
    return { ok: false, error: "ไม่มีสิทธิ์แก้ไขลูกค้า" };
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: "ไม่พบลูกค้า" };
  }

  const status = String(formData.get("status") || "").trim() as CustomerStatus;
  if (!(CUSTOMER_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "สถานะไม่ถูกต้อง" };
  }

  const existing = getCustomerById(id);
  if (!existing) return { ok: false, error: "ไม่พบลูกค้า" };

  const customerType = String(formData.get("customerType") || existing.customerType).trim();
  const source = String(formData.get("source") || existing.source).trim();
  if (!(CUSTOMER_TYPES as readonly string[]).includes(customerType)) {
    return { ok: false, error: "ประเภทลูกค้าไม่ถูกต้อง" };
  }
  if (!(CUSTOMER_SOURCES as readonly string[]).includes(source)) {
    return { ok: false, error: "ที่มาไม่ถูกต้อง" };
  }

  updateCustomer({
    id,
    company: String(formData.get("company") || existing.company),
    phone: String(formData.get("phone") || "") || null,
    contactName: String(formData.get("contactName") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    status,
    lineId: String(formData.get("lineId") || "") || null,
    taxId: String(formData.get("taxId") || "") || null,
    billingName: String(formData.get("billingName") || "") || null,
    billingAddress: String(formData.get("billingAddress") || "") || null,
    billingBranch: String(formData.get("billingBranch") || "") || existing.billingBranch,
    customerType: customerType as CustomerType,
    source: source as CustomerSource,
    tags: parseCustomerTags(String(formData.get("tags") || "")),
    defaultShipProvince: String(formData.get("defaultShipProvince") || "") || null,
  });

  writeOpsAudit({
    actor,
    action: "customer.update",
    status: "ok",
    resourceType: "customer",
    resourceId: String(id),
    detail: { status },
    ...meta,
  });

  revalidatePath("/ops/customers");
  revalidatePath(`/ops/customers/${id}`);
  return { ok: true };
}
