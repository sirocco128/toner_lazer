import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EmptyState } from "@/components/EmptyState";
import { getArticles } from "@/lib/strapi";
import { metadataForPath } from "@/lib/page-seo";
import { ARTICLE_TOPIC_LABELS, ARTICLE_TOPICS, isArticleTopic } from "@/lib/article-media-catalog";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/blog");
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const sp = await searchParams;
  const category = isArticleTopic(sp.category) ? sp.category : "";
  const articles = (await getArticles()).filter((article) =>
    category ? article.category === category : true,
  );

  return (
    <div className="mx-auto max-w-content px-page py-12 sm:py-16">
      <Breadcrumbs items={[{ label: "บทความ" }]} />
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-forest sm:text-4xl">บทความ</h1>
        <p className="mt-3 text-ink/75">
          แนวทางเลือกของพรีเมียม วัสดุ และการวางแผนของขวัญองค์กร แยกตามหมวด
        </p>
      </div>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="หมวดบทความ">
        <Link
          href="/blog"
          className="rounded-full border border-forest/20 px-3 py-1 text-sm text-forest"
        >
          ทั้งหมด
        </Link>
        {ARTICLE_TOPICS.map((topic) => (
          <Link
            key={topic}
            href={`/blog?category=${topic}`}
            className="rounded-full border border-forest/20 px-3 py-1 text-sm text-forest"
          >
            {ARTICLE_TOPIC_LABELS[topic]}
          </Link>
        ))}
      </nav>

      {articles.length === 0 ? (
        <EmptyState
          title="ยังไม่มีบทความ"
          description="บทความจะอัปเดตเร็ว ๆ นี้ หากต้องการคำแนะนำเฉพาะองค์กร ส่งคำขอใบเสนอราคาได้ทันที"
        />
      ) : (
        <ul className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link href={`/blog/${article.slug}`} className="group block">
                <div className="media-frame media-frame--wide rounded-2xl">
                  <Image
                    src={article.cover || "/images/article-cover.jpg"}
                    alt={article.title}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(max-width:768px) 100vw, 33vw"
                  />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-forest group-hover:text-brass">
                  {article.title}
                </h2>
                {article.categoryName ? (
                  <p className="mt-1 text-xs font-medium text-brass">{article.categoryName}</p>
                ) : null}
                <p className="mt-2 line-clamp-3 text-sm text-ink/70">{article.excerpt}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
