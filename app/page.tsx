import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogSkeleton } from "@/components/CatalogSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { PriceDisclaimer } from "@/components/PriceDisclaimer";
import { ProcessSteps } from "@/components/ProcessSteps";
import { SmartGiftMethod } from "@/components/SmartGiftMethod";
import { SMART_GIFT_PROMISE, SMART_GIFT_TAGLINE_EN } from "@/lib/smart-gift-method";
import { metadataForPath } from "@/lib/page-seo";
import { getPublicContact } from "@/lib/public-contact";
import { buildWebSiteJsonLd } from "@/lib/seo";
import { IDEA_THEMES, ideaThemePath } from "@/lib/seo-themes";
import { getPublicCatalog } from "@/lib/strapi";
import { site } from "@/lib/site";
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
        <div className="mx-auto grid max-w-content items-center gap-8 px-page py-10 sm:py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brass">
              {SMART_GIFT_TAGLINE_EN}
            </p>
            <p className="mt-3 text-sm font-bold tracking-wide text-forest sm:text-base">
              {site.name}
            </p>
            <h1 className="mt-2 max-w-3xl font-display text-fluid-2xl font-bold leading-tight tracking-tight text-forest">
              {SMART_GIFT_PROMISE}
            </h1>
            <p className="mt-4 max-w-xl text-base text-ink/75 sm:text-lg">
              สกรีนโลโก้และสั่งผลิตตามแบบจากจีน —
              ปรึกษาหรือขอใบเสนอราคาได้โดยยังไม่ชำระเงินบนเว็บ
            </p>
            <div className="mt-8 flex flex-wrap gap-3 max-lg:mb-2">
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-paper transition hover:bg-brass-soft"
              >
                ปรึกษาหรือขอใบเสนอราคา
              </Link>
              <Link
                href="/premium-giftset"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 bg-paper px-6 text-sm font-semibold text-forest transition hover:border-brass"
              >
                ดูบริการและขั้นตอน
              </Link>
            </div>
          </div>
          <div className="media-frame media-frame--hero rounded-3xl bg-paper shadow-lift">
            <Image
              src="/images/hero-giftset.jpg"
              alt="ชุดของขวัญองค์กรพรีเมียมในกล่องบรรจุภัณฑ์"
              fill
              priority
              className="object-cover"
              sizes="(max-width:1024px) 100vw, 42vw"
            />
          </div>
        </div>
      </section>

      <SmartGiftMethod parts={["categories"]} />

      <Suspense fallback={<div className="mx-auto max-w-content px-page py-16"><CatalogSkeleton cards={3} /></div>}>
        <HomeFeatured />
      </Suspense>

      <SmartGiftMethod parts={["decorate"]} />

      <section className="mx-auto max-w-content px-page py-14 sm:py-16">
        <ProcessSteps />
      </section>

      <SmartGiftMethod parts={["partner"]} />

      <section className="mx-auto max-w-content px-page pb-12 sm:pb-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-forest sm:text-3xl">
            ไอเดียชุดของขวัญตามธีม
          </h2>
          <p className="mt-3 text-ink/75">
            ธรรมชาติ วัฒนธรรม ท่องเที่ยว และสุขภาพ — เลือกธีมแล้วสกรีนโลโก้ได้
          </p>
        </div>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {IDEA_THEMES.map((theme) => (
            <li key={theme.slug}>
              <Link href={ideaThemePath(theme.slug)} className="group block">
                <div className="media-frame media-frame--tile rounded-2xl">
                  <Image
                    src={theme.heroImage}
                    alt={theme.headline}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(max-width:768px) 100vw, 25vw"
                  />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-forest group-hover:text-brass">
                  {theme.name}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm text-ink/70">{theme.lede}</p>
                <p className="mt-3 text-sm font-medium text-brass">ดูไอเดียธีมนี้ →</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Suspense fallback={<div className="mx-auto max-w-content px-page py-16"><CatalogSkeleton cards={3} /></div>}>
        <HomeFeatured />
      </Suspense>

      <section className="mx-auto max-w-content px-page py-16">
        <div className="rounded-3xl bg-brass px-5 py-10 text-paper shadow-lift sm:px-10 sm:py-12">
          <h2 className="text-2xl font-bold sm:text-3xl">ปรึกษาหรือขอใบเสนอราคา</h2>
          <p className="mt-3 max-w-xl text-paper/90">
            กรอกแบบฟอร์มเพื่อให้ทีมช่วยคิดของและประเมินราคา ไม่ใช่การสั่งซื้อ
            และไม่มีการชำระเงินบนเว็บ
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
          <h2 className="text-2xl font-bold text-forest sm:text-3xl">สินค้าที่เลือกบ่อย</h2>
          <p className="mt-3 text-ink/75">
            กระบอกน้ำ ชุดของขวัญ และของที่ใช้ทุกวัน สกรีนโลโก้ได้ — กดเข้าไปดูแล้วขอราคา
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
