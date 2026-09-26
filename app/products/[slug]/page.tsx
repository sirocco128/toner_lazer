import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GiftSetBreakdown } from "@/components/GiftSetBreakdown";
import { CatalogImage } from "@/components/CatalogImage";
import { JsonLd } from "@/components/JsonLd";
import { ProductPriceOptions } from "@/components/ProductPriceOptions";
import { ProductMockupStudio } from "@/components/ProductMockupStudio";
import { ChinaOrderSteps } from "@/components/ChinaOrderSteps";
import { LogoDecorationPanel } from "@/components/LogoDecorationPanel";
import { LogoReadyBadge } from "@/components/LogoReadyBadge";
import { QuoteForm } from "@/components/QuoteForm";
import { isP2QuoteToolsEnabled } from "@/lib/feature-flags";
import { resolveMockupSurfaces } from "@/lib/mockup-studio";
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
} from "@/lib/seo";
import { metadataFromSeo } from "@/lib/metadata";
import { resolveSeoFields } from "@/lib/page-seo";
import { getProductBySlug, getProducts } from "@/lib/strapi";
import { productCoverImage } from "@/lib/product-media";
import { catalogHrefForProduct } from "@/lib/product-compare";

export const revalidate = 300;
export const dynamicParams = true;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  if (process.env.NODE_ENV === "development") return [];
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  return metadataFromSeo(
    resolveSeoFields(product.seo.canonicalPath, product.seo),
    {
      openGraphType: "website",
    },
  );
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const cover = productCoverImage(product.images, product.categorySlug);
  const thumbnails = product.images.filter(Boolean).slice(0, 4);
  const enableP2QuoteTools = isP2QuoteToolsEnabled();
  const mockupSurfaces = resolveMockupSurfaces(product);
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "หน้าแรก", path: "/" },
    { name: "สินค้าพรีเมียม", path: "/products" },
    { name: product.name, path: `/products/${product.slug}` },
  ]);
  const productLd = buildProductJsonLd(product);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={productLd} />

      <div className="mx-auto max-w-content px-page py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { href: "/products", label: "สินค้าพรีเมียม" },
            { label: product.name },
          ]}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <div>
            <div className="media-frame media-frame--product rounded-3xl">
              <CatalogImage
                src={cover}
                alt={product.name}
                priority
                objectFit="contain"
                sizes="(max-width:1024px) 100vw, 50vw"
              />
            </div>
            {thumbnails.length > 1 ? (
              <ul className="mt-4 grid grid-cols-4 gap-3">
                {thumbnails.map((src, index) => (
                  <li key={`${src}-${index}`} className="media-frame media-frame--thumb rounded-xl">
                    <CatalogImage
                      src={src}
                      alt={`${product.name} มุมที่ ${index + 1}`}
                      objectFit="contain"
                      sizes="120px"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <LogoReadyBadge />
              {product.isClearance ? (
                <span className="rounded-full bg-brass/20 px-3 py-1 text-xs font-medium text-forest">
                  เคลียร์สต็อก{product.clearanceReason ? ` · ${product.clearanceReason}` : ""}
                </span>
              ) : (
                <span className="text-xs font-medium text-ink/55">
                  {product.stockClass === "A"
                    ? "มีของในคลัง พร้อมส่ง"
                    : "สั่งผลิตตามออเดอร์ · ไม่ใช่ของพร้อมส่ง"}
                </span>
              )}
              {product.isBundle ? (
                <span className="text-xs font-medium text-ink/55">
                  ราคาเป็นราคาชุด ไม่แยกราคาชิ้น
                </span>
              ) : null}
              {product.productId ? (
                <span className="font-mono text-xs text-ink/45">{product.productId}</span>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-bold text-forest sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-4 whitespace-pre-line text-ink/80 leading-relaxed">
              {product.description}
            </p>
            <dl className="mt-8 space-y-3 text-sm">
              {product.material ? (
                <div className="flex gap-3 border-b border-forest/10 pb-3">
                  <dt className="w-28 shrink-0 font-semibold text-forest">วัสดุ</dt>
                  <dd className="text-ink/80">{product.material}</dd>
                </div>
              ) : null}
              <div className="flex gap-3 border-b border-forest/10 pb-3">
                <dt className="w-28 shrink-0 font-semibold text-forest">สั่งขั้นต่ำ</dt>
                <dd className="text-ink/80">{product.minOrder} เซ็ต</dd>
              </div>
              {product.leadDays != null ? (
                <div className="flex gap-3 border-b border-forest/10 pb-3">
                  <dt className="w-28 shrink-0 font-semibold text-forest">เวลาผลิต</dt>
                  <dd className="text-ink/80">ประมาณ {product.leadDays} วัน</dd>
                </div>
              ) : null}
              {product.colors && product.colors.length > 0 ? (
                <div className="flex gap-3 border-b border-forest/10 pb-3">
                  <dt className="w-28 shrink-0 font-semibold text-forest">สีที่มี</dt>
                  <dd className="text-ink/80">
                    {product.colors.map((color) => color.name).join(" · ")}
                  </dd>
                </div>
              ) : null}
            </dl>
            <GiftSetBreakdown product={product} />
            <ProductPriceOptions
              productSlug={product.slug}
              productName={product.name}
              minOrder={product.minOrder}
              skuCode={product.productId || product.slug}
              priceMin={product.priceMin}
              priceMax={product.priceMax}
              priceExFreightMin={product.priceExFreightMin}
              priceExFreightMax={product.priceExFreightMax}
              packagingMin={product.packagingMin}
              packagingMax={product.packagingMax}
              enableP2QuoteTools={enableP2QuoteTools}
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#quote"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-[color:var(--accent-foreground)]"
              >
                ขอราคาเซ็ตนี้
              </Link>
              <Link
                href={catalogHrefForProduct(product.slug)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
              >
                ดูในสมุดพลิก
              </Link>
              <Link
                href="#logo"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
              >
                วิธีใส่โลโก้
              </Link>
              {mockupSurfaces ? (
                <Link
                  href="#mockup"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
                >
                  ลองวางโลโก้ · หมุน 360°
                </Link>
              ) : null}
              <Link
                href="#china-flow"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
              >
                ขั้นตอนสั่งผลิต
              </Link>
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
              >
                ดูเซ็ตอื่น
              </Link>
            </div>
          </div>
        </div>

        <LogoDecorationPanel
          productSlug={product.slug}
          hasMockup={Boolean(mockupSurfaces)}
        />

        <ChinaOrderSteps className="mt-16" />

        {mockupSurfaces ? (
          <div id="mockup" className="mt-16 scroll-mt-28">
            <ProductMockupStudio
              productName={product.name}
              surfaces={mockupSurfaces}
            />
          </div>
        ) : null}

        <div id="quote" className="mt-16 scroll-mt-28">
          <QuoteForm
            heading={`ขอใบเสนอราคา: ${product.name}`}
            productInterest={product.name}
            productSlug={product.slug}
            minOrder={product.minOrder}
          />
        </div>
      </div>
    </>
  );
}
