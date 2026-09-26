"use server";

import { revalidatePath } from "next/cache";
import { applyLegalHold, releaseLegalHold } from "@/lib/object-legal-hold";
import { isOpsAuthConfigured, requireOpsActor } from "@/lib/ops-auth";

export type OpsHoldActionResult = { ok: boolean; error?: string };

function thaiError(code: string): string {
  if (code === "purpose_required") return "กรอกเหตุผลอย่างน้อย 3 ตัวอักษร";
  if (code === "missing_key") return "ใส่กุญแจไฟล์ เช่น slips/SLP-1.jpg";
  if (code === "already_held") return "ไฟล์นี้ถูกพักลบอยู่แล้ว";
  if (code === "not_held") return "ไม่พบการพักลบที่ยังมีผล";
  if (code === "same_actor_release") return "ผู้พักลบปลดเองไม่ได้ — ให้ผู้ใช้อื่นที่เป็นผู้ดูแลปลด";
  return code;
}

export async function applyLegalHoldAction(
  _prev: OpsHoldActionResult | null,
  formData: FormData,
): Promise<OpsHoldActionResult> {
  if (!isOpsAuthConfigured()) return { ok: false, error: "ยังไม่ได้ตั้งค่าระบบเข้าใช้งาน" };
  const actor = await requireOpsActor("documents.hold");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์พักลบเอกสาร" };
  try {
    await applyLegalHold({
      actor,
      objectKey: String(formData.get("objectKey") || ""),
      reason: String(formData.get("reason") || ""),
      caseRef: String(formData.get("caseRef") || ""),
    });
    revalidatePath("/ops/holds");
    revalidatePath("/ops/audit");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: thaiError(err instanceof Error ? err.message : "hold_failed"),
    };
  }
}

export async function releaseLegalHoldAction(
  _prev: OpsHoldActionResult | null,
  formData: FormData,
): Promise<OpsHoldActionResult> {
  if (!isOpsAuthConfigured()) return { ok: false, error: "ยังไม่ได้ตั้งค่าระบบเข้าใช้งาน" };
  const actor = await requireOpsActor("documents.hold.release");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ปลดการพักลบ" };
  try {
    await releaseLegalHold({
      actor,
      objectKey: String(formData.get("objectKey") || ""),
      reason: String(formData.get("reason") || ""),
    });
    revalidatePath("/ops/holds");
    revalidatePath("/ops/audit");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: thaiError(err instanceof Error ? err.message : "release_failed"),
    };
  }
}
