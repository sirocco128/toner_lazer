import Link from "next/link";
import { notFound } from "next/navigation";
import {
  setArticleStatusAction,
  updateArticleAction,
} from "@/app/actions/ops-articles";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { getArticleById } from "@/lib/article-repository";
import { ARTICLE_STATUS_LABELS, formatBangkokDateTimeLocal, type ArticleStatus } from "@/lib/article-types";
import { ARTICLE_TOPIC_LABELS, ARTICLE_TOPICS, resolveArticleTopic } from "@/lib/article-media-catalog";
import { requireOpsPage } from "@/lib/ops-auth";
import { isPlatformAdmin } from "@/lib/ops-roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_ACTIONS: Array<{
  from: ArticleStatus;
  to: ArticleStatus;
  label: string;
  adminOnly?: boolean;
}> = [
  { from: "draft", to: "review", label: "ส่งตรวจ" },
  { from: "review", to: "draft", label: "ตีกลับ" },
  { from: "review", to: "live", label: "เผยแพร่ทันที", adminOnly: true },
  { from: "scheduled", to: "live", label: "เผยแพร่ทันที", adminOnly: true },
  { from: "scheduled", to: "draft", label: "ยกเลิกเวลา", adminOnly: true },
  { from: "live", to: "archived", label: "เก็บออกจากเว็บ" },
  { from: "archived", to: "draft", label: "เปิดร่างใหม่" },
];

export default async function OpsArticlePage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const actor = await requireOpsPage("seo.write");
  const { articleId: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) notFound();
  const article = await getArticleById(id);
  if (!article) notFound();

  const isAdmin = isPlatformAdmin(actor.role);
  const transitions = STATUS_ACTIONS.filter(
    (step) => step.from === article.status && (!step.adminOnly || isAdmin),
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm">
          <Link href="/ops/blog" className="text-forest underline-offset-2 hover:underline">
            ← บทความ
          </Link>
        </p>
        <h1 className="mt-3 text-2xl font-bold text-forest">{article.title}</h1>
        <p className="mt-2 text-sm text-ink/70">
          {ARTICLE_STATUS_LABELS[article.status]}
          {" · "}
          {ARTICLE_TOPIC_LABELS[resolveArticleTopic(article.category)]}
          {article.source === "ai" ? " · ผู้ช่วย" : " · คนเขียน"}
          {" · "}
          <span className="font-mono text-xs">{article.slug}</span>
        </p>
        {article.status === "live" ? (
          <p className="mt-2 text-sm">
            <Link
              href={`/blog/${article.slug}`}
              className="text-forest underline-offset-2 hover:underline"
            >
              เปิดบนเว็บสาธารณะ
            </Link>
          </p>
        ) : null}
      </div>

      {transitions.length > 0 ? (
        <section className="rounded-xl border border-forest/15 bg-paper p-5">
          <h2 className="font-semibold text-forest">สถานะ</h2>
          <div className="mt-4 flex flex-wrap gap-4">
            {transitions.map((step) => (
              <OpsCycleForm
                key={`${step.from}-${step.to}`}
                action={setArticleStatusAction}
                submitLabel={step.label}
              >
                <input type="hidden" name="articleId" value={article.id} />
                <input type="hidden" name="to" value={step.to} />
              </OpsCycleForm>
            ))}
          </div>
          {isAdmin && (article.status === "review" || article.status === "scheduled") ? (
            <div className="mt-6 max-w-sm">
              <OpsCycleForm action={setArticleStatusAction} submitLabel="ตั้งเวลาเผยแพร่">
                <input type="hidden" name="articleId" value={article.id} />
                <input type="hidden" name="to" value="scheduled" />
                <label className="block text-sm">
                  <span className="font-medium">เวลาเผยแพร่ (เวลาไทย)</span>
                  <input
                    type="datetime-local"
                    name="publishAt"
                    required
                    defaultValue={formatBangkokDateTimeLocal(article.publishedAt)}
                    className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                  />
                </label>
              </OpsCycleForm>
            </div>
          ) : null}
        </section>
      ) : null}

      {article.status === "live" ? (
        <section className="rounded-xl border border-forest/15 bg-paper p-5">
          <h2 className="font-semibold text-forest">เนื้อหาที่เผยแพร่แล้ว</h2>
          <p className="mt-2 text-sm text-ink/70">{article.excerpt}</p>
          <p className="mt-3 text-sm text-ink/60">
            เก็บออกจากเว็บก่อน แล้วจึงแก้เนื้อหาได้
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-forest/15 bg-paper p-5">
          <h2 className="font-semibold text-forest">แก้ไขร่าง</h2>
          <div className="mt-4 max-w-xl">
            <OpsCycleForm action={updateArticleAction} submitLabel="บันทึกร่าง">
              <input type="hidden" name="articleId" value={article.id} />
              <label className="block text-sm">
                <span className="font-medium">ชื่อบทความ</span>
                <input
                  name="title"
                  required
                  defaultValue={article.title}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">รหัสหน้าเว็บ (slug)</span>
                <input
                  name="slug"
                  defaultValue={article.slug}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">คำโปรย</span>
                <textarea
                  name="excerpt"
                  required
                  rows={2}
                  defaultValue={article.excerpt}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">เนื้อหา</span>
                <textarea
                  name="body"
                  required
                  rows={12}
                  defaultValue={article.body}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">หมวดบทความ</span>
                <select
                  name="category"
                  defaultValue={article.category}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                >
                  {ARTICLE_TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {ARTICLE_TOPIC_LABELS[topic]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">ผู้เขียน</span>
                <input
                  name="author"
                  defaultValue={article.author}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">URL รูปปก</span>
                <input
                  name="coverUrl"
                  defaultValue={article.coverUrl}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">SEO title</span>
                <input
                  name="seoTitle"
                  maxLength={60}
                  defaultValue={article.seoTitle}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">คำอธิบายเมตา</span>
                <textarea
                  name="metaDescription"
                  rows={2}
                  maxLength={160}
                  defaultValue={article.metaDescription}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">คำค้น (คั่นจุลภาค)</span>
                <input
                  name="keywords"
                  defaultValue={article.keywords}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
              {article.brief ? (
                <label className="block text-sm">
                  <span className="font-medium">โจทย์เดิม</span>
                  <textarea
                    name="brief"
                    rows={2}
                    defaultValue={article.brief}
                    className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                  />
                </label>
              ) : null}
            </OpsCycleForm>
          </div>
        </section>
      )}
    </div>
  );
}
