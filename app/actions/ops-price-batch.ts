"use server";

import { revalidatePath } from "next/cache";
import { writeOpsAudit, recordOpsReportPull } from "@/lib/ops-audit";
import { actorMay, requireOpsActor } from "@/lib/ops-auth";
import { opsAuditRequestMeta } from "@/lib/ops-request-context";
import {
  applyPriceBatch,
  buildPriceBatchPreview,
  defaultPriceBatchConfig,
  deletePriceConfig,
  getPriceBatchForActor,
  listPriceConfigs,
  parseFactoryProducts,
  parsePriceBatchConfig,
  previewRowsToCsv,
  savePriceBatch,
  savePriceConfig,
  stripCostFromRows,
  type PriceBatchConfig,
  type PriceBatchPreviewRow,
  type PriceBatchSummary,
  type PriceConfigRecord,
} from "@/lib/ops-price-batch";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";

export type {
  PriceBatchConfig,
  PriceBatchPreviewRow,
  PriceBatchSummary,
  PriceConfigRecord,
};

export type PriceBatchPreviewResult =
  | {
      ok: true;
      batch: PriceBatchSummary;
      rows: PriceBatchPreviewRow[];
      config: PriceBatchConfig;
      canApply: boolean;
      mysqlOn: boolean;
    }
  | { ok: false; error: string };

export async function listPriceConfigsAction(): Promise<PriceConfigRecord[]> {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return [];
  return listPriceConfigs();
}

export async function savePriceConfigAction(raw: {
  name: string;
  config: Record<string, unknown>;
  asDefault?: boolean;
}): Promise<{ ok: true; config: PriceConfigRecord } | { ok: false; error: string }> {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์" };
  const name = String(raw.name || "").trim();
  if (!name) return { ok: false, error: "ตั้งชื่อชุดเงื่อนไขก่อน" };
  const config = parsePriceBatchConfig(raw.config);
  const saved = savePriceConfig(name, config, actor, Boolean(raw.asDefault));
  writeOpsAudit({
    actor,
    action: "price_config.save",
    status: "ok",
    resourceType: "ops_price_config",
    resourceId: String(saved.id),
    detail: { name },
  });
  return { ok: true, config: saved };
}

export async function deletePriceConfigAction(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์" };
  deletePriceConfig(id);
  return { ok: true };
}

export async function previewPriceBatchAction(raw: {
  fileName?: string;
  config?: Record<string, unknown>;
  configId?: number;
  products: unknown;
}): Promise<PriceBatchPreviewResult> {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์คิดราคา" };
  const products = parseFactoryProducts(raw.products);
  if (products.length === 0) {
    return { ok: false, error: "ไม่พบแถวสินค้าในไฟล์" };
  }
  const config = parsePriceBatchConfig(raw.config);
  const rows = await buildPriceBatchPreview(actor, products, config);
  const batch = savePriceBatch({
    actor,
    fileName: String(raw.fileName || "workbook").slice(0, 180),
    config,
    configId: Number(raw.configId) || undefined,
    products,
    rows,
  });
  writeOpsAudit({
    actor,
    action: "price_batch.preview",
    status: "ok",
    resourceType: "ops_price_batch",
    resourceId: String(batch.id),
    detail: {
      fileName: batch.fileName,
      rowCount: batch.rowCount,
      matchedCount: batch.matchedCount,
    },
  });
  return {
    ok: true,
    batch,
    rows: stripCostFromRows(rows, actorMay(actor, "factory.read")),
    config,
    canApply: actorMay(actor, "catalog.write"),
    mysqlOn: isSmartgiftMysqlEnabled(),
  };
}

export async function exportPriceBatchCsvAction(
  batchId: number,
): Promise<{ ok: true; csv: string; fileName: string } | { ok: false; error: string }> {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์" };
  const batch = getPriceBatchForActor(batchId, actor);
  if (!batch) return { ok: false, error: "ไม่พบชุดพรีวิว" };
  const canSeeCost = actorMay(actor, "factory.read");
  recordOpsReportPull({
    actor,
    kind: "export",
    reportName: "price-preview.csv",
    filters: { batchId },
    context: await opsAuditRequestMeta(),
  });
  return {
    ok: true,
    csv: previewRowsToCsv(batch.rows, canSeeCost),
    fileName: `price-preview-${batchId}.csv`,
  };
}

export async function applyPriceBatchAction(raw: {
  batchId: number;
  codes: string[];
  confirm: string;
}): Promise<
  | { ok: true; updated: number; skipped: number }
  | { ok: false; error: string }
> {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์อัปเดตราคาบนเว็บ" };
  if (String(raw.confirm || "").trim() !== "อัปเดต") {
    return { ok: false, error: "พิมพ์คำว่า อัปเดต เพื่อยืนยัน" };
  }
  const codes = Array.isArray(raw.codes)
    ? raw.codes.map((c) => String(c).trim()).filter(Boolean)
    : [];
  if (codes.length === 0) {
    return { ok: false, error: "ยังไม่ได้เลือกแถวที่จะส่ง" };
  }
  try {
    const result = await applyPriceBatch({
      actor,
      batchId: Number(raw.batchId),
      codes,
    });
    writeOpsAudit({
      actor,
      action: "price_batch.apply",
      status: "ok",
      resourceType: "ops_price_batch",
      resourceId: String(raw.batchId),
      detail: result,
    });
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/ops/pricing");
    revalidatePath("/ops/pricing/import");
    revalidatePath("/ops/price-sheet");
    return { ok: true, ...result };
  } catch (err) {
    const error = err instanceof Error ? err.message : "อัปเดตไม่สำเร็จ";
    writeOpsAudit({
      actor,
      action: "price_batch.apply",
      status: "denied",
      resourceType: "ops_price_batch",
      resourceId: String(raw.batchId),
      errorMessage: error,
    });
    return { ok: false, error };
  }
}

export async function getDefaultPriceConfigAction(): Promise<PriceBatchConfig> {
  const actor = await requireOpsActor("quotes.read");
  if (!actor) return defaultPriceBatchConfig();
  const saved = listPriceConfigs().find((row) => row.isDefault);
  return saved?.config ?? defaultPriceBatchConfig();
}
