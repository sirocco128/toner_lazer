import Link from "next/link";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";
import { requireOpsPage } from "@/lib/ops-auth";
import { countOriProducts, listOriProducts } from "@/lib/sku-master-repository";
import { OpsProductSubnav } from "@/components/OpsProductSubnav";
import { SkuClassBadge } from "@/components/SkuClassBadge";
import { SkuThumb } from "@/components/SkuThumb";
import { OpsPager } from "@/components/OpsPager";
import {
  OPS_LIST_PAGE_SIZE,
  opsPageWindow,
  parseOpsPage,
} from "@/lib/ops-pagination";
import { parseProductId } from "@/lib/sku-master-ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function OriProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("catalog.write");
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const mysqlOn = isSmartgiftMysqlEnabled();

  let error = "";
  let rows: Awaited<ReturnType<typeof listOriProducts>> = [];
  let pageWindow = opsPageWindow(0, 1);
  try {
    if (!mysqlOn) {
      error = "ยังไม่ได้เปิด SMARTGIFT_MYSQL_ENABLED";
    } else {
      const total = await countOriProducts({ q });
      pageWindow = opsPageWindow(total, parseOpsPage(sp.page), OPS_LIST_PAGE_SIZE);
      rows = await listOriProducts({
        q,
        limit: pageWindow.pageSize,
        offset: pageWindow.offset,
      });
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "เชื่อม SmartGift MySQL ไม่ได้";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">รหัสโรงงาน</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        ตัวตนโรงงาน เช่น nt0001 — คนละชุดกับรหัสขาย A/B/C/D และคนละชุดกับทะเบียนโรงงาน FAC0001
        สีที่เห็นคือสีสินค้า ไม่ใช่ธีมเว็บ
      </p>
      <div className="mt-4">
        <OpsProductSubnav current="ori" />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/ops/products/new" className="rounded bg-forest px-3 py-1.5 text-paper">
          เพิ่มรหัสโรงงาน
        </Link>
      </div>

      {error ? (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <form className="mt-4 flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นรหัสโรงงาน / ชื่อ / รหัสขาย"
          className="min-w-[12rem] flex-1 rounded border border-forest/20 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-forest px-3 py-2 text-sm text-paper">
          ค้นหา
        </button>
      </form>

      {rows.length === 0 && !error ? (
        <p className="mt-6 rounded-xl border border-forest/10 px-4 py-8 text-center text-sm text-ink/60">
          {q ? "ไม่พบรหัสโรงงานที่ตรงคำค้น" : "ยังไม่มีรหัสโรงงาน"}
        </p>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {rows.map((row) => (
              <li key={row.oriProductId} className="rounded-xl border border-forest/10 bg-paper p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <SkuThumb src={row.displayImageUrl} alt={row.oriProductNameTh} />
                  {row.colorHex ? (
                    <span
                      className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-forest/20"
                      style={{ backgroundColor: row.colorHex }}
                      title={row.colorNameTh || row.colorHex}
                    />
                  ) : (
                    <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-dashed border-forest/20 bg-forest-mist" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/ops/products/ori/${row.oriProductId}`}
                      className="font-mono text-forest underline-offset-2 hover:underline"
                    >
                      {row.oriProductCode}
                    </Link>
                    <p className="font-medium">{row.oriProductNameTh}</p>
                    <p className="text-xs text-ink/55">
                      {row.oriProductNameEng || "—"}
                      {row.colorNameTh ? ` · ${row.colorNameTh}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(row.skuIds || []).map((productId) => {
                        const parsed = parseProductId(productId);
                        return (
                          <Link
                            key={productId}
                            href={`/ops/products/${productId}`}
                            className="inline-flex items-center gap-1 rounded-full border border-forest/10 px-2 py-0.5"
                          >
                            {parsed ? <SkuClassBadge stockClass={parsed.stockClass} /> : null}
                            <span className="font-mono text-xs text-ink/70">{productId}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <OpsPager pathname="/ops/products/ori" params={{ q: q || undefined }} window={pageWindow} />
        </>
      )}
    </div>
  );
}
