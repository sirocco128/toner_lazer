import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EmptyState } from "@/components/EmptyState";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { PriceDisclaimer } from "@/components/PriceDisclaimer";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { metadataFromSeo } from "@/lib/metadata";
import { resolveSeoFields } from "@/lib/page-seo";
import {
  getCategories,
  getCategoryBySlug,
  getPublicCategoryCatalog,
} from "@/lib/strapi";
import { canonicalCategorySlug } from "@/lib/smartgift-products";
import {
  CATALOG_EMPTY_BODY,
  CATALOG_EMPTY_TITLE,
  CATALOG_UNAVAILABLE_BODY,
  CATALOG_UNAVAILABLE_TITLE,
} from "@/lib/ux-copy";

export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = {
  params: Promise<{ category: string }>;
};

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  return metadataFromSeo(
    resolveSeoFields(category.seo.canonicalPath, category.seo),
    {
      openGraphType: "website",
    },
  );
}

export default async function GiftsetCategoryPage({ params }: PageProps) {
  const { category: slug } = await params;
  const canonical = canonicalCategorySlug(slug);
  if (canonical !== slug) redirect(`/giftset/${canonical}`);

  const { category, products, unavailable } = await getPublicCategoryCatalog(slug);
  if (!category) {
    if (unavailable) {
      return (
        <div className="mx-auto max-w-content px-page py-10 sm:py-14">
          <EmptyState
            title={CATALOG_UNAVAILABLE_TITLE}
            description={CATALOG_UNAVAILABLE_BODY}
            actionHref="/contact"
            actionLabel="ขอคำแนะนำจากทีมขาย"
          />
        </div>
      );
    }
    notFound();
  }

  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "หน้าแรก", path: "/" },
    { name: "ชุดของขวัญองค์กร", path: "/premium-giftset" },
    { name: category.name, path: `/giftset/${category.slug}` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <div className="mx-auto max-w-content px-page py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { href: "/premium-giftset", label: "ชุดของขวัญองค์กร" },
            { label: category.name },
          ]}
        />

        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h1 className="text-3xl font-bold text-forest sm:text-4xl">{category.name}</h1>
            <p className="mt-4 leading-relaxed text-ink/80">{category.description}</p>
            <p className="mt-3 text-sm text-ink/65">
              ทุกเซ็ตในหมวดนี้สกรีนโลโก้ได้ และสั่งผลิตตามออเดอร์
              เลือกเซ็ตด้านล่าง หรือขอใบเสนอราคาทั้งหมวดได้ทันที
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest"
              >
                ขอใบเสนอราคาหมวดนี้
              </Link>
              <Link
                href={`/catalog/${category.slug}`}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
              >
                เปิดสมุดพลิกกลุ่มนี้
              </Link>
            </div>
          </div>
          <div className="media-frame media-frame--hero rounded-3xl">
            <Image
              src={category.heroImage}
              alt={category.name}
              fill
              className="object-cover"
              sizes="(max-width:1024px) 100vw, 50vw"
              priority
            />
          </div>
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-forest">สินค้าในหมวดนี้</h2>
          <p className="mt-2 text-sm text-ink/65">
            ราคาที่แสดงเป็นช่วงโดยประมาณ — ทีมขายจะยืนยันหลังได้รับรายละเอียด
          </p>
          {products.length === 0 ? (
            <EmptyState
              title={unavailable ? CATALOG_UNAVAILABLE_TITLE : CATALOG_EMPTY_TITLE}
              description={unavailable ? CATALOG_UNAVAILABLE_BODY : CATALOG_EMPTY_BODY}
              actionHref="/contact"
              actionLabel="ขอคำแนะนำจากทีมขาย"
            />
          ) : (
            <>
              <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <li key={product.slug}>
                  <ProductCard product={product} />
                </li>
              ))}
              </ul>
              <PriceDisclaimer className="mt-8" variant="full" />
            </>
          )}
        </section>
      </div>
    </>
  );
}
