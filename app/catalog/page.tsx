import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogFilterTabs } from "@/components/CatalogFilterTabs";
import { CatalogFlipbook } from "@/components/CatalogFlipbook";
import { EmptyState } from "@/components/EmptyState";
import { PriceDisclaimer } from "@/components/PriceDisclaimer";
import { buildCatalogBook, catalogPageNumberForSlug } from "@/lib/catalog-book";
import { catalogPdfUrl, flipHtml5EmbedUrl, parseFlipPageParam } from "@/lib/fliphtml5";
import { metadataForPath } from "@/lib/page-seo";
import { getPublicCatalog } from "@/lib/strapi";
import {
  CATALOG_EMPTY_BODY,
  CATALOG_EMPTY_TITLE,
  CATALOG_UNAVAILABLE_BODY,
  CATALOG_UNAVAILABLE_TITLE,
  FLIP_CATALOG_CLOSING_BODY,
  FLIP_CATALOG_CLOSING_TITLE,
  FLIP_CATALOG_LEAD,
  FLIP_CATALOG_NAV,
  FLIP_CATALOG_TITLE,
} from "@/lib/ux-copy";

export const revalidate = 300;

type CatalogPageProps = {
  searchParams: Promise<{ p?: string | string[]; product?: string | string[] }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/catalog");
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const [catalog, params] = await Promise.all([getPublicCatalog(), searchParams]);
  const { products, categories, unavailable } = catalog;
  const book = buildCatalogBook({
    products,
    categories,
    title: FLIP_CATALOG_TITLE,
    subtitle: FLIP_CATALOG_LEAD,
    closingTitle: FLIP_CATALOG_CLOSING_TITLE,
    closingBody: FLIP_CATALOG_CLOSING_BODY,
  });
  const flipHtml5Url = flipHtml5EmbedUrl(process.env.NEXT_PUBLIC_FLIPHTML5_URL);
  const pdfUrl = catalogPdfUrl(process.env.NEXT_PUBLIC_FLIPHTML5_PDF_URL);
  const productSlug = Array.isArray(params.product) ? params.product[0] : params.product;
  const requestedPage = parseFlipPageParam(params.p);
  const initialPage =
    requestedPage || catalogPageNumberForSlug(book.pages, productSlug);

  return (
    <div className="bg-premium-mesh">
      <div className="mx-auto max-w-content px-page py-6 sm:py-8">
        <Breadcrumbs items={[{ label: FLIP_CATALOG_NAV }]} />
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-forest sm:text-3xl dark:text-paper">
            {FLIP_CATALOG_TITLE}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink/65 dark:text-paper/70">
            {FLIP_CATALOG_LEAD} ดูเป็น{" "}
            <Link href="/products" className="font-medium text-forest underline-offset-4 hover:underline">
              สินค้าพรีเมียม
            </Link>{" "}
            เมื่อพร้อมเลือกเซ็ต
          </p>
        </div>

        {categories.length > 0 ? (
          <CatalogFilterTabs
            categories={categories}
            hrefFor={(slug) => (slug ? `/catalog/${slug}` : "/catalog")}
          />
        ) : null}

        {products.length === 0 ? (
          <EmptyState
            title={unavailable ? CATALOG_UNAVAILABLE_TITLE : CATALOG_EMPTY_TITLE}
            description={unavailable ? CATALOG_UNAVAILABLE_BODY : CATALOG_EMPTY_BODY}
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
        {products.length > 0 ? <PriceDisclaimer className="mt-8" variant="full" /> : null}
      </div>
    </div>
  );
}
