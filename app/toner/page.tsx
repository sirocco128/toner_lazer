import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { metadataForPath } from "@/lib/page-seo";
import {
  TONER_BRAND_LABEL,
  TONER_CATALOG,
  findToner,
  priceToner,
  tonerPricingConfigFromEnv,
  tonerProductName,
  type TonerBrand,
  type TonerItem,
} from "@/lib/toner-catalog";

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/toner");
}

type TonerPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const EXAMPLES = ["HP M1132", "85A", "DCP-L2540DW", "TN-3350", "M2070"];

function firstParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw || "").trim().slice(0, 60);
}

function formatBaht(n: number): string {
  return new Intl.NumberFormat("th-TH").format(n);
}

function quoteHref(item: TonerItem): string {
  const params = new URLSearchParams({
    productInterest: tonerProductName(item),
    productSlug: item.sku.toLowerCase(),
    quantity: "1",
  });
  return `/contact?${params.toString()}`;
}

function TonerCard({ item }: { item: TonerItem }) {
  const price = priceToner(item, tonerPricingConfigFromEnv(process.env)).direct;
  const perPage = item.yieldPages ? price / item.yieldPages : null;
  return (
    <li className="flex h-full flex-col rounded-2xl border border-forest/10 bg-paper p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-brass">
        {TONER_BRAND_LABEL[item.brand]} · {item.oemCode}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-forest">{tonerProductName(item)}</h3>
      <p className="mt-2 text-sm text-ink/70">
        ใช้กับ: {item.compatiblePrinters.join(", ")}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink/60">พิมพ์ได้ประมาณ</dt>
          <dd className="font-semibold text-forest">
            {item.yieldPages ? `${formatBaht(item.yieldPages)} แผ่น` : "ตามผลทดสอบ"}
          </dd>
        </div>
        <div>
          <dt className="text-ink/60">ราคาต่อตลับ</dt>
          <dd className="font-semibold text-forest">
            {formatBaht(price)} บาท
            {perPage != null ? (
              <span className="block text-xs font-normal text-ink/60">
                ≈ {perPage.toFixed(2)} บาท/หน้า
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
      <div className="mt-auto pt-5">
        <Link
          href={quoteHref(item)}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brass px-5 text-sm font-semibold text-paper transition hover:bg-brass-soft"
        >
          ขอใบเสนอราคารุ่นนี้
        </Link>
      </div>
    </li>
  );
}

export default async function TonerFinderPage({ searchParams }: TonerPageProps) {
  const params = await searchParams;
  const q = firstParam(params.q);
  const results = q ? findToner(q) : [];
  const brands = [...new Set(TONER_CATALOG.map((t) => t.brand))] as TonerBrand[];

  return (
    <div className="mx-auto max-w-content px-page py-12 sm:py-16">
      <Breadcrumbs items={[{ label: "ค้นหาหมึกตามรุ่นเครื่อง" }]} />
      <h1 className="text-3xl font-bold text-forest sm:text-4xl">
        ค้นหาตลับหมึกจากรุ่นเครื่องพิมพ์
      </h1>
      <p className="mt-4 max-w-2xl text-ink/80">
        พิมพ์รุ่นเครื่องพิมพ์ รหัสตลับ หรือรหัสของแท้ แล้วขอใบเสนอราคาได้ทันที
        ราคาเป็นราคาสำหรับหน่วยงาน ยืนยันราคาและจำนวนในใบเสนอราคา
      </p>

      <form action="/toner" method="get" className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
        <label htmlFor="toner-q" className="sr-only">
          รุ่นเครื่องพิมพ์หรือรหัสตลับ
        </label>
        <input
          id="toner-q"
          name="q"
          defaultValue={q}
          placeholder="เช่น HP M1132 หรือ 85A"
          className="min-h-11 flex-1 rounded-full border border-forest/20 bg-paper px-5 text-base text-ink outline-none focus:border-brass"
          autoComplete="off"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-6 text-sm font-semibold text-paper"
        >
          ค้นหา
        </button>
      </form>
      <p className="mt-3 text-sm text-ink/60">
        ตัวอย่าง:{" "}
        {EXAMPLES.map((ex, i) => (
          <span key={ex}>
            {i > 0 ? " · " : ""}
            <Link href={`/toner?q=${encodeURIComponent(ex)}`} className="text-brass underline-offset-2 hover:underline">
              {ex}
            </Link>
          </span>
        ))}
      </p>

      {q ? (
        <section className="mt-10" aria-live="polite">
          <h2 className="text-xl font-bold text-forest">
            ผลการค้นหา “{q}” — {results.length} รุ่น
          </h2>
          {results.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-forest/10 bg-forest-mist/40 p-6 text-ink/80">
              ยังไม่พบรุ่นนี้ในรายการ เรามีตลับเทียบเท่าเกือบทุกยี่ห้อ{" "}
              <Link
                href={`/contact?${new URLSearchParams({ productInterest: `ตลับหมึกสำหรับ ${q}` }).toString()}`}
                className="font-semibold text-brass underline-offset-2 hover:underline"
              >
                ส่งรุ่นเครื่องให้ทีมขายหาให้
              </Link>
            </div>
          ) : (
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((item) => (
                <TonerCard key={item.sku} item={item} />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {brands.map((brand) => (
        <section key={brand} className="mt-14">
          <h2 className="text-2xl font-bold text-forest">
            หมึกเทียบเท่าสำหรับ {TONER_BRAND_LABEL[brand]}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TONER_CATALOG.filter((t) => t.brand === brand).map((item) => (
              <TonerCard key={item.sku} item={item} />
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-12 max-w-3xl text-xs text-ink/60">
        ชื่อรุ่นและเครื่องหมายการค้า HP, Brother, Samsung ใช้เพื่อระบุเครื่องพิมพ์ที่ใช้ได้เท่านั้น
        สินค้าเป็นตลับหมึกเทียบเท่า ไม่ใช่สินค้าของเจ้าของเครื่องหมายการค้า
      </p>
    </div>
  );
}
