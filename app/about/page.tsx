import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import {
  COMPANY,
  COMPANY_SERVICES,
  formatRegisteredAddress,
} from "@/lib/company";
import { getPublicContact } from "@/lib/public-contact";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { metadataForPath } from "@/lib/page-seo";
import { site } from "@/lib/site";
import { SMART_GIFT_TAGLINE_EN, SMART_GIFT_TAGLINE_TH } from "@/lib/smart-gift-method";

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/about");
}

export default function AboutPage() {
  const contact = getPublicContact(site);
  const address = formatRegisteredAddress({
    streetAddress: site.localBusiness.streetAddress,
    locality: site.localBusiness.locality,
    region: site.localBusiness.region,
    postalCode: site.localBusiness.postalCode,
  });
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "หน้าแรก", path: "/" },
    { name: "เกี่ยวกับเรา", path: "/about" },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbs} />

      <section className="border-b border-forest/10 bg-forest-mist">
        <div className="mx-auto grid max-w-content items-center gap-8 px-page py-10 sm:py-14 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">
              {SMART_GIFT_TAGLINE_EN}
            </p>
            <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight text-forest sm:text-4xl md:text-5xl">
              เกี่ยวกับ {COMPANY.brandName}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-ink/75 sm:text-base">
              {SMART_GIFT_TAGLINE_TH}
            </p>
          </div>
          <div className="media-frame media-frame--hero rounded-3xl bg-paper shadow-lift">
            <Image
              src="/images/about-facility.jpg"
              alt="พื้นที่ทำงานของ Smart Gift สำหรับของพรีเมียมองค์กร"
              fill
              priority
              className="object-cover object-[center_38%]"
              sizes="(max-width:1024px) 100vw, 42vw"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-content px-page py-12 sm:py-16">
        <Breadcrumbs items={[{ label: "เกี่ยวกับเรา" }]} />

        <section className="max-w-3xl">
          <p className="text-base leading-relaxed text-ink/80">
            {COMPANY.brandName} รับทำของพรีเมียมให้ของขวัญองค์กร สินค้าขายปลีก
            แคมเปญ อีเวนต์ งานภาครัฐ และของพนักงาน สกรีนโลโก้และสั่งผลิตตามแบบจากจีน
            ใบกำกับภาษีออกในนาม {COMPANY.legalName}
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-forest">วิธีที่เราทำงาน</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {COMPANY_SERVICES.map((item) => (
              <li
                key={item.title}
                className="rounded-2xl border border-forest/10 bg-paper p-6"
              >
                <h3 className="text-lg font-semibold text-forest">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/75">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 rounded-3xl border border-forest/10 bg-forest-mist/40 p-6 sm:p-10">
          <h2 className="text-2xl font-bold text-forest">ข้อมูลนิติบุคคล</h2>
          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-forest">ชื่อที่แสดง</dt>
              <dd className="mt-1 text-ink/80">{COMPANY.brandName}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-forest">ชื่อจดทะเบียน</dt>
              <dd className="mt-1 text-ink/80">{COMPANY.legalName}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-forest">ชื่อภาษาอังกฤษ</dt>
              <dd className="mt-1 text-ink/80">{COMPANY.legalNameEn}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-forest">
                เลขประจำตัวผู้เสียภาษี
              </dt>
              <dd className="mt-1 font-mono text-ink/80">{COMPANY.taxId}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-forest">จดทะเบียน</dt>
              <dd className="mt-1 text-ink/80">{COMPANY.registeredOnTh}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-semibold text-forest">ที่อยู่จดทะเบียน</dt>
              <dd className="mt-1 text-ink/80">{address}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-14 max-w-3xl">
          <h2 className="text-2xl font-bold text-forest">ติดต่อเรา</h2>
          <p className="mt-3 text-ink/75">
            ส่งรายละเอียดผ่านแบบฟอร์มขอใบเสนอราคา ทีมขายจะติดต่อกลับในเวลาทำการ
          </p>
          <dl className="mt-8 space-y-4 text-sm">
            {contact.showPhone ? (
              <div>
                <dt className="font-semibold text-forest">โทรศัพท์</dt>
                <dd className="mt-1">
                  <a href={site.phoneHref} className="text-ink/80 hover:text-brass">
                    {site.phoneDisplay}
                  </a>
                </dd>
              </div>
            ) : null}
            {contact.showEmail ? (
              <div>
                <dt className="font-semibold text-forest">อีเมล</dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${site.email}`}
                    className="text-ink/80 hover:text-brass"
                  >
                    {site.email}
                  </a>
                </dd>
              </div>
            ) : null}
            {contact.showLine ? (
              <div>
                <dt className="font-semibold text-forest">LINE</dt>
                <dd className="mt-1">
                  <a
                    href={site.lineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink/80 hover:text-brass"
                  >
                    {site.lineId}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest"
            >
              ขอใบเสนอราคา
            </Link>
            <Link
              href="/products"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
            >
              ดูสินค้า
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
