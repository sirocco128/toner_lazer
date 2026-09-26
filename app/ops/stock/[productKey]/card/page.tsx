import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";
import { COMPANY, formatRegisteredAddress } from "@/lib/company";
import { requireOpsPage } from "@/lib/ops-auth";
import { formatThaiDate } from "@/lib/th-billing";
import {
  buildStockCard,
  defaultStockCardPeriod,
} from "@/lib/wms-stock-card";
import { getSku } from "@/lib/sku-master-repository";
import { skuMasterTablesReady } from "@/lib/sku-master-schema";
import { listLocations } from "@/lib/wms-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ productKey: string }>;
type SearchParams = Promise<{
  from?: string;
  to?: string;
  location?: string;
}>;

function isYmd(raw: string | undefined): raw is string {
  return Boolean(raw && /^\d{4}-\d{2}-\d{2}$/.test(raw));
}

export default async function StockCardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireOpsPage("stock.read");
  const { productKey: rawKey } = await params;
  const sp = await searchParams;
  const productKey = decodeURIComponent(rawKey || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!productKey) notFound();

  const period = defaultStockCardPeriod();
  const fromYmd = isYmd(sp.from) ? sp.from : period.fromYmd;
  const toYmd = isYmd(sp.to) ? sp.to : period.toYmd;
  const location = (sp.location || "").trim() || null;

  const card = buildStockCard({
    productKey,
    locationCode: location,
    fromYmd,
    toYmd,
  });
  if (!card.productKey) notFound();

  let productName = productKey;
  try {
    if (await skuMasterTablesReady()) {
      const sku = await getSku(productKey);
      if (sku?.nameTh) productName = sku.nameTh;
    }
  } catch {
    /* optional */
  }

  const locations = listLocations();
  const backHref = `/ops/stock/${encodeURIComponent(productKey)}`;

  return (
    <DocumentPreviewShell
      backHref={backHref}
      backLabel="← กลับรายละเอียด SKU"
      fileName={`stock-card-${productKey}`}
    >
      <form
        method="get"
        className="mb-6 grid gap-3 rounded border border-forest/20 bg-paper/80 p-3 text-sm print:hidden sm:grid-cols-4"
      >
        <label className="block">
          <span className="text-xs text-ink/60">ตั้งแต่วันที่</span>
          <input
            type="date"
            name="from"
            defaultValue={fromYmd}
            className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink/60">ถึงวันที่</span>
          <input
            type="date"
            name="to"
            defaultValue={toYmd}
            className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink/60">ที่เก็บ (ว่าง = รวมทุกที่)</span>
          <select
            name="location"
            defaultValue={location || ""}
            className="mt-1 w-full rounded border border-forest/20 px-2 py-1.5"
          >
            <option value="">ทุกที่เก็บ</option>
            {locations.map((loc) => (
              <option key={loc.locationCode} value={loc.locationCode}>
                {loc.locationCode} · {loc.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded bg-forest px-3 py-2 text-paper"
          >
            แสดงบัตรคุม
          </button>
        </div>
      </form>

      <article className="max-w-full break-words text-[13px] leading-snug text-black">
        <header className="border-b-2 border-black pb-3">
          <p className="text-base font-bold">{COMPANY.legalName}</p>
          <p className="mt-0.5 text-xs">{formatRegisteredAddress()}</p>
          <p className="text-xs">
            เลขประจำตัวผู้เสียภาษีอากร {COMPANY.taxId}
          </p>
          <h1 className="mt-4 text-center text-lg font-bold tracking-wide">
            บัตรคุมสินค้า
          </h1>
          <p className="text-center text-xs text-black/70">
            STOCK CARD · บัญชีคุมสินค้าคงเหลือ
          </p>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border border-black/80 p-2 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <dt className="text-[11px] text-black/60">รหัสสินค้า</dt>
            <dd className="font-mono font-semibold">{card.productKey}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] text-black/60">ชื่อสินค้า</dt>
            <dd className="font-medium">{productName}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-black/60">หน่วยนับ</dt>
            <dd>ชิ้น</dd>
          </div>
          <div>
            <dt className="text-[11px] text-black/60">ที่เก็บ</dt>
            <dd>{card.locationCode || "ทุกที่เก็บ"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-black/60">ตั้งแต่วันที่</dt>
            <dd>{formatThaiDate(`${fromYmd}T00:00:00+07:00`)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-black/60">ถึงวันที่</dt>
            <dd>{formatThaiDate(`${toYmd}T00:00:00+07:00`)}</dd>
          </div>
        </dl>

        <table className="mt-4 w-full border-collapse border border-black text-[12px]">
          <thead>
            <tr className="bg-black/[0.04]">
              <th className="border border-black px-1.5 py-1.5 text-left font-semibold">
                วัน เดือน ปี
              </th>
              <th className="border border-black px-1.5 py-1.5 text-left font-semibold">
                เลขที่เอกสาร
              </th>
              <th className="border border-black px-1.5 py-1.5 text-left font-semibold">
                รายการ
              </th>
              <th className="border border-black px-1.5 py-1.5 text-right font-semibold">
                รับเข้า
              </th>
              <th className="border border-black px-1.5 py-1.5 text-right font-semibold">
                จ่ายออก
              </th>
              <th className="border border-black px-1.5 py-1.5 text-right font-semibold">
                คงเหลือ
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-1.5 py-1" colSpan={3}>
                ยอดยกมา
              </td>
              <td className="border border-black px-1.5 py-1 text-right">—</td>
              <td className="border border-black px-1.5 py-1 text-right">—</td>
              <td className="border border-black px-1.5 py-1 text-right font-semibold tabular-nums">
                {card.openingQty.toLocaleString("th-TH")}
              </td>
            </tr>
            {card.lines.map((line) => (
              <tr key={line.movementKey}>
                <td className="border border-black px-1.5 py-1 whitespace-nowrap">
                  {formatThaiDate(line.at)}
                </td>
                <td className="border border-black px-1.5 py-1 font-mono text-[11px]">
                  {line.docNo}
                </td>
                <td className="border border-black px-1.5 py-1">
                  {line.description}
                </td>
                <td className="border border-black px-1.5 py-1 text-right tabular-nums">
                  {line.qtyIn > 0 ? line.qtyIn.toLocaleString("th-TH") : "—"}
                </td>
                <td className="border border-black px-1.5 py-1 text-right tabular-nums">
                  {line.qtyOut > 0 ? line.qtyOut.toLocaleString("th-TH") : "—"}
                </td>
                <td className="border border-black px-1.5 py-1 text-right font-medium tabular-nums">
                  {line.balance.toLocaleString("th-TH")}
                </td>
              </tr>
            ))}
            {card.lines.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="border border-black px-1.5 py-3 text-center text-black/55"
                >
                  ไม่มีการรับ–จ่ายในช่วงที่เลือก
                </td>
              </tr>
            ) : null}
            <tr className="bg-black/[0.04]">
              <td className="border border-black px-1.5 py-1.5 font-semibold" colSpan={3}>
                ยอดยกไป
              </td>
              <td className="border border-black px-1.5 py-1.5 text-right">—</td>
              <td className="border border-black px-1.5 py-1.5 text-right">—</td>
              <td className="border border-black px-1.5 py-1.5 text-right font-bold tabular-nums">
                {card.closingQty.toLocaleString("th-TH")}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 text-[11px] text-black/65">
          หมายเหตุ: บัตรนี้สรุปจำนวนชิ้นจากระบบคลัง (WMS) — ไม่รวมการจอง/ปล่อยจองที่ไม่มีผลต่อจำนวนบนมือ
          · ใช้ประกอบบัญชีสินค้าคงเหลือภายในกิจการ
        </p>

        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs print:mt-14">
          <div>
            <p className="mb-12">ผู้จัดทำ</p>
            <p className="border-t border-black/40 pt-1">ลงชื่อ / วันที่</p>
          </div>
          <div>
            <p className="mb-12">ผู้ตรวจสอบ</p>
            <p className="border-t border-black/40 pt-1">ลงชื่อ / วันที่</p>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-black/50 print:hidden">
          <Link href={backHref} className="underline">
            กลับหน้ารายละเอียด SKU
          </Link>
        </p>
      </article>
    </DocumentPreviewShell>
  );
}
