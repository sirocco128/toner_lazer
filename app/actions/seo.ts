"use server";

import { revalidatePath } from "next/cache";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";
import {
  isAllowedSeoPath,
  normalizeSeoPath,
} from "@/lib/page-seo";
import {
  isValidSeoDescription,
  isValidSeoTitle,
} from "@/lib/seo-limits";
import { upsertSeoOverride, deleteSeoOverride } from "@/lib/seo-repository";
import type { OpsActionResult } from "@/app/actions/ops";

function parseNoIndex(value: FormDataEntryValue | null): boolean {
  return value === "1" || value === "true" || value === "on";
}

export async function savePageSeoAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("seo.write");
  const meta = await requestMeta();
  if (!actor) {
    return { ok: false, error: "ไม่มีสิทธิ์แก้ SEO" };
  }

  const path = normalizeSeoPath(String(formData.get("path") || ""));
  const seoTitle = String(formData.get("seoTitle") || "").trim();
  const metaDescription = String(formData.get("metaDescription") || "").trim();
  const ogImage = String(formData.get("ogImage") || "").trim();
  const keywords = String(formData.get("keywords") || "").trim();
  const noIndex = parseNoIndex(formData.get("noIndex"));

  if (!isAllowedSeoPath(path)) {
    return { ok: false, error: "หน้านี้อยู่นอกรายการที่แก้ SEO ได้" };
  }
  if (!isValidSeoTitle(seoTitle)) {
    return { ok: false, error: "ชื่อเรื่องต้องยาว 8–60 ตัวอักษร" };
  }
  if (!isValidSeoDescription(metaDescription)) {
    return { ok: false, error: "คำอธิบายต้องยาว 120–160 ตัวอักษร" };
  }

  try {
    upsertSeoOverride({
      path,
      seoTitle,
      metaDescription,
      ogImage: ogImage || null,
      keywords: keywords || null,
      noIndex,
      actorEmail: actor.email,
      actorName: actor.name,
    });
  } catch (error) {
    writeOpsAudit({
      actor,
      action: "seo.save",
      status: "denied",
      resourceType: "page",
      resourceId: path,
    ...meta,
      errorMessage: error instanceof Error ? error.message : "save failed",
    });
    return { ok: false, error: "บันทึกไม่สำเร็จ ตรวจว่า migrate ฐานข้อมูลแล้ว" };
  }

  writeOpsAudit({
    actor,
    action: "seo.save",
    status: "ok",
    resourceType: "page",
    resourceId: path,
    detail: { seoTitle },
    ...meta,
  });
  revalidatePath(path);
  revalidatePath("/sitemap.xml");
  return { ok: true };
}

export async function resetPageSeoAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("seo.write");
  const meta = await requestMeta();
  if (!actor) {
    return { ok: false, error: "ไม่มีสิทธิ์แก้ SEO" };
  }
  const path = normalizeSeoPath(String(formData.get("path") || ""));
  if (!isAllowedSeoPath(path)) {
    return { ok: false, error: "หน้านี้อยู่นอกรายการที่แก้ SEO ได้" };
  }
  deleteSeoOverride(path);
  writeOpsAudit({
    actor,
    action: "seo.reset",
    status: "ok",
    resourceType: "page",
    resourceId: path,
    ...meta,
  });
  revalidatePath(path);
  revalidatePath("/sitemap.xml");
  return { ok: true };
}
