"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OpsActionResult } from "@/app/actions/ops";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";
import { isStockClass, parseProductId } from "@/lib/sku-master-ids";
import {
  addSerial,
  createBundle,
  createColor,
  createOriWithSkus,
  createSkuForOri,
  createSkuGroup,
  moveSerialToC,
  replaceSkuTags,
  saveSkuLandedCost,
  setGroupItems,
  updateOriProduct,
  updateSku,
} from "@/lib/sku-master-repository";
import {
  deleteSkuFile,
  ingestRemoteSkuImage,
  saveSkuUpload,
  setSkuFileCover,
} from "@/lib/sku-files";
import type { ForcedMinQtyProfile } from "@/lib/alibaba/forced-min-qty";
import { parseOpsTags } from "@/lib/ops-tags";

function skuError(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code.includes("Duplicate") || code.includes("ER_DUP_ENTRY")) {
    return "รหัสนี้มีอยู่แล้ว";
  }
  if (code.startsWith("minio_put_failed")) {
    return "บันทึกเข้า MinIO ไม่สำเร็จ — ตรวจว่า MinIO และ bucket พร้อม";
  }
  const map: Record<string, string> = {
    invalid_ori: "กรุณากรอกรหัสโรงงานและชื่อสินค้า",
    invalid_color: "กรุณากรอกรหัสสีและชื่อสี",
    invalid_bundle_name: "กรุณาตั้งชื่อบันเดิล",
    invalid_bundle_price: "กรุณาใส่ราคาของรหัสบันเดิล",
    bundle_empty: "เลือกชิ้น A หรือ B อย่างน้อยหนึ่งรายการ",
    component_not_ab: "บันเดิลเลือกได้เฉพาะชิ้นคลาส A หรือ B",
    component_is_bundle: "ห้ามใส่บันเดิลซ้อนบันเดิล",
    source_not_ab: "ย้ายไป C ได้เฉพาะซีเรียลของคลาส A หรือ B",
    serial_not_on_hand: "ไม่พบซีเรียลในคลังของรหัสนี้",
    invalid_move: "กรุณากรอกซีเรียลและตำหนิ",
    invalid_clearance_price: "กรุณาใส่ราคาเคลียร์",
    missing_landed_cost: "กรุณาใส่ต้นทุนลงเรือหรือราคาโรงงาน",
    sku_not_found: "ไม่พบรหัสสินค้า",
    ori_not_found: "ไม่พบรหัสโรงงาน",
    create_c_via_move: "คลาส C สร้างจากการย้ายซีเรียลเท่านั้น",
    invalid_serial: "กรุณาใส่เลขซีเรียล",
    invalid_group: "กรุณาใส่ชื่อกลุ่ม",
    unsupported_file: "รองรับรูป jpg/png/webp/gif และไฟล์ pdf/excel/csv/zip",
    file_too_large: "ไฟล์ใหญ่เกินกำหนด (รูป 4MB ไฟล์อื่น 8MB)",
    missing_owner: "ไม่พบรหัสสินค้าที่จะแนบไฟล์",
    file_not_found: "ไม่พบไฟล์",
    not_a_photo: "ตั้งปกได้เฉพาะไฟล์รูป",
    photo_needs_sku: "ตั้งปกได้เฉพาะรูปของรหัสขาย",
    image_host_not_allowed: "ดึงรูปเข้า MinIO ได้เฉพาะโฮสต์ที่อนุญาต",
    image_fetch_failed: "ดาวน์โหลดรูปจาก URL ไม่สำเร็จ",
    minio_not_configured: "ยังไม่ได้ตั้ง MinIO — ไฟล์จะอยู่ที่ดิสก์เครื่องนี้",
  };
  return map[code] || "บันทึกไม่สำเร็จ";
}

function revalidateProducts(productId?: string, oriProductId?: number) {
  revalidatePath("/ops/products");
  revalidatePath("/ops/products/ori");
  if (productId) revalidatePath(`/ops/products/${productId}`);
  if (oriProductId) revalidatePath(`/ops/products/ori/${oriProductId}`);
}

export async function createOriAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  const meta = await requestMeta();
  try {
    const result = await createOriWithSkus({
      oriProductCode: String(formData.get("oriProductCode") || ""),
      oriProductNameTh: String(formData.get("oriProductNameTh") || ""),
      oriProductNameEng: String(formData.get("oriProductNameEng") || "") || undefined,
      colorId: Number(formData.get("colorId")) || null,
      notes: String(formData.get("notes") || "") || undefined,
      factoryId: Number(formData.get("factoryId")) || null,
      createA: String(formData.get("createA") || "") !== "0",
      createB: String(formData.get("createB") || "") !== "0",
    });
    writeOpsAudit({
      actor,
      action: "sku.ori.create",
      status: "ok",
      resourceType: "sku",
      resourceId: result.ori.oriProductCode,
      detail: { productIds: result.productIds },
    ...meta,
    });
    revalidateProducts(result.productIds[0], result.ori.oriProductId);
    redirect(`/ops/products/ori/${result.ori.oriProductId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: skuError(error) };
  }
}

export async function updateOriAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  try {
    await updateOriProduct({
      oriProductId: Number(formData.get("oriProductId")),
      oriProductNameTh: String(formData.get("oriProductNameTh") || ""),
      oriProductNameEng: String(formData.get("oriProductNameEng") || ""),
      colorId: Number(formData.get("colorId")) || null,
      notes: String(formData.get("notes") || ""),
      factoryId: Number(formData.get("factoryId")) || null,
    });
    revalidateProducts(undefined, Number(formData.get("oriProductId")));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}

export async function createSkuForOriAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  const stockClass = String(formData.get("stockClass") || "");
  if (!isStockClass(stockClass) || stockClass === "C") {
    return { ok: false, error: "สร้างได้เฉพาะคลาส A B หรือ D" };
  }
  try {
    const oriProductId = Number(formData.get("oriProductId"));
    const productId = await createSkuForOri({
      oriProductId,
      stockClass,
      sellPriceThb: Number(formData.get("sellPriceThb")) || null,
    });
    revalidateProducts(productId, oriProductId);
    redirect(`/ops/products/${productId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: skuError(error) };
  }
}

export async function updateSkuAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  try {
    const productId = String(formData.get("productId") || "");
    const sellRaw = String(formData.get("sellPriceThb") || "").trim();
    await updateSku({
      productId,
      nameTh: String(formData.get("nameTh") || ""),
      nameEn: String(formData.get("nameEn") || ""),
      sellPriceThb: sellRaw === "" ? null : Number(sellRaw),
      catalogSlug: String(formData.get("catalogSlug") || ""),
      imageUrl: String(formData.get("imageUrl") || ""),
      clearanceReason: String(formData.get("clearanceReason") || ""),
    });
    revalidateProducts(productId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}

export async function createBundleAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  const meta = await requestMeta();
  const stockClass = String(formData.get("stockClass") || "B");
  const ids = formData.getAll("componentProductId").map((item) => String(item));
  const qtys = formData.getAll("componentQty").map((item) => Number(item) || 1);
  const items = ids
    .map((componentProductId, index) => ({
      componentProductId,
      qty: qtys[index] || 1,
    }))
    .filter((item) => parseProductId(item.componentProductId));
  try {
    const productId = await createBundle({
      nameTh: String(formData.get("nameTh") || ""),
      nameEn: String(formData.get("nameEn") || "") || undefined,
      stockClass: stockClass === "A" ? "A" : "B",
      sellPriceThb: Number(formData.get("sellPriceThb")),
      items,
    });
    writeOpsAudit({
      actor,
      action: "sku.bundle.create",
      status: "ok",
      resourceType: "sku",
      resourceId: productId,
      detail: { items: items.length },
    ...meta,
    });
    revalidateProducts(productId);
    redirect(`/ops/products/${productId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: skuError(error) };
  }
}

export async function updateSkuTagsAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  try {
    const productId = String(formData.get("productId") || "");
    await replaceSkuTags(productId, parseOpsTags(String(formData.get("tags") || "")));
    revalidateProducts(productId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}

export async function createColorAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  try {
    await createColor({
      code: String(formData.get("code") || ""),
      nameTh: String(formData.get("nameTh") || ""),
      nameEn: String(formData.get("nameEn") || ""),
      hex: String(formData.get("hex") || ""),
    });
    revalidatePath("/ops/products");
    revalidatePath("/ops/products/colors");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}

export async function createGroupAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  try {
    const id = await createSkuGroup(
      String(formData.get("name") || ""),
      String(formData.get("notes") || ""),
    );
    revalidatePath("/ops/products/groups");
    redirect(`/ops/products/groups/${id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: skuError(error) };
  }
}

export async function saveGroupItemsAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  try {
    const groupId = Number(formData.get("groupId"));
    const productIds = formData.getAll("productId").map((item) => String(item));
    await setGroupItems(groupId, productIds);
    revalidatePath("/ops/products/groups");
    revalidatePath(`/ops/products/groups/${groupId}`);
    revalidatePath("/ops/products");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}

export async function addSerialAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  try {
    const productId = String(formData.get("productId") || "");
    await addSerial(productId, String(formData.get("serialNo") || ""));
    revalidateProducts(productId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}

export async function moveSerialToCAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  const meta = await requestMeta();
  try {
    const result = await moveSerialToC({
      fromProductId: String(formData.get("fromProductId") || ""),
      serialNo: String(formData.get("serialNo") || ""),
      defectReason: String(formData.get("defectReason") || ""),
      clearancePriceThb: Number(formData.get("clearancePriceThb")),
      actorEmail: actor.email,
    });
    writeOpsAudit({
      actor,
      action: "sku.move.c",
      status: "ok",
      resourceType: "sku",
      resourceId: result.toProductId,
      detail: result,
    ...meta,
    });
    revalidateProducts(result.fromProductId);
    revalidateProducts(result.toProductId);
    redirect(`/ops/products/${result.toProductId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: skuError(error) };
  }
}

export async function saveSkuCostAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("factory.read");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์ดูต้นทุนโรงงาน" };
  const productId = String(formData.get("productId") || "");
  const profileRaw = String(formData.get("profile") || "standard");
  const profile: ForcedMinQtyProfile =
    profileRaw === "corporate" ? "corporate" : "standard";
  try {
    await saveSkuLandedCost({
      productId,
      factoryUnitCny: Number(formData.get("factoryUnitCny")) || null,
      factoryUnitUsd: Number(formData.get("factoryUnitUsd")) || null,
      unitLandedCostThb: Number(formData.get("unitLandedCostThb")) || null,
      profile,
    });
    revalidateProducts(productId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}

async function fileFromForm(formData: FormData): Promise<{
  name: string;
  bytes: Buffer;
  type: string;
} | null> {
  const file = formData.get("file");
  if (!file || typeof file === "string") return null;
  const blob = file as File;
  if (!blob.size) return null;
  return {
    name: blob.name || "upload.bin",
    bytes: Buffer.from(await blob.arrayBuffer()),
    type: blob.type || "",
  };
}

export async function uploadSkuFileAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  const packed = await fileFromForm(formData);
  if (!packed) return { ok: false, error: "กรุณาเลือกไฟล์" };
  const productId = String(formData.get("productId") || "").trim() || null;
  const oriProductId = Number(formData.get("oriProductId")) || null;
  try {
    await saveSkuUpload({
      productId,
      oriProductId,
      originalName: packed.name,
      bytes: packed.bytes,
      contentType: packed.type,
      setCover: String(formData.get("setCover") || "") === "1",
    });
    revalidateProducts(productId || undefined, oriProductId || undefined);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}

export async function ingestSkuCoverAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  const productId = String(formData.get("productId") || "");
  try {
    await ingestRemoteSkuImage({
      productId,
      imageUrl: String(formData.get("imageUrl") || ""),
    });
    revalidateProducts(productId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}

export async function setSkuFileCoverAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  try {
    await setSkuFileCover(Number(formData.get("fileId")));
    revalidateProducts(
      String(formData.get("productId") || "") || undefined,
      Number(formData.get("oriProductId")) || undefined,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}

export async function deleteSkuFileAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์จัดการสินค้า" };
  try {
    await deleteSkuFile(Number(formData.get("fileId")));
    revalidateProducts(
      String(formData.get("productId") || "") || undefined,
      Number(formData.get("oriProductId")) || undefined,
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: skuError(error) };
  }
}
