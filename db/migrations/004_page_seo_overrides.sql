-- Public-page SEO overrides (ops / AI). Defaults live in code + CMS.

CREATE TABLE IF NOT EXISTS page_seo_overrides (
  path TEXT PRIMARY KEY NOT NULL,
  seo_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  og_image TEXT,
  keywords TEXT,
  no_index INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by_email TEXT,
  updated_by_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_page_seo_overrides_updated_at
  ON page_seo_overrides (updated_at DESC);
