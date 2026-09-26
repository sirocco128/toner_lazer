import Link from "next/link";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";
import { requireOpsPage } from "@/lib/ops-auth";
import { isStockClass } from "@/lib/sku-master-ids";
import {
  STOCK_CLASS_SHORT,
  type StockClass,
} from "@/lib/sku-master-types";
import {
  countSkus,
  countSkusByClass,
  listSkuGroups,
  listSkuTagSuggestions,
  listSkus,
} from "@/lib/sku-master-repository";
import { SkuClassBadge } from "@/components/SkuClassBadge";
import { SkuThumb } from "@/components/SkuThumb";
import { OpsProductSubnav } from "@/components/OpsProductSubnav";
import { TagChips } from "@/components/TagChips";
import { OpsPager } from "@/components/OpsPager";
import {
  OPS_LIST_PAGE_SIZE,
  opsPageHref,
  opsPageWindow,
  parseOpsPage,
} from "@/lib/ops-pagination";
import {
  parsePriceProfile,
  skuPriceStructure,
} from "@/lib/sku-price-structure";
import { cn } from "@/lib/utils";
import {
  SkuPriceLadderCells,
  SkuPriceLadderCompact,
  SkuPriceLadderHeaders,
  SkuPriceStructureLegend,
} from "@/components/SkuPriceStructure";
import { PriceRoundTripGuide } from "@/components/PriceRoundTripGuide";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{
  class?: string;
  tag?: string;
  group?: string;
  q?: string;
  page?: string;
  profile?: string;
}>;

export default async function OpsProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("catalog.write");
  const sp = await searchParams;
  const mysqlOn = isSmartgiftMysqlEnabled();
  const stockClass: StockClass | "" = isStockClass(sp.class || "")
    ? (sp.class as StockClass)
    : "";
  const tag = (sp.tag || "").trim();
  const q = (sp.q || "").trim();
  const groupId = Number(sp.group) || undefined;
  const priceProfile = parsePriceProfile(sp.profile);
  const filter = { stockClass, tag, groupId, q };

  let error = "";
  let rows: Awaited<ReturnType<typeof listSkus>> = [];
  let groups: Awaited<ReturnType<typeof listSkuGroups>> = [];
  let tags: string[] = [];
  let total = 0;
  let classCounts: Record<StockClass, number> = { A: 0, B: 0, C: 0, D: 0 };
  let pageWindow = opsPageWindow(0, 1);
  try {
    if (!mysqlOn) {
      error = "ยังไม่ได้เปิด SMARTGIFT_MYSQL_ENABLED";
    } else {
      [total, classCounts, groups, tags] = await Promise.all([
        countSkus(filter),
        countSkusByClass({ tag, groupId, q }),
        listSkuGroups(),
        listSkuTagSuggestions(),
      ]);
      pageWindow = opsPageWindow(total, parseOpsPage(sp.page), OPS_LIST_PAGE_SIZE);
      rows = await listSkus({
        ...filter,
        limit: pageWindow.pageSize,
        offset: pageWindow.offset,
      });
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "เชื่อม SmartGift MySQL ไม่ได้";
  }

  const filterParams = {
    class: stockClass || undefined,
    tag: tag || undefined,
    group: groupId ? String(groupId) : undefined,
    q: q || undefined,
    profile: priceProfile === "corporate" ? "corporate" : undefined,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">รหัสขาย</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        A พร้อมส่ง · B สั่งผลิต · C เคลียร์ · D ซัพสำรอง — รหัสโรงงานคนละตัวกับรหัสขาย
        ตารางขวาคือบันไดราคาตามต้นทุนที่ใส่ไว้
      </p>
      <div className="mt-4">
        <OpsProductSubnav current="sku" />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/ops/products/new" className="rounded bg-forest px-3 py-1.5 text-paper">
          เพิ่มรหัสโรงงาน
        </Link>
        <Link href="/ops/products/bundle/new" className="rounded border border-forest/30 px-3 py-1.5">
          สร้างบันเดิล
        </Link>
        <Link href="/ops/products/colors" className="rounded border border-forest/30 px-3 py-1.5">
          สี
        </Link>
        <Link href="/ops/products/groups" className="rounded border border-forest/30 px-3 py-1.5">
          กลุ่ม
        </Link>
        <Link href="/ops/pricing" className="rounded border border-forest/30 px-3 py-1.5">
          คิดทีละชุด
        </Link>
        <Link href="/ops/price-sheet" className="rounded border border-forest/30 px-3 py-1.5">
          ชีตราคา 3 แท็บ
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <a
          href={opsPageHref(
            "/api/ops/products/export-prices",
            {
              class: stockClass || undefined,
              tag: tag || undefined,
              group: sp.group || undefined,
              q: q || undefined,
              profile: priceProfile === "corporate" ? "corporate" : undefined,
            },
            1,
          )}
          className="rounded bg-forest px-3 py-1.5 font-medium text-paper"
        >
          ดาวน์โหลด Excel (.xlsx)
        </a>
        <Link
          href="/ops/pricing/import"
          className="rounded border border-forest px-3 py-1.5 font-medium text-forest"
        >
          อัปเดตราคาจาก Excel →
        </Link>
      </div>

      <PriceRoundTripGuide variant="products" />

      {error ? (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="กรองคลาส">
        <Link
          href={opsPageHref("/ops/products", { ...filterParams, class: undefined }, 1)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm",
            !stockClass
              ? "border-forest bg-forest text-paper"
              : "border-forest/20 bg-paper text-ink/70",
          )}
        >
          ทั้งหมด {Object.values(classCounts).reduce((sum, n) => sum + n, 0)}
        </Link>
        {(["A", "B", "C", "D"] as const).map((cls) => (
          <Link
            key={cls}
            href={opsPageHref("/ops/products", { ...filterParams, class: cls }, 1)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              stockClass === cls
                ? "border-forest bg-forest text-paper"
                : "border-forest/20 bg-paper text-ink/70",
            )}
          >
            {cls} {STOCK_CLASS_SHORT[cls]} {classCounts[cls]}
          </Link>
        ))}
      </nav>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="โปรไฟล์คิดราคา">
          <Link
            href={opsPageHref("/ops/products", { ...filterParams, profile: undefined }, 1)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              priceProfile === "standard"
                ? "border-forest bg-forest text-paper"
                : "border-forest/20 bg-paper text-ink/70",
            )}
          >
            ทั่วไป 10–1000
          </Link>
          <Link
            href={opsPageHref("/ops/products", { ...filterParams, profile: "corporate" }, 1)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              priceProfile === "corporate"
                ? "border-forest bg-forest text-paper"
                : "border-forest/20 bg-paper text-ink/70",
            )}
          >
            องค์กร 100–1000
          </Link>
        </nav>
        <SkuPriceStructureLegend profile={priceProfile} className="max-w-xl" />
      </div>

      <form className="mt-4 flex flex-wrap gap-2" method="get">
        {stockClass ? <input type="hidden" name="class" value={stockClass} /> : null}
        {priceProfile === "corporate" ? (
          <input type="hidden" name="profile" value="corporate" />
        ) : null}
        <select name="tag" defaultValue={tag} className="rounded border border-forest/20 px-3 py-2 text-sm">
          <option value="">ทุกแท็ก</option>
          {tags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select name="group" defaultValue={sp.group || ""} className="rounded border border-forest/20 px-3 py-2 text-sm">
          <option value="">ทุกกลุ่ม</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นรหัส / ชื่อ / ori"
          className="min-w-[12rem] flex-1 rounded border border-forest/20 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-forest px-3 py-2 text-sm text-paper">
          ค้นหา
        </button>
      </form>

      {rows.length > 0 &&
      rows.every((row) => {
        const prices = skuPriceStructure(row, priceProfile);
        return prices.kind === "empty" || prices.steps.length === 0;
      }) ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          ยังไม่มีบันไดราคาในตาราง — ใส่ต้นทุนที่หน้ารหัส หรือ{" "}
          <a
            href={opsPageHref(
              "/api/ops/products/export-prices",
              {
                class: stockClass || undefined,
                tag: tag || undefined,
                group: sp.group || undefined,
                q: q || undefined,
                profile: priceProfile === "corporate" ? "corporate" : undefined,
              },
              1,
            )}
            className="font-medium underline-offset-2 hover:underline"
          >
            ดาวน์โหลด Excel
          </a>{" "}
          แล้วอัปที่อัปเดตราคาจาก Excel
        </p>
      ) : null}

      {rows.length === 0 && !error ? (
        <p className="mt-6 rounded-xl border border-forest/10 px-4 py-8 text-center text-sm text-ink/60">
          {q || tag || groupId || stockClass
            ? "ไม่พบรหัสที่ตรงตัวกรอง — ลองล้างคำค้นหรือเปลี่ยนคลาส"
            : "ยังไม่มีรหัสสินค้า — เริ่มจากเพิ่มรหัสโรงงาน"}
        </p>
      ) : (
        <>
          <ul className="mt-6 space-y-3 md:hidden">
            {rows.map((row) => {
              const prices = skuPriceStructure(row, priceProfile);
              return (
              <li key={row.productId} className="flex gap-3 rounded-xl border border-forest/10 p-4">
                <SkuThumb src={row.displayImageUrl} alt={row.nameTh} />
                <div className="min-w-0">
                  <Link
                    href={`/ops/products/${row.productId}`}
                    className="font-mono text-sm text-forest underline-offset-2 hover:underline"
                  >
                    {row.productId}
                  </Link>
                  <div className="mt-1">
                    <SkuClassBadge stockClass={row.stockClass} bundle={row.isBundle} />
                  </div>
                  <p className="mt-1 font-medium">{row.nameTh}</p>
                  <p className="text-xs text-ink/60">
                    {row.oriProductCode || "ไม่มี ori"}
                    {row.colorNameTh ? ` · ${row.colorNameTh}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink/55">
                    {row.stockClass === "B" && row.onHandQty === 0
                      ? "สั่งผลิต ไม่มีของในคลัง"
                      : `ในคลัง ${row.onHandQty}`}
                    {prices.forcedMinQty ? ` · ขั้นต่ำ ${prices.forcedMinQty}` : ""}
                  </p>
                  <SkuPriceLadderCompact structure={prices} />
                </div>
              </li>
              );
            })}
          </ul>

          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/15 text-ink/60">
                  <th className="py-2 pr-3">รูป</th>
                  <th className="py-2 pr-3">รหัส</th>
                  <th className="py-2 pr-3">คลาส</th>
                  <th className="py-2 pr-3">ชื่อ</th>
                  <th className="py-2 pr-3">โรงงาน</th>
                  <th className="py-2 pr-3">คลัง</th>
                  <th className="py-2 pr-3">ขั้นต่ำ</th>
                  <SkuPriceLadderHeaders />
                  <th className="py-2 pr-3">แท็ก</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const prices = skuPriceStructure(row, priceProfile);
                  return (
                  <tr key={row.productId} className="border-b border-forest/10">
                    <td className="py-2 pr-3">
                      <SkuThumb src={row.displayImageUrl} alt={row.nameTh} className="h-10 w-10" />
                    </td>
                    <td className="py-2 pr-3 font-mono">
                      <Link
                        href={`/ops/products/${row.productId}`}
                        className="text-forest underline-offset-2 hover:underline"
                      >
                        {row.productId}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      <SkuClassBadge stockClass={row.stockClass} bundle={row.isBundle} />
                    </td>
                    <td className="max-w-[16rem] truncate py-2 pr-3" title={row.nameTh}>
                      {row.nameTh}
                    </td>
                    <td className="py-2 pr-3">
                      {row.oriProductCode ? (
                        row.oriProductId ? (
                          <Link
                            href={`/ops/products/ori/${row.oriProductId}`}
                            className="text-forest underline-offset-2 hover:underline"
                          >
                            {row.oriProductCode}
                          </Link>
                        ) : (
                          row.oriProductCode
                        )
                      ) : (
                        "—"
                      )}
                      {row.colorNameTh ? ` · ${row.colorNameTh}` : ""}
                    </td>
                    <td className="py-2 pr-3">
                      {row.stockClass === "B" && row.onHandQty === 0
                        ? "สั่งผลิต"
                        : row.onHandQty}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {prices.forcedMinQty ?? "—"}
                      {prices.kind === "fixed" && prices.sellPriceThb != null ? (
                        <span className="mt-0.5 block text-xs text-ink/55">
                          {prices.sellPriceThb.toLocaleString("th-TH")}
                        </span>
                      ) : null}
                    </td>
                    <SkuPriceLadderCells structure={prices} />
                    <td className="py-2 pr-3">
                      <TagChips tags={row.tags} hrefBase="/ops/products?tag=" />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <OpsPager pathname="/ops/products" params={filterParams} window={pageWindow} />
        </>
      )}
    </div>
  );
}
