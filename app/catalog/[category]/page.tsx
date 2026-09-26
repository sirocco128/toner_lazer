import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogFilterTabs } from "@/components/CatalogFilterTabs";
import { CatalogFlipbook } from "@/components/CatalogFlipbook";
import { EmptyState } from "@/components/EmptyState";
import { PriceDisclaimer } from "@/components/PriceDisclaimer";
import { buildCatalogBook, catalogPageNumberForSlug } from "@/lib/catalog-book";
import { catalogPdfUrl, flipHtml5EmbedUrl, parseFlipPageParam } from "@/lib/fliphtml5";
import { metadataFromSeo } from "@/lib/metadata";
import { clampSeoTitle, fitSeoDescription } from "@/lib/seo-limits";
import { getCategories, getCategoryBySlug, getPublicCategoryCatalog } from "@/lib/strapi";
import { canonicalCategorySlug } from "@/lib/smartgift-products";
import { categoryTabLabel } from "@/lib/product-media";
import {
  CATALOG_UNAVAILABLE_BODY,
  CATALOG_UNAVAILABLE_TITLE,
  FLIP_CATALOG_CLOSING_BODY,
  FLIP_CATALOG_CLOSING_TITLE,
  FLIP_CATALOG_LEAD,
  FLIP_CATALOG_NAV,
} from "@/lib/ux-copy";

export const revalidate = 300;
export const dynamicParams = true;

type PageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ p?: string | string[]; product?: string | string[] }>;
};

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  const shortName = categoryTabLabel(category.slug, category.name);
  return metadataFromSeo(
    {
      seoTitle: clampSeoTitle(`สมุดแคตตาล็อก ${shortName}`),
      metaDescription: fitSeoDescription(
        `พลิกดูกลุ่ม ${category.name} จากสินค้าบนเว็บ ทุกชิ้นสกรีนโลโก้ใส่ได้ สั่งผลิตตามออเดอร์จากจีน ขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ`,
      ),
      canonicalPath: `/catalog/${category.slug}`,
      ogImage: category.heroImage,
    },
    { openGraphType: "website" },
  );
}

export default async function CatalogGroupPage({ params, searchParams }: PageProps) {
  const { category: slug } = await params;
  const query = await searchParams;
  const canonical = canonicalCategorySlug(slug);
  if (canonical !== slug) redirect(`/catalog/${canonical}`);

  const { category, products, categories, unavailable } = await getPublicCategoryCatalog(slug);
  if (!category) {
    if (unavailable) {
      return (
        <div className="bg-premium-mesh">
          <div className="mx-auto max-w-content px-page py-6 sm:py-8">
            <EmptyState
              title={CATALOG_UNAVAILABLE_TITLE}
              description={CATALOG_UNAVAILABLE_BODY}
              actionHref="/contact"
              actionLabel="ขอคำแนะนำจากทีมขาย"
            />
          </div>
        </div>
      );
    }
    notFound();
  }

  const book = buildCatalogBook({
    products,
    categories,
    filterSlug: category.slug,
    title: category.name,
    subtitle: category.description || FLIP_CATALOG_LEAD,
    closingTitle: FLIP_CATALOG_CLOSING_TITLE,
    closingBody: FLIP_CATALOG_CLOSING_BODY,
  });
  const flipHtml5Url = flipHtml5EmbedUrl(process.env.NEXT_PUBLIC_FLIPHTML5_URL);
  const pdfUrl = catalogPdfUrl(process.env.NEXT_PUBLIC_FLIPHTML5_PDF_URL);
  const productSlug = Array.isArray(query.product) ? query.product[0] : query.product;
  const initialPage =
    parseFlipPageParam(query.p) || catalogPageNumberForSlug(book.pages, productSlug);
  const inGroup = products.filter((product) => product.categorySlug === category.slug);

  return (
    <div className="bg-premium-mesh">
      <div className="mx-auto max-w-content px-page py-6 sm:py-8">
        <Breadcrumbs
          items={[
            { href: "/catalog", label: FLIP_CATALOG_NAV },
            { label: categoryTabLabel(category.slug, category.name) },
          ]}
        />
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brass/30 bg-paper/80 px-3 py-1 text-xs font-medium text-forest shadow-sm backdrop-blur-md">
            <BookOpen className="h-3.5 w-3.5 text-brass" aria-hidden />
            กลุ่มเดียวกันบนเว็บ
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-forest sm:text-3xl">
            {category.name}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink/65">
            {category.description}
          </p>
        </div>

        {categories.length > 0 ? (
          <CatalogFilterTabs
            categories={categories}
            activeSlug={category.slug}
            hrefFor={(item) => (item ? `/catalog/${item}` : "/catalog")}
          />
        ) : null}

        {inGroup.length === 0 ? (
          <EmptyState
            title={unavailable ? CATALOG_UNAVAILABLE_TITLE : "ยังไม่มีสินค้าในกลุ่มนี้"}
            description={
              unavailable ? CATALOG_UNAVAILABLE_BODY : "ลองดูกลุ่มอื่น หรือส่งโจทย์ให้ทีมขายแนะนำเซ็ตที่สกรีนโลโก้ได้"
            }
            actionHref="/contact"
            actionLabel="ขอคำแนะนำจากทีมขาย"
          />
        ) : (
          <CatalogFlipbook
            pages={book.pages}
            flipHtml5Url={flipHtml5Url}
            pdfUrl={pdfUrl}
            initialPage={initialPage}
          />
        )}
        {inGroup.length > 0 ? <PriceDisclaimer className="mt-8" variant="full" /> : null}
        <p className="mt-6 text-sm text-ink/55">
          <Link href={`/giftset/${category.slug}`} className="font-medium text-forest underline-offset-4 hover:underline">
            ดูหน้ากลุ่มนี้แบบรายการ
          </Link>
        </p>
      </div>
    </div>
  );
}
