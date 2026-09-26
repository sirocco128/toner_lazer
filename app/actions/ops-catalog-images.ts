"use server";

import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import { extractOfferImages } from "@/lib/alibaba/images";
import {
  normalizeAlibabaListingUrl,
  type SourceImageCandidate,
  type SourcePlatform,
} from "@/lib/alibaba/listing-urls";
import {
  deleteCatalogSourceImage,
  saveCatalogSourceImage,
  slugLooksSafe,
} from "@/lib/catalog-source-images";
import { requireOpsSession } from "@/lib/ops-auth";

function parseCandidate(raw: unknown): SourceImageCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const pageUrl = normalizeAlibabaListingUrl(String(rec.pageUrl || ""));
  const imageUrl = extractOfferImages(String(rec.imageUrl || "")).at(0);
  const platform = rec.platform === "alibaba" ? "alibaba" : rec.platform === "1688" ? "1688" : null;
  if (!pageUrl || !imageUrl || !platform) return null;
  return {
    title: String(rec.title || "").trim() || pageUrl,
    platform: platform as SourcePlatform,
    pageUrl,
    imageUrl,
  };
}

export async function saveCatalogImagesAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  if (!(await requireOpsSession())) {
    return { ok: false, error: "ไม่มีสิทธิ์บันทึกรูป" };
  }

  const query = String(formData.get("query") || "").trim().slice(0, 200);
  const productSlugRaw = String(formData.get("productSlug") || "").trim();
  const productSlug = productSlugRaw && slugLooksSafe(productSlugRaw) ? productSlugRaw : null;
  const geminiModel = String(formData.get("geminiModel") || "").trim() || null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("selected") || "[]"));
  } catch {
    return { ok: false, error: "ข้อมูลรูปไม่ถูกต้อง" };
  }
  const rows = Array.isArray(parsed) ? parsed : [];
  const candidates = rows
    .map(parseCandidate)
    .filter((item): item is SourceImageCandidate => Boolean(item))
    .slice(0, 8);

  if (candidates.length === 0) {
    return { ok: false, error: "ยังไม่ได้เลือกรูปจากเว็บโรงงาน" };
  }

  let saved = 0;
  for (const candidate of candidates) {
    const record = await saveCatalogSourceImage({
      candidate,
      query: query || candidate.title,
      productSlug,
      geminiModel,
    });
    if (record) saved += 1;
  }

  if (saved === 0) {
    return { ok: false, error: "ดาวน์โหลดรูปจากเว็บจริงไม่สำเร็จ" };
  }

  revalidatePath("/ops/catalog-images");
  return { ok: true };
}

export async function deleteCatalogImageAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  if (!(await requireOpsSession())) {
    return { ok: false, error: "ไม่มีสิทธิ์ลบรูป" };
  }
  const imageId = String(formData.get("imageId") || "").trim();
  if (!/^CSI-[A-F0-9]{12}$/.test(imageId)) {
    return { ok: false, error: "ไม่พบรูป" };
  }
  const removed = await deleteCatalogSourceImage(imageId);
  if (!removed) return { ok: false, error: "ลบไม่สำเร็จ" };
  revalidatePath("/ops/catalog-images");
  return { ok: true };
}
