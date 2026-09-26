/**
 * SQLite overrides for public-page SEO. Missing table = no overlay.
 */

import { getDb } from "@/lib/database";
import type { SeoFields } from "@/lib/data";
import { normalizeSeoPath } from "@/lib/seo-path";

export type SeoOverrideRecord = SeoFields & {
  updatedAt: string;
  updatedByEmail: string | null;
  updatedByName: string | null;
};

type SeoOverrideRow = {
  path: string;
  seo_title: string;
  meta_description: string;
  og_image: string | null;
  keywords: string | null;
  no_index: number;
  updated_at: string;
  updated_by_email: string | null;
  updated_by_name: string | null;
};

function mapRow(row: SeoOverrideRow): SeoOverrideRecord {
  return {
    seoTitle: row.seo_title,
    metaDescription: row.meta_description,
    canonicalPath: row.path,
    ogImage: row.og_image || undefined,
    keywords: row.keywords || undefined,
    noIndex: row.no_index === 1,
    updatedAt: row.updated_at,
    updatedByEmail: row.updated_by_email,
    updatedByName: row.updated_by_name,
  };
}

export function getSeoOverride(path: string): SeoOverrideRecord | null {
  try {
    const row = getDb()
      .prepare(
        `SELECT path, seo_title, meta_description, og_image, keywords,
                no_index, updated_at, updated_by_email, updated_by_name
         FROM page_seo_overrides WHERE path = ?`,
      )
      .get(normalizeSeoPath(path)) as SeoOverrideRow | undefined;
    return row ? mapRow(row) : null;
  } catch {
    return null;
  }
}

export function listSeoOverrides(): SeoOverrideRecord[] {
  try {
    const rows = getDb()
      .prepare(
        `SELECT path, seo_title, meta_description, og_image, keywords,
                no_index, updated_at, updated_by_email, updated_by_name
         FROM page_seo_overrides ORDER BY updated_at DESC`,
      )
      .all() as SeoOverrideRow[];
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

export type UpsertSeoOverrideInput = {
  path: string;
  seoTitle: string;
  metaDescription: string;
  ogImage?: string | null;
  keywords?: string | null;
  noIndex?: boolean;
  actorEmail?: string | null;
  actorName?: string | null;
};

export function upsertSeoOverride(input: UpsertSeoOverrideInput): SeoOverrideRecord {
  const path = normalizeSeoPath(input.path);
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO page_seo_overrides (
         path, seo_title, meta_description, og_image, keywords, no_index,
         updated_at, updated_by_email, updated_by_name
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         seo_title = excluded.seo_title,
         meta_description = excluded.meta_description,
         og_image = excluded.og_image,
         keywords = excluded.keywords,
         no_index = excluded.no_index,
         updated_at = excluded.updated_at,
         updated_by_email = excluded.updated_by_email,
         updated_by_name = excluded.updated_by_name`,
    )
    .run(
      path,
      input.seoTitle.trim(),
      input.metaDescription.trim(),
      input.ogImage?.trim() || null,
      input.keywords?.trim() || null,
      input.noIndex ? 1 : 0,
      now,
      input.actorEmail ?? null,
      input.actorName ?? null,
    );

  const saved = getSeoOverride(path);
  if (!saved) {
    throw new Error("failed to persist SEO override");
  }
  return saved;
}

export function deleteSeoOverride(path: string): boolean {
  try {
    const result = getDb()
      .prepare("DELETE FROM page_seo_overrides WHERE path = ?")
      .run(normalizeSeoPath(path));
    return Number(result.changes) > 0;
  } catch {
    return false;
  }
}
