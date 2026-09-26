import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogFilterTabs } from "@/components/CatalogFilterTabs";
import { FadeIn } from "@/components/FadeIn";
import { EmptyState } from "@/components/EmptyState";
import { PriceDisclaimer } from "@/components/PriceDisclaimer";
import { ProductCard } from "@/components/ProductCard";
import {
  catalogGroupExtraLinks,
  catalogGroupQuoteHref,
  productMatchesCatalogGroup,
  resolveCatalogGroup,
} from "@/lib/catalog-groups";
import { fitSeoDescription } from "@/lib/seo-limits";
import { metadataFromSeo } from "@/lib/seo";
import {
  SMART_GIFT_CATEGORIES,
  type SmartGiftCategory,
} from "@/lib/smart-gift-method";
import { getPublicCatalog } from "@/lib/strapi";
import { metadataForPath } from "@/lib/page-seo";
import {
  CATALOG_EMPTY_BODY,
  CATALOG_EMPTY_TITLE,
  CATALOG_PILL,
  CATALOG_SUBTITLE,
  CATALOG_UNAVAILABLE_BODY,
  CATALOG_UNAVAILABLE_TITLE,
  FLIP_CATALOG_OPEN,
} from "@/lib/ux-copy";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: ProductsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const categorySlug = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const group = categorySlug ? resolveCatalogGroup(categorySlug) : null;
  if (!group) return metadataForPath("/products");
  const title = `${group.title} สกรีนโลโก้`.slice(0, 60);
  return metadataFromSeo({
    seoTitle: title,
    metaDescription: fitSeoDescription(
      `${group.title} ${group.points.join(" ")} สั่งผลิตตามแบบ สกรีนโลโก้ได้ ขอใบเสนอราคาได้โดยไม่ชำระเงินบนเว็บ`,
    ),
    canonicalPath: `/products?category=${group.slug}`,
    ogImage: group.image,
    keywords: `${group.title}, สกรีนโลโก้, สั่งผลิต`,
  });
}

type ProductsPageProps = {
  searchParams: Promise<{ category?: string | string[]; q?: string | string[] }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const categorySlug = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const queryRaw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (queryRaw || "").trim().toLowerCase();
  const { products, unavailable } = await getPublicCatalog();
  const hasClearance = products.some((item) => item.isClearance);
  const requestedCategory = (categorySlug || "").trim().toLowerCase();
  const clearanceActive = requestedCategory === "clearance" && hasClearance;
  const group =
    requestedCategory && !clearanceActive
      ? resolveCatalogGroup(requestedCategory)
      : null;
  const unknownCategory = Boolean(requestedCategory) && !clearanceActive && !group;
  const activeCategory = clearanceActive ? "clearance" : group?.slug ?? null;
  const visible = products.filter((product) => {
    if (unknownCategory) return false;
    if (clearanceActive) {
      if (!product.isClearance) return false;
    } else if (group && !productMatchesCatalogGroup(product, group)) {
      return false;
    }
    if (!query) return true;
    const haystack = `${product.name} ${product.description || ""}`.toLowerCase();
    return haystack.includes(query);
  });
  const tabs = [
    ...SMART_GIFT_CATEGORIES.map((item) => ({ slug: item.slug, name: item.title })),
    ...(hasClearance ? [{ slug: "clearance", name: "เคลียร์" }] : []),
  ];

  return (
    <div className="bg-premium-mesh">
      <div className="mx-auto max-w-content px-page py-12 sm:py-16">
        <Breadcrumbs items={[{ label: "สินค้าพรีเมียม" }]} />
        <FadeIn className="max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brass/30 bg-paper/80 px-3 py-1 text-xs font-medium text-forest shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-forest/60 dark:text-brass-soft">
            <Sparkles className="h-3.5 w-3.5 text-brass" aria-hidden />
            {CATALOG_PILL}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-forest sm:text-4xl dark:text-paper">
            {group ? group.title : "สินค้าพรีเมียม"}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink/65 dark:text-paper/70">
            {group ? group.points.join(" · ") : CATALOG_SUBTITLE}
          </p>
          <p className="mt-2 text-sm text-ink/55 dark:text-paper/60">
            หน้านี้เป็นรายการเลือกเซ็ตแล้วขอราคา ไม่ใช่สมุดพลิกดู
          </p>
          <p className="mt-4">
            <Link
              href="/catalog"
              className="inline-flex min-h-11 items-center rounded-full border border-forest/15 bg-paper/80 px-4 text-sm font-medium text-forest shadow-sm backdrop-blur-md transition hover:border-brass/40 dark:border-white/10 dark:bg-forest/50 dark:text-brass-soft"
            >
              {FLIP_CATALOG_OPEN}
            </Link>
          </p>
        </FadeIn>

        <form className="mt-8 flex flex-wrap gap-2" method="get" action="/products">
          {activeCategory ? (
            <input type="hidden" name="category" value={activeCategory} />
          ) : null}
          <label className="sr-only" htmlFor="product-search">
            ค้นหาสินค้า
          </label>
          <input
            id="product-search"
            name="q"
            defaultValue={queryRaw || ""}
            placeholder="ค้นหาชื่อสินค้า"
            className="min-h-11 w-full min-w-0 flex-1 rounded-full border border-forest/15 bg-paper px-4 text-sm sm:min-w-[16rem]"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-medium text-paper"
          >
            ค้นหา
          </button>
        </form>

        {tabs.length > 0 ? (
          <CatalogFilterTabs
            categories={tabs}
            activeSlug={activeCategory}
            hrefFor={(slug) => {
              const next = new URLSearchParams();
              if (slug) next.set("category", slug);
              if (query) next.set("q", queryRaw || query);
              const qs = next.toString();
              return qs ? `/products?${qs}` : "/products";
            }}
          />
        ) : null}

        {products.length === 0 ? (
          <EmptyState
            title={unavailable ? CATALOG_UNAVAILABLE_TITLE : CATALOG_EMPTY_TITLE}
            description={unavailable ? CATALOG_UNAVAILABLE_BODY : CATALOG_EMPTY_BODY}
            actionHref="/contact"
            actionLabel="ขอคำแนะนำจากทีมขาย"
          />
        ) : group && visible.length === 0 && !query ? (
          <CatalogGroupRequest group={group} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={query ? "ไม่พบสินค้าที่ตรงคำค้น" : "ไม่พบหมวดนี้"}
            description="ลองเปลี่ยนคำค้นหรือหมวด หรือส่งโจทย์ให้ทีมขายแนะนำของที่สกรีนโลโก้ได้"
            actionHref={group ? catalogGroupQuoteHref(group) : "/contact"}
            actionLabel="ขอคำแนะนำจากทีมขาย"
          />
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((product) => (
              <li key={product.slug}>
                <ProductCard product={product} heading="h2" />
              </li>
            ))}
          </ul>
        )}
        {visible.length > 0 ? <PriceDisclaimer className="mt-8" variant="full" /> : null}
      </div>
    </div>
  );
}

function CatalogGroupRequest({ group }: { group: SmartGiftCategory }) {
  const extras = catalogGroupExtraLinks(group);
  return (
    <section className="mt-10 overflow-hidden rounded-3xl border border-forest/10 bg-paper">
      <div className="grid md:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="media-frame media-frame--tile min-h-56 rounded-none">
          <Image
            src={group.image}
            alt={group.imageAlt}
            fill
            className="object-cover"
            sizes="(max-width:768px) 100vw, 20rem"
          />
        </div>
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-brass">
            {group.titleEn}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-forest">{group.title}</h2>
          <p className="mt-3 leading-relaxed text-ink/75">
            หมวดนี้สั่งผลิตตามแบบ ยังไม่มีรายการตัวอย่างบนเว็บ ส่งโจทย์แล้วทีมขายจะเสนอตัวเลือกและใบเสนอราคา
          </p>
          <ul className="mt-4 space-y-1 text-sm text-ink/70">
            {group.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={catalogGroupQuoteHref(group)}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-5 text-sm font-semibold"
            >
              ขอใบเสนอราคาหมวดนี้
            </Link>
            {extras.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/15 px-5 text-sm font-semibold text-forest"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
