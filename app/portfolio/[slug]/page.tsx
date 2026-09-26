import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { metadataFromSeo } from "@/lib/metadata";
import { clampSeoTitle, fitSeoDescription } from "@/lib/seo-limits";
import { resolveSeoFields } from "@/lib/page-seo";
import {
  buildBreadcrumbJsonLd,
  buildCreativeWorkJsonLd,
} from "@/lib/seo";
import { getPortfolioBySlug, getPortfolios } from "@/lib/strapi";

export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatCompleted(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "long",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export async function generateStaticParams() {
  const portfolios = await getPortfolios();
  return portfolios.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPortfolioBySlug(slug);
  if (!item) notFound();
  const path = `/portfolio/${item.slug}`;
  return metadataFromSeo(
    resolveSeoFields(path, {
      seoTitle: clampSeoTitle(`${item.title} ผลงานองค์กร`),
      metaDescription: fitSeoDescription(
        `${item.summary} สกรีนโลโก้ได้ สั่งผลิตตามออเดอร์จากจีน ดูแนวทางแล้วขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ`,
      ),
      canonicalPath: path,
      ogImage: item.image,
    }),
    { openGraphType: "article" },
  );
}

export default async function PortfolioDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const item = await getPortfolioBySlug(slug);
  if (!item) notFound();

  const isMock = (process.env.CMS_MODE || "mock") !== "strapi";
  const others = (await getPortfolios()).filter((row) => row.slug !== item.slug).slice(0, 3);
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "หน้าแรก", path: "/" },
    { name: "ผลงาน", path: "/portfolio" },
    { name: item.title, path: `/portfolio/${item.slug}` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={buildCreativeWorkJsonLd(item)} />

      <article className="mx-auto max-w-3xl px-page py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { href: "/portfolio", label: "ผลงาน" },
            { label: item.title },
          ]}
        />

        {isMock ? (
          <p
            role="status"
            className="mt-2 rounded-xl border border-brass/40 bg-brass/10 px-4 py-3 text-sm text-forest"
          >
            ผลงานนี้เป็นตัวอย่างในโหมดสาธิต ยังไม่ใช่เคสลูกค้าจริงที่ได้รับอนุญาตเผยแพร่
          </p>
        ) : null}

        <header className="mt-4">
          {item.industry ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-brass">
              {item.industry}
            </p>
          ) : null}
          <h1 className="mt-2 text-3xl font-bold text-forest sm:text-4xl">{item.title}</h1>
          <p className="mt-3 text-sm text-ink/65">
            ลูกค้า: {item.client}
            {item.completedAt ? (
              <>
                {" · "}
                <time dateTime={item.completedAt}>{formatCompleted(item.completedAt)}</time>
              </>
            ) : null}
          </p>
        </header>

        <div className="media-frame media-frame--cover rounded-3xl">
          <Image
            src={item.image}
            alt={item.title}
            fill
            priority
            className="object-cover"
            sizes="(max-width:768px) 100vw, 768px"
          />
        </div>

        <p className="mt-8 text-base leading-relaxed text-ink/80">{item.summary}</p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          {item.services?.length ? (
            <div className="rounded-2xl border border-forest/10 p-5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">บริการในงานนี้</dt>
              <dd className="mt-2 text-sm text-ink/80">{item.services.join(" · ")}</dd>
            </div>
          ) : null}
          {item.quantity ? (
            <div className="rounded-2xl border border-forest/10 p-5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">จำนวนโดยประมาณ</dt>
              <dd className="mt-2 text-sm text-ink/80">{item.quantity.toLocaleString("th-TH")} เซ็ต</dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-6 text-sm leading-relaxed text-ink/65">
          งานลักษณะนี้สั่งผลิตตามออเดอร์จากจีน แล้วสกรีนโลโก้ตามแบบที่อนุมัติ ไม่ใช่ของพร้อมส่ง
          ทีมขายยืนยันสเปค โลโก้ และจำนวนก่อนผลิต
        </p>

        <aside className="mt-12 rounded-3xl border border-forest/10 bg-forest-mist/40 px-6 py-8 sm:px-8">
          <h2 className="text-lg font-bold text-forest">สนใจแนวทางแบบนี้สำหรับองค์กร?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/75">
            แจ้งจำนวน งบประมาณ และวันที่ต้องการใช้งาน — ทีมขายส่งใบเสนอราคากลับ
            ไม่มีการชำระเงินบนเว็บ
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
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
              ดูสินค้าแล้วเลือกเซ็ต
            </Link>
          </div>
        </aside>

        {others.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-xl font-bold text-forest">ผลงานอื่น</h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-3">
              {others.map((row) => (
                <li key={row.slug}>
                  <Link href={`/portfolio/${row.slug}`} className="group block">
                    <div className="media-frame media-frame--tile rounded-2xl">
                      <Image
                        src={row.image}
                        alt={row.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width:768px) 100vw, 33vw"
                      />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-forest group-hover:underline">
                      {row.title}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </>
  );
}
