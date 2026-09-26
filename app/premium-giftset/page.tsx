import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ChinaOrderSteps } from "@/components/ChinaOrderSteps";
import { FaqAccordion } from "@/components/FaqAccordion";
import { JsonLd } from "@/components/JsonLd";
import { QuoteForm } from "@/components/QuoteForm";
import {
  SMART_GIFT_AUDIENCES,
  SMART_GIFT_CATEGORIES,
  SMART_GIFT_MATERIALS,
  SMART_GIFT_PROMISE,
} from "@/lib/smart-gift-method";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
} from "@/lib/seo";
import { getFaqs } from "@/lib/strapi";
import { getPublicContact } from "@/lib/public-contact";
import { site } from "@/lib/site";
import { metadataForPath } from "@/lib/page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/premium-giftset");
}

export default async function PremiumGiftSetPage() {
  const faqs = await getFaqs();
  const contact = getPublicContact(site);

  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "หน้าแรก", path: "/" },
    { name: "ชุดของขวัญองค์กร", path: "/premium-giftset" },
  ]);
  const faqLd = buildFaqPageJsonLd(faqs);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={faqLd} />

      <div className="mx-auto max-w-content px-page pt-8">
        <Breadcrumbs items={[{ label: "ชุดของขวัญองค์กร" }]} />
      </div>

      <section className="mx-auto max-w-content px-page pb-12 pt-2 sm:pb-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">
              {site.name} · สกรีนโลโก้
            </p>
            <h1 className="mt-3 text-3xl font-bold text-forest sm:text-4xl">
              ชุดของขวัญพรีเมียม
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink/80">
              {SMART_GIFT_PROMISE} ช่วยคัดสินค้า โลโก้ และบรรจุภัณฑ์ให้ตรงงบ —
              เริ่มจากปรึกษาหรือขอใบเสนอราคา ไม่ชำระเงินบนเว็บ
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#quote"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest"
              >
                ปรึกษาหรือขอใบเสนอราคา
              </Link>
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
              >
                ดูสินค้าทั้งหมด
              </Link>
              {contact.showLine ? (
                <a
                  href={site.lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
                >
                  LINE {site.lineId}
                </a>
              ) : (
                <Link
                  href="/about"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
                >
                  เกี่ยวกับบริษัท
                </Link>
              )}
            </div>
          </div>
          <div className="media-frame media-frame--hero rounded-3xl bg-forest">
            <Image
              src="/images/hero-giftset.jpg"
              alt="ตัวอย่างชุดของขวัญองค์กรในกล่อง"
              fill
              className="object-cover"
              sizes="(max-width:1024px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
      </section>

      <section className="bg-forest-mist/40 py-14">
        <div className="mx-auto max-w-content px-page">
          <h2 className="text-2xl font-bold text-forest">ครบทุกหมวด ของพรีเมียม</h2>
          <p className="mt-2 text-sm text-ink/70">
            เลือกหมวดเดียวกับหน้าแรก แล้วเปิดดูสินค้าหรือขอราคาในหมวดนั้น
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SMART_GIFT_CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link href={category.href} className="group block">
                  <div className="media-frame media-frame--tile rounded-2xl bg-paper">
                    <Image
                      src={category.image}
                      alt={category.imageAlt}
                      fill
                      className="object-cover"
                      sizes="(max-width:768px) 100vw, 33vw"
                    />
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brass">
                    {category.titleEn}
                  </p>
                  <h3 className="mt-1 font-semibold text-forest group-hover:text-brass">
                    {category.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-ink/70">
                    {category.points.join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-content px-page py-14">
        <h2 className="text-2xl font-bold text-forest">วัสดุที่ทำให้ได้</h2>
        <ul className="mt-8 flex flex-wrap gap-2">
          {SMART_GIFT_MATERIALS.map((material) => (
            <li
              key={material}
              className="rounded-full border border-forest/15 bg-paper px-4 py-2 text-sm text-forest"
            >
              {material}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-forest py-14 text-paper">
        <div className="mx-auto max-w-content px-page">
          <ChinaOrderSteps variant="dark" />
        </div>
      </section>

      <section className="mx-auto max-w-content px-page py-14">
        <h2 className="text-2xl font-bold text-forest">กลุ่มองค์กรที่เราดูแล</h2>
        <ul className="mt-6 flex flex-wrap gap-3">
          {SMART_GIFT_AUDIENCES.map((segment) => (
            <li
              key={segment}
              className="rounded-full border border-forest/15 bg-forest-mist/50 px-4 py-2 text-sm text-forest"
            >
              {segment}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-forest-mist/40 py-14">
        <div className="mx-auto max-w-content px-page">
          <h2 className="text-2xl font-bold text-forest">คำถามที่พบบ่อย</h2>
          <div className="mt-8">
            <FaqAccordion faqs={faqs} />
          </div>
        </div>
      </section>

      <section id="quote" className="mx-auto max-w-content scroll-mt-28 px-page py-14">
        <QuoteForm heading="ขอใบเสนอราคาของพรีเมียม" />
      </section>
    </>
  );
}
