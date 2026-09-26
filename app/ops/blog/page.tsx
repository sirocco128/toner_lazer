import Link from "next/link";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";
import { requireOpsPage } from "@/lib/ops-auth";
import {
  countArticles,
  countArticlesByStatus,
  listArticles,
  publishDueArticles,
  type ArticleListFilter,
} from "@/lib/article-repository";
import { ARTICLE_TOPIC_LABELS, resolveArticleTopic } from "@/lib/article-media-catalog";
import {
  ARTICLE_STATUS_LABELS,
  isArticleStatus,
  type ArticleStatus,
} from "@/lib/article-types";
import { OpsPager } from "@/components/OpsPager";
import {
  OPS_LIST_PAGE_SIZE,
  opsPageWindow,
  parseOpsPage,
} from "@/lib/ops-pagination";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{
  status?: string;
  q?: string;
  page?: string;
}>;

type ListStatus = ArticleStatus | "all";

const TAB_ORDER: ListStatus[] = ["review", "scheduled", "draft", "live", "archived", "all"];

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function OpsBlogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("seo.write");
  const sp = await searchParams;
  const mysqlOn = isSmartgiftMysqlEnabled();
  const rawStatus = (sp.status || "review").trim();
  const status: ListStatus =
    rawStatus === "all" || isArticleStatus(rawStatus) ? rawStatus : "review";
  const q = (sp.q || "").trim();

  let error = "";
  let rows: Awaited<ReturnType<typeof listArticles>> = [];
  let total = 0;
  let statusCounts: Record<ArticleStatus, number> = {
    draft: 0,
    review: 0,
    scheduled: 0,
    live: 0,
    archived: 0,
  };
  let pageWindow = opsPageWindow(0, 1);

  try {
    if (!mysqlOn) {
      error = "ยังไม่ได้เปิด SMARTGIFT_MYSQL_ENABLED";
    } else {
      await publishDueArticles();
      const filter: ArticleListFilter = {
        status: status === "all" ? "" : status,
        q,
      };
      [total, statusCounts] = await Promise.all([
        countArticles(filter),
        countArticlesByStatus(),
      ]);
      pageWindow = opsPageWindow(total, parseOpsPage(sp.page), OPS_LIST_PAGE_SIZE);
      rows = await listArticles({
        ...filter,
        limit: pageWindow.pageSize,
        offset: pageWindow.offset,
      });
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "เชื่อม SmartGift MySQL ไม่ได้";
  }

  const allCount = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
  const tabCount = (tab: ListStatus) =>
    tab === "all" ? allCount : statusCounts[tab];

  const filterParams = {
    status: status === "review" ? undefined : status,
    q: q || undefined,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">บทความ</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        คิวตรวจก่อนขึ้นเว็บ — เซลล์ส่งตรวจได้ ผู้ดูแลเท่านั้นที่เผยแพร่
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/ops/blog/new" className="rounded bg-forest px-3 py-1.5 text-paper">
          ร่างบทความใหม่
        </Link>
        <Link href="/ops/seo" className="rounded border border-forest/30 px-3 py-1.5">
          SEO หน้าเว็บ
        </Link>
      </div>

      {error ? (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="กรองสถานะ">
        {TAB_ORDER.map((tab) => {
          const href =
            tab === "all"
              ? `/ops/blog?${new URLSearchParams({
                  status: "all",
                  ...(q ? { q } : {}),
                }).toString()}`
              : tab === "review"
                ? q
                  ? `/ops/blog?q=${encodeURIComponent(q)}`
                  : "/ops/blog"
                : `/ops/blog?${new URLSearchParams({
                    status: tab,
                    ...(q ? { q } : {}),
                  }).toString()}`;
          return (
            <Link
              key={tab}
              href={href}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                status === tab
                  ? "border-forest bg-forest text-paper"
                  : "border-forest/20 bg-paper text-ink/70",
              )}
            >
              {tab === "all" ? "ทั้งหมด" : ARTICLE_STATUS_LABELS[tab]} {tabCount(tab)}
            </Link>
          );
        })}
      </nav>

      <form className="mt-4 flex flex-wrap gap-2" method="get">
        {status !== "review" ? <input type="hidden" name="status" value={status} /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นชื่อ / slug / คำโปรย"
          className="min-w-[12rem] flex-1 rounded border border-forest/20 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-forest px-3 py-2 text-sm text-paper">
          ค้นหา
        </button>
      </form>

      {rows.length === 0 && !error ? (
        <p className="mt-6 rounded-xl border border-forest/10 px-4 py-8 text-center text-sm text-ink/60">
          {q || status !== "review"
            ? "ไม่พบบทความที่ตรงตัวกรอง — ลองล้างคำค้นหรือเปลี่ยนสถานะ"
            : "ยังไม่มีบทความรอตรวจ — เริ่มจากร่างบทความใหม่"}
        </p>
      ) : (
        <>
          <ul className="mt-6 space-y-3 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-forest/10 p-4">
                <Link
                  href={`/ops/blog/${row.id}`}
                  className="font-medium text-forest underline-offset-2 hover:underline"
                >
                  {row.title}
                </Link>
                <p className="mt-1 font-mono text-xs text-ink/60">{row.slug}</p>
                <p className="mt-1 text-xs text-ink/65">
                  {ARTICLE_TOPIC_LABELS[resolveArticleTopic(row.category)]}
                  {" · "}
                  {ARTICLE_STATUS_LABELS[row.status]}
                  {row.source === "ai" ? " · ผู้ช่วย" : " · คนเขียน"}
                </p>
                <p className="mt-1 text-xs text-ink/55">{formatWhen(row.updatedAt)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/15 text-ink/60">
                  <th className="py-2 pr-3">ชื่อ</th>
                  <th className="py-2 pr-3">slug</th>
                  <th className="py-2 pr-3">หมวด</th>
                  <th className="py-2 pr-3">สถานะ</th>
                  <th className="py-2 pr-3">ที่มา</th>
                  <th className="py-2 pr-3">อัปเดต</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-forest/10">
                    <td className="max-w-[20rem] truncate py-2 pr-3">
                      <Link
                        href={`/ops/blog/${row.id}`}
                        className="text-forest underline-offset-2 hover:underline"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.slug}</td>
                    <td className="py-2 pr-3">
                      {ARTICLE_TOPIC_LABELS[resolveArticleTopic(row.category)]}
                    </td>
                    <td className="py-2 pr-3">{ARTICLE_STATUS_LABELS[row.status]}</td>
                    <td className="py-2 pr-3">{row.source === "ai" ? "ผู้ช่วย" : "คนเขียน"}</td>
                    <td className="py-2 pr-3 text-xs text-ink/70">{formatWhen(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {status === "all" ? (
            <p className="mt-6 text-sm text-ink/65">
              แสดง {pageWindow.from}–{pageWindow.to} จาก {pageWindow.total} รายการ
              {pageWindow.totalPages > 1 ? (
                <span className="ml-3 inline-flex gap-2">
                  {pageWindow.page > 1 ? (
                    <Link
                      href={`/ops/blog?status=all${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${pageWindow.page - 1}`}
                      className="text-forest underline-offset-2 hover:underline"
                    >
                      ก่อนหน้า
                    </Link>
                  ) : null}
                  {pageWindow.page < pageWindow.totalPages ? (
                    <Link
                      href={`/ops/blog?status=all${q ? `&q=${encodeURIComponent(q)}` : ""}&page=${pageWindow.page + 1}`}
                      className="text-forest underline-offset-2 hover:underline"
                    >
                      ถัดไป
                    </Link>
                  ) : null}
                </span>
              ) : null}
            </p>
          ) : (
            <OpsPager pathname="/ops/blog" params={filterParams} window={pageWindow} />
          )}
        </>
      )}
    </div>
  );
}
