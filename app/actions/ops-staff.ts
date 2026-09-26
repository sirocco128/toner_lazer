"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeOpsAudit } from "@/lib/ops-audit";
import { isOpsAuthConfigured, requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta } from "@/lib/ops-request-context";
import {
  isOpsPermission,
  isOpsRole,
  isStaffDepartment,
  type OpsPermission,
  type OpsRole,
  type StaffDepartment,
} from "@/lib/ops-roles";
import {
  createOpsStaff,
  updateOpsStaff,
} from "@/lib/ops-staff";

export type OpsStaffActionResult = {
  ok: boolean;
  error?: string;
};

function parsePermissions(formData: FormData, key: string): OpsPermission[] {
  const out: OpsPermission[] = [];
  for (const raw of formData.getAll(key)) {
    const value = String(raw || "");
    if (isOpsPermission(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

export async function createOpsStaffAction(
  _prev: OpsStaffActionResult | null,
  formData: FormData,
): Promise<OpsStaffActionResult> {
  if (!isOpsAuthConfigured()) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่าระบบเข้าใช้งาน" };
  }
  const actor = await requireOpsActor("users.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการพนักงาน" };
  const meta = await opsAuditRequestMeta();

  const email = String(formData.get("email") || "");
  const name = String(formData.get("name") || "");
  const roleRaw = String(formData.get("role") || "");
  const departmentRaw = String(formData.get("department") || "").trim();
  const password = String(formData.get("password") || "");
  const extraGrants = parsePermissions(formData, "grant");
  const extraDenies = parsePermissions(formData, "deny");
  if (!isOpsRole(roleRaw)) {
    return { ok: false, error: "เลือกบทบาทไม่ถูกต้อง" };
  }
  const role: OpsRole = roleRaw;
  const department: StaffDepartment | null = isStaffDepartment(departmentRaw)
    ? departmentRaw
    : null;

  try {
    const staff = createOpsStaff({
      email,
      name,
      role,
      department,
      password,
      extraGrants,
      extraDenies,
      createdBy: actor.email,
    });
    writeOpsAudit({
      actor,
      action: "staff.create",
      status: "ok",
      resourceType: "ops_staff",
      resourceId: String(staff.id),
      detail: { email: staff.email, role: staff.role },
      ...meta,
    });
  } catch (error) {
    writeOpsAudit({
      actor,
      action: "staff.create",
      status: "denied",
      ...meta,
      errorMessage: error instanceof Error ? error.message : "create failed",
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
    };
  }

  revalidatePath("/ops/users");
  redirect("/ops/users");
}

export async function updateOpsStaffAction(
  _prev: OpsStaffActionResult | null,
  formData: FormData,
): Promise<OpsStaffActionResult> {
  if (!isOpsAuthConfigured()) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่าระบบเข้าใช้งาน" };
  }
  const actor = await requireOpsActor("users.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการพนักงาน" };
  const meta = await opsAuditRequestMeta();

  const id = Number(formData.get("id") || 0);
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "ไม่พบพนักงาน" };
  }
  const name = String(formData.get("name") || "");
  const roleRaw = String(formData.get("role") || "");
  const departmentRaw = String(formData.get("department") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const active = formData.getAll("active").map(String).includes("1");
  const extraGrants = parsePermissions(formData, "grant");
  const extraDenies = parsePermissions(formData, "deny");
  if (!isOpsRole(roleRaw)) {
    return { ok: false, error: "เลือกบทบาทไม่ถูกต้อง" };
  }

  if (actor.staffId === id && !active) {
    return { ok: false, error: "ไม่สามารถปิดบัญชีของตัวเองได้" };
  }

  try {
    const staff = updateOpsStaff({
      id,
      name,
      role: roleRaw,
      department: isStaffDepartment(departmentRaw) ? departmentRaw : null,
      extraGrants,
      extraDenies,
      active,
      password: password || null,
    });
    writeOpsAudit({
      actor,
      action: "staff.update",
      status: "ok",
      resourceType: "ops_staff",
      resourceId: String(staff.id),
      detail: { email: staff.email, role: staff.role, active: staff.active },
      ...meta,
    });
  } catch (error) {
    writeOpsAudit({
      actor,
      action: "staff.update",
      status: "denied",
      resourceType: "ops_staff",
      resourceId: String(id),
      ...meta,
      errorMessage: error instanceof Error ? error.message : "update failed",
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
    };
  }

  revalidatePath("/ops/users");
  revalidatePath(`/ops/users/${id}`);
  redirect("/ops/users");
}
