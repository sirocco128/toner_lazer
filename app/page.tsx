import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogSkeleton } from "@/components/CatalogSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { PriceDisclaimer } from "@/components/PriceDisclaimer";
import { metadataForPath } from "@/lib/page-seo";
import { getPublicContact } from "@/lib/public-contact";
import { buildWebSiteJsonLd } from "@/lib/seo";
import { getPublicCatalog } from "@/lib/strapi";
import { site } from "@/lib/site";
import {
  TONER_BUY_STEPS,
  TONER_HERO_BODY,
  TONER_PROMISE,
  TONER_SERVICE_POINTS,
  TONER_TAGLINE_EN,
} from "@/lib/toner-copy";
import {
  CATALOG_EMPTY_BODY,
  CATALOG_EMPTY_TITLE,
  CATALOG_UNAVAILABLE_BODY,
  CATALOG_UNAVAILABLE_TITLE,
} from "@/lib/ux-copy";

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/");
}

export default function HomePage() {
  const contact = getPublicContact(site);

  return (
    <>
      <JsonLd data={buildWebSiteJsonLd()} />
      <section className="border-b border-forest/10 bg-forest-mist">
        <div className="mx-auto max-w-content px-page py-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brass">
            {TONER_TAGLINE_EN}
          </p>
          <p className="mt-3 text-sm font-bold tracking-wide text-forest sm:text-base">
            {site.name}
          </p>
          <h1 className="mt-2 max-w-3xl font-display text-fluid-2xl font-bold leading-tight tracking-tight text-forest">
            {TONER_PROMISE}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-ink/75 sm:text-lg">{TONER_HERO_BODY}</p>
          <form action="/toner" method="get" className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <label htmlFor="home-toner-q" className="sr-only">
              รุ่นเครื่องพิมพ์หรือรหัสตลับ
            </label>
            <input
              id="home-toner-q"
              name="q"
              placeholder="พิมพ์รุ่นเครื่องพิมพ์ เช่น HP M1132 หรือ 85A"
              className="min-h-11 flex-1 rounded-full border border-forest/20 bg-paper px-5 text-base text-ink outline-none focus:border-brass"
              autoComplete="off"
            />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-paper transition hover:bg-brass-soft"
            >
              ค้นหาตลับหมึก
            </button>
          </form>
          <div className="mt-4">
            <Link href="/contact" className="text-sm font-semibold text-forest underline-offset-2 hover:underline">
              หรือขอใบเสนอราคาสำหรับหน่วยงาน →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-content px-page py-14 sm:py-16">
        <h2 className="text-2xl font-bold text-forest sm:text-3xl">ทำไมหน่วยงานเลือกเรา</h2>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TONER_SERVICE_POINTS.map((item) => (
            <li key={item.title} className="rounded-2xl border border-forest/10 bg-paper p-6">
              <h3 className="text-lg font-semibold text-forest">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/75">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <Suspense fallback={<div className="mx-auto max-w-content px-page py-16"><CatalogSkeleton cards={3} /></div>}>
        <HomeFeatured />
      </Suspense>

      <section className="mx-auto max-w-content px-page py-14 sm:py-16">
        <h2 className="text-2xl font-bold text-forest sm:text-3xl">สั่งซื้อ 3 ขั้นตอน</h2>
        <ol className="mt-8 grid gap-5 sm:grid-cols-3">
          {TONER_BUY_STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-forest/10 bg-paper p-6">
              <p className="text-sm font-semibold text-brass">ขั้นที่ {index + 1}</p>
              <h3 className="mt-1 text-lg font-semibold text-forest">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/75">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-content px-page pb-16">
        <div className="rounded-3xl bg-brass px-5 py-10 text-paper shadow-lift sm:px-10 sm:py-12">
          <h2 className="text-2xl font-bold sm:text-3xl">ขอใบเสนอราคาสำหรับหน่วยงาน</h2>
          <p className="mt-3 max-w-xl text-paper/90">
            แจ้งรุ่นเครื่องพิมพ์และจำนวน ทีมขายส่งใบเสนอราคาพร้อมเอกสารสำหรับจัดซื้อ
            หน้านี้ไม่ใช่การสั่งซื้อ และไม่มีการชำระเงินบนเว็บ
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-paper px-6 text-sm font-semibold text-forest"
            >
              กรอกแบบฟอร์มขอราคา
            </Link>
            {contact.showLine ? (
              <a
                href={site.lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-paper/35 px-6 text-sm font-semibold text-paper"
              >
                หรือแชท LINE {site.lineId}
              </a>
            ) : (
              <Link
                href="/about"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-paper/35 px-6 text-sm font-semibold text-paper"
              >
                เกี่ยวกับบริษัท
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

async function HomeFeatured() {
  const { products, unavailable } = await getPublicCatalog();
  const featured = products.slice(0, 3);
  return (
    <section className="bg-forest-mist/50 py-16">
      <div className="mx-auto max-w-content px-page">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-forest sm:text-3xl">รุ่นที่สั่งบ่อย</h2>
          <p className="mt-3 text-ink/75">
            ตลับหมึกเลเซอร์เทียบเท่ารุ่นยอดนิยม — กดเข้าไปดูรายละเอียดแล้วขอราคา
          </p>
        </div>
        {featured.length === 0 ? (
          <EmptyState
            title={unavailable ? CATALOG_UNAVAILABLE_TITLE : CATALOG_EMPTY_TITLE}
            description={unavailable ? CATALOG_UNAVAILABLE_BODY : CATALOG_EMPTY_BODY}
          />
        ) : (
          <>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((product) => (
                <li key={product.slug}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
            <PriceDisclaimer className="mt-6" />
            <div className="mt-8">
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 bg-paper px-6 text-sm font-semibold text-forest"
              >
                ดูสินค้าทั้งหมด
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
