import { NextRequest, NextResponse } from "next/server";
import { actorMay, requireOpsActor } from "@/lib/ops-auth";
import { isStockClass } from "@/lib/sku-master-ids";
import { listSkus } from "@/lib/sku-master-repository";
import type { StockClass } from "@/lib/sku-master-types";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";
import { parsePriceProfile } from "@/lib/sku-price-structure";
import {
  buildSkuPriceExportCsv,
  buildSkuPriceExportXlsx,
  skuPriceExportFileName,
  summarizeSkuPriceExport,
} from "@/lib/sku-price-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const actor = await requireOpsActor("catalog.write");
  if (!actor) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isSmartgiftMysqlEnabled()) {
    return NextResponse.json(
      { ok: false, error: "ยังไม่ได้เปิด SMARTGIFT_MYSQL_ENABLED" },
      { status: 503 },
    );
  }

  const sp = request.nextUrl.searchParams;
  const stockClassRaw = (sp.get("class") || "").trim();
  const stockClass: StockClass | "" = isStockClass(stockClassRaw)
    ? (stockClassRaw as StockClass)
    : "";
  const tag = (sp.get("tag") || "").trim();
  const q = (sp.get("q") || "").trim();
  const groupId = Number(sp.get("group")) || undefined;
  const profile = parsePriceProfile(sp.get("profile"));
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const canSeeCost = actorMay(actor, "factory.read");

  const skus = await listSkus({
    stockClass,
    tag: tag || undefined,
    groupId,
    q: q || undefined,
    limit: 2000,
    offset: 0,
  });

  const summary = summarizeSkuPriceExport(skus, { profile, canSeeCost });
  const fileName = skuPriceExportFileName(format);

  if (format === "csv") {
    const csv = buildSkuPriceExportCsv(skus, { profile, canSeeCost });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Export-Total": String(summary.total),
        "X-Export-Import-Ready": String(summary.importReady),
        "X-Export-Not-Ready": String(summary.notReady),
      },
    });
  }

  const xlsx = buildSkuPriceExportXlsx(skus, { profile, canSeeCost });
  return new NextResponse(new Uint8Array(xlsx), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Export-Total": String(summary.total),
      "X-Export-Import-Ready": String(summary.importReady),
      "X-Export-Not-Ready": String(summary.notReady),
    },
  });
}
