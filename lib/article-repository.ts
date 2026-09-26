/**
 * SmartGift blog repository. Ops writes call ensure. Public readers fail open.
 */

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Article } from "@/lib/data";
import {
  articleTableReady,
  ensureArticleSchema,
} from "@/lib/article-schema";
import {
  ARTICLE_SLUG_PATTERN,
  articleTransitionError,
  isArticleSource,
  isArticleStatus,
  isFuturePublishAt,
  nextUniqueSlug,
  slugifyArticle,
  toArticleHtml,
  type ArticleRow,
  type ArticleSource,
  type ArticleStatus,
} from "@/lib/article-types";
import {
  ARTICLE_TOPIC_LABELS,
  isArticleTopic,
  resolveArticleTopic,
  type ArticleTopic,
} from "@/lib/article-media-catalog";
import { isSmartgiftMysqlEnabled, smartgiftExec, smartgiftQuery } from "@/lib/smartgift-mysql";
import {
  clampSeoDescription,
  clampSeoTitle,
  fitSeoDescription,
} from "@/lib/seo-limits";

const DEFAULT_COVER = "/images/article-cover.jpg";
const DEFAULT_AUTHOR = "ทีมคอนเทนต์";

type ArticleSqlRow = RowDataPacket & {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_url: string | null;
  author: string;
  category: string | null;
  status: string;
  source: string;
  brief: string | null;
  seo_title: string | null;
  meta_description: string | null;
  keywords: string | null;
  submitted_by: string | null;
  reviewed_by: string | null;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function asIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapRow(row: ArticleSqlRow): ArticleRow {
  const status = isArticleStatus(row.status) ? row.status : "draft";
  const source = isArticleSource(row.source) ? row.source : "human";
  return {
    id: Number(row.id),
    slug: String(row.slug || ""),
    title: String(row.title || ""),
    excerpt: String(row.excerpt || ""),
    body: String(row.body || ""),
    coverUrl: String(row.cover_url || "").trim() || DEFAULT_COVER,
    author: String(row.author || "").trim() || DEFAULT_AUTHOR,
    category: resolveArticleTopic(row.category),
    status,
    source,
    brief: String(row.brief || ""),
    seoTitle: String(row.seo_title || ""),
    metaDescription: String(row.meta_description || ""),
    keywords: String(row.keywords || ""),
    submittedBy: String(row.submitted_by || ""),
    reviewedBy: String(row.reviewed_by || ""),
    publishedAt: asIso(row.published_at),
    createdAt: asIso(row.created_at) || new Date().toISOString(),
    updatedAt: asIso(row.updated_at) || new Date().toISOString(),
  };
}

export function toPublicArticle(row: ArticleRow): Article {
  const cover = row.coverUrl || DEFAULT_COVER;
  const seoTitle = clampSeoTitle(row.seoTitle || row.title);
  const metaDescription = fitSeoDescription(
    clampSeoDescription(row.metaDescription || row.excerpt),
  );
  return {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    cover,
    author: row.author,
    category: row.category,
    categoryName: ARTICLE_TOPIC_LABELS[resolveArticleTopic(row.category)],
    publishedAt: row.publishedAt || row.createdAt,
    updatedAt: row.updatedAt,
    seo: {
      seoTitle,
      metaDescription,
      canonicalPath: `/blog/${row.slug}`,
      ogImage: cover,
      keywords: row.keywords || undefined,
    },
  };
}

async function takenSlugs(exceptId?: number): Promise<Set<string>> {
  const rows = exceptId
    ? await smartgiftQuery<RowDataPacket[]>(
        `SELECT slug FROM sg_article WHERE id <> :id`,
        { id: exceptId },
      )
    : await smartgiftQuery<RowDataPacket[]>(`SELECT slug FROM sg_article`);
  return new Set(rows.map((row) => String(row.slug || "")));
}

export type ArticleListFilter = {
  status?: ArticleStatus | "";
  q?: string;
  limit?: number;
  offset?: number;
};

function listWhere(filter: ArticleListFilter): { sql: string; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.status) {
    clauses.push("status = :status");
    params.status = filter.status;
  }
  const q = (filter.q || "").trim();
  if (q) {
    clauses.push("(title LIKE :q OR slug LIKE :q OR excerpt LIKE :q)");
    params.q = `%${q}%`;
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export async function countArticles(filter: ArticleListFilter = {}): Promise<number> {
  await ensureArticleSchema();
  const { sql, params } = listWhere(filter);
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM sg_article ${sql}`,
    params,
  );
  return Number(rows[0]?.n ?? 0);
}

export async function countArticlesByStatus(): Promise<Record<ArticleStatus, number>> {
  await ensureArticleSchema();
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT status, COUNT(*) AS n FROM sg_article GROUP BY status`,
  );
  const out: Record<ArticleStatus, number> = {
    draft: 0,
    review: 0,
    scheduled: 0,
    live: 0,
    archived: 0,
  };
  for (const row of rows) {
    if (isArticleStatus(String(row.status))) {
      out[row.status as ArticleStatus] = Number(row.n ?? 0);
    }
  }
  return out;
}

export async function listArticles(filter: ArticleListFilter = {}): Promise<ArticleRow[]> {
  await ensureArticleSchema();
  const { sql, params } = listWhere(filter);
  const limit = Math.min(Math.max(Number(filter.limit) || 50, 1), 200);
  const offset = Math.max(Number(filter.offset) || 0, 0);
  const rows = await smartgiftQuery<ArticleSqlRow[]>(
    `SELECT * FROM sg_article ${sql}
     ORDER BY FIELD(status,'review','scheduled','draft','live','archived'),
              COALESCE(published_at, updated_at) ASC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return rows.map(mapRow);
}

export async function getArticleById(id: number): Promise<ArticleRow | null> {
  await ensureArticleSchema();
  if (!id) return null;
  const rows = await smartgiftQuery<ArticleSqlRow[]>(
    `SELECT * FROM sg_article WHERE id = :id LIMIT 1`,
    { id },
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function publishDueArticles(now = new Date()): Promise<number> {
  if (!isSmartgiftMysqlEnabled()) return 0;
  if (!(await articleTableReady())) return 0;
  await ensureArticleSchema();
  const result = await smartgiftExec(
    `UPDATE sg_article
     SET status = 'live',
         reviewed_by = COALESCE(reviewed_by, 'scheduler')
     WHERE status = 'scheduled'
       AND published_at IS NOT NULL
       AND published_at <= :now`,
    { now },
  );
  return Number((result as ResultSetHeader).affectedRows || 0);
}

export async function listLivePublicArticles(): Promise<Article[]> {
  if (!isSmartgiftMysqlEnabled()) return [];
  if (!(await articleTableReady())) return [];
  try {
    await publishDueArticles();
    const rows = await smartgiftQuery<ArticleSqlRow[]>(
      `SELECT * FROM sg_article
       WHERE status = 'live'
         AND (published_at IS NULL OR published_at <= NOW())
       ORDER BY COALESCE(published_at, created_at) DESC`,
    );
    return rows.map((row) => toPublicArticle(mapRow(row)));
  } catch {
    return [];
  }
}

export async function getLivePublicArticleBySlug(slug: string): Promise<Article | null> {
  if (!isSmartgiftMysqlEnabled()) return null;
  if (!(await articleTableReady())) return null;
  const wanted = String(slug || "").trim();
  if (!ARTICLE_SLUG_PATTERN.test(wanted)) return null;
  try {
    await publishDueArticles();
    const rows = await smartgiftQuery<ArticleSqlRow[]>(
      `SELECT * FROM sg_article
       WHERE slug = :slug
         AND status = 'live'
         AND (published_at IS NULL OR published_at <= NOW())
       LIMIT 1`,
      { slug: wanted },
    );
    return rows[0] ? toPublicArticle(mapRow(rows[0])) : null;
  } catch {
    return null;
  }
}

export type SaveArticleInput = {
  title: string;
  slug?: string;
  excerpt: string;
  body: string;
  coverUrl?: string;
  author?: string;
  source?: ArticleSource;
  brief?: string;
  seoTitle?: string;
  metaDescription?: string;
  keywords?: string;
  category?: string;
};

function normalizeSave(input: SaveArticleInput, taken: Set<string>): {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverUrl: string | null;
  author: string;
  source: ArticleSource;
  brief: string | null;
  seoTitle: string;
  metaDescription: string;
  keywords: string;
  category: ArticleTopic;
} {
  const title = String(input.title || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const excerpt = String(input.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 280);
  const body = toArticleHtml(String(input.body || "").trim());
  if (!title) throw new Error("invalid_title");
  if (!excerpt) throw new Error("invalid_excerpt");
  if (!body) throw new Error("invalid_body");
  const slug = nextUniqueSlug(input.slug || title, taken);
  if (!ARTICLE_SLUG_PATTERN.test(slug)) throw new Error("invalid_slug");
  const cover = String(input.coverUrl || "").trim().slice(0, 512) || null;
  const author =
    String(input.author || "").trim().slice(0, 120) || DEFAULT_AUTHOR;
  return {
    title,
    slug,
    excerpt,
    body,
    coverUrl: cover,
    author,
    source: input.source === "ai" ? "ai" : "human",
    brief: String(input.brief || "").trim().slice(0, 800) || null,
    seoTitle: clampSeoTitle(input.seoTitle || title),
    metaDescription: fitSeoDescription(
      clampSeoDescription(input.metaDescription || excerpt),
    ),
    keywords: String(input.keywords || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(", ")
      .slice(0, 240),
    category: normalizeCategory(input.category),
  };
}

function normalizeCategory(value: string | undefined): ArticleTopic {
  const raw = String(value || "").trim();
  if (!raw) return "gift";
  if (!isArticleTopic(raw)) throw new Error("invalid_category");
  return raw;
}

export async function createArticle(input: SaveArticleInput): Promise<ArticleRow> {
  await ensureArticleSchema();
  const taken = await takenSlugs();
  const row = normalizeSave(input, taken);
  const result = await smartgiftExec(
    `INSERT INTO sg_article (
       slug, title, excerpt, body, cover_url, author, category, status, source, brief,
       seo_title, meta_description, keywords
     ) VALUES (
       :slug, :title, :excerpt, :body, :cover_url, :author, :category, 'draft', :source, :brief,
       :seo_title, :meta_description, :keywords
     )`,
    {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      body: row.body,
      cover_url: row.coverUrl,
      author: row.author,
      category: row.category,
      source: row.source,
      brief: row.brief,
      seo_title: row.seoTitle,
      meta_description: row.metaDescription,
      keywords: row.keywords,
    },
  );
  const created = await getArticleById(Number((result as ResultSetHeader).insertId));
  if (!created) throw new Error("create_failed");
  return created;
}

export async function updateArticle(
  id: number,
  input: SaveArticleInput,
): Promise<ArticleRow> {
  await ensureArticleSchema();
  const existing = await getArticleById(id);
  if (!existing) throw new Error("article_not_found");
  if (existing.status === "live") throw new Error("unpublish_before_edit");
  const taken = await takenSlugs(id);
  const row = normalizeSave(
    { ...input, source: existing.source === "ai" ? "ai" : input.source },
    taken,
  );
  await smartgiftExec(
    `UPDATE sg_article SET
       slug = :slug,
       title = :title,
       excerpt = :excerpt,
       body = :body,
       cover_url = :cover_url,
       author = :author,
       category = :category,
       brief = :brief,
       seo_title = :seo_title,
       meta_description = :meta_description,
       keywords = :keywords
     WHERE id = :id`,
    {
      id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      body: row.body,
      cover_url: row.coverUrl,
      author: row.author,
      category: row.category,
      brief: row.brief,
      seo_title: row.seoTitle,
      meta_description: row.metaDescription,
      keywords: row.keywords,
    },
  );
  const updated = await getArticleById(id);
  if (!updated) throw new Error("article_not_found");
  return updated;
}

export async function setArticleStatus(input: {
  id: number;
  to: ArticleStatus;
  isAdmin: boolean;
  actorEmail: string;
  publishAt?: Date | null;
}): Promise<ArticleRow> {
  await ensureArticleSchema();
  const existing = await getArticleById(input.id);
  if (!existing) throw new Error("article_not_found");
  const blocked = articleTransitionError({
    from: existing.status,
    to: input.to,
    isAdmin: input.isAdmin,
  });
  if (blocked) throw new Error(blocked);
  if (existing.status === input.to && input.to !== "scheduled") return existing;

  let publishedAt: Date | null;
  if (input.to === "scheduled") {
    if (!input.publishAt || Number.isNaN(input.publishAt.getTime())) {
      throw new Error("invalid_publish_at");
    }
    if (!isFuturePublishAt(input.publishAt)) throw new Error("publish_at_not_future");
    publishedAt = input.publishAt;
  } else if (input.to === "live") {
    const existingDate = asDate(existing.publishedAt);
    publishedAt =
      existingDate && existingDate.getTime() <= Date.now() ? existingDate : new Date();
  } else if (input.to === "archived") {
    publishedAt = asDate(existing.publishedAt);
  } else {
    publishedAt = null;
  }

  await smartgiftExec(
    `UPDATE sg_article SET
       status = :status,
       submitted_by = CASE WHEN :to_review = 1 THEN :actor ELSE submitted_by END,
       reviewed_by = CASE WHEN :to_live = 1 THEN :actor ELSE reviewed_by END,
       published_at = :published_at
     WHERE id = :id`,
    {
      id: input.id,
      status: input.to,
      actor: input.actorEmail,
      to_review: input.to === "review" ? 1 : 0,
      to_live: input.to === "live" ? 1 : 0,
      published_at: publishedAt,
    },
  );
  const updated = await getArticleById(input.id);
  if (!updated) throw new Error("article_not_found");
  return updated;
}

export { slugifyArticle };
