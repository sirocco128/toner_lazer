import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FaqAccordion } from "@/components/FaqAccordion";
import { JsonLd } from "@/components/JsonLd";
import { LogoReadyBadge } from "@/components/LogoReadyBadge";
import { ProductCard } from "@/components/ProductCard";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
} from "@/lib/seo";
import { metadataForPath } from "@/lib/page-seo";
import {
  IDEA_THEME_SLUGS,
  getIdeaTheme,
  ideaThemePath,
} from "@/lib/seo-themes";
import { getArticleBySlug, getProducts } from "@/lib/strapi";

export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return IDEA_THEME_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const theme = getIdeaTheme(slug);
  if (!theme) return { title: "ไม่พบธีม" };
  return metadataForPath(ideaThemePath(theme.slug), {
    seoTitle: theme.seoTitle,
    metaDescription: theme.metaDescription,
    canonicalPath: ideaThemePath(theme.slug),
    ogImage: theme.heroImage,
    keywords: theme.keywords.join(", "),
  });
}

export default async function IdeaThemePage({ params }: PageProps) {
  const { slug } = await params;
  const theme = getIdeaTheme(slug);
  if (!theme) notFound();

  const products = await getProducts();
  const related = products.filter((product) =>
    theme.relatedProductSlugs.includes(product.slug),
  );
  const themeArticle = await getArticleBySlug(`gift-set-${theme.slug}-theme`);
  const faqs = theme.faqs.map((faq) => ({
    question: faq.question,
    answer: faq.answer,
    order: faq.order,
  }));

  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "หน้าแรก", path: "/" },
    { name: "ไอเดียชุดของขวัญ", path: "/ideas" },
    { name: theme.name, path: ideaThemePath(theme.slug) },
  ]);
  const faqLd = buildFaqPageJsonLd(faqs);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={faqLd} />
      <article className="mx-auto max-w-content px-page py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { href: "/ideas", label: "ไอเดียชุดของขวัญ" },
            { label: theme.name },
          ]}
        />

        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brass">
              ธีม{theme.name}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-forest sm:text-4xl">
              {theme.headline}
            </h1>
            <p className="mt-4 leading-relaxed text-ink/80">{theme.lede}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/contact?productInterest=${encodeURIComponent(`ชุดของขวัญธีม${theme.name}`)}`}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest"
              >
                ขอใบเสนอราคาธีมนี้
              </Link>
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
              >
                ดูสินค้า
              </Link>
              {themeArticle ? (
                <Link
                  href={`/blog/${themeArticle.slug}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
                >
                  อ่านบทความธีมนี้
                </Link>
              ) : null}
            </div>
          </div>
          <div className="media-frame media-frame--hero rounded-3xl">
            <Image
              src={theme.heroImage}
              alt={theme.headline}
              fill
              priority
              className="object-cover"
              sizes="(max-width:1024px) 100vw, 50vw"
            />
            <LogoReadyBadge className="absolute left-3 top-3" />
          </div>
        </div>

        <div className="mt-14 space-y-10">
          {theme.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl font-bold text-forest">{section.title}</h2>
              <p className="mt-3 max-w-3xl leading-relaxed text-ink/80">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-forest">ตัวอย่างชุดที่ทำบ่อย</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-ink/80">
            {theme.ideas.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>
        </section>

        {related.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-2xl font-bold text-forest">เซ็ตที่เกี่ยวข้อง</h2>
            <p className="mt-2 text-sm text-ink/65">
              ราคาที่แสดงเป็นช่วงโดยประมาณ — ยืนยันหลังส่งรายละเอียดในแบบฟอร์ม
            </p>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {related.map((product) => (
                <li key={product.slug}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-14">
          <h2 className="text-2xl font-bold text-forest">คำถามที่พบบ่อย</h2>
          <div className="mt-6">
            <FaqAccordion faqs={faqs} />
          </div>
        </section>

        <aside className="mt-14 rounded-3xl border border-forest/10 bg-forest-mist/40 px-6 py-8 sm:px-8">
          <h2 className="text-lg font-bold text-forest">
            พร้อมทำชุดธีม{theme.name}?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/75">
            แจ้งจำนวน งบต่อชุด และวันใช้งาน — ทีมขายจัดสเปคและวิธีใส่โลโก้ให้
            ไม่มีการชำระเงินบนเว็บ
          </p>
          <Link
            href={`/contact?productInterest=${encodeURIComponent(`ชุดของขวัญธีม${theme.name}`)}`}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest"
          >
            ขอใบเสนอราคา
          </Link>
        </aside>
      </article>
    </>
  );
}
