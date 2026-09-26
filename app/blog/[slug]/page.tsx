import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { SafeArticleContent } from "@/components/SafeArticleContent";
import { parseSafeArticleBlocks } from "@/lib/sanitize";
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/seo";
import { metadataFromSeo } from "@/lib/metadata";
import { resolveSeoFields } from "@/lib/page-seo";
import { getArticleBySlug, getArticles } from "@/lib/strapi";

export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatBangkokDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "ไม่พบบทความ" };
  return metadataFromSeo(resolveSeoFields(article.seo.canonicalPath, article.seo), {
    openGraphType: "article",
  });
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const blocks = parseSafeArticleBlocks(article.body || "");

  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "หน้าแรก", path: "/" },
    { name: "บทความ", path: "/blog" },
    { name: article.title, path: `/blog/${article.slug}` },
  ]);
  const blogLd = buildBlogPostingJsonLd(article);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={blogLd} />

      <article className="mx-auto max-w-3xl px-page py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { href: "/blog", label: "บทความ" },
            { label: article.title },
          ]}
        />

        <header className="mt-2">
          <h1 className="text-3xl font-bold text-forest sm:text-4xl">{article.title}</h1>
          <p className="mt-4 text-sm text-ink/65">
            {article.categoryName ? <span>{article.categoryName} · </span> : null}
            โดย {article.author}
            {article.publishedAt ? (
              <>
                {" · "}
                <time dateTime={article.publishedAt}>
                  {formatBangkokDate(article.publishedAt)}
                </time>
              </>
            ) : null}
          </p>
        </header>

        {article.cover ? (
          <div className="media-frame media-frame--cover rounded-3xl">
            <Image
              src={article.cover}
              alt={article.title}
              fill
              priority
              className="object-cover"
              sizes="(max-width:768px) 100vw, 768px"
            />
          </div>
        ) : null}

        <div className="mt-10">
          <SafeArticleContent blocks={blocks} />
        </div>

        <aside className="mt-14 rounded-3xl border border-forest/10 bg-forest-mist/40 px-6 py-8 sm:px-8">
          <h2 className="text-lg font-bold text-forest">สนใจของพรีเมียมสำหรับองค์กร?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/75">
            แจ้งจำนวน งบประมาณ และวันที่ต้องการใช้งาน — ทีมขายจะส่งใบเสนอราคากลับ
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
              ดูสินค้า
            </Link>
          </div>
        </aside>
      </article>
    </>
  );
}
