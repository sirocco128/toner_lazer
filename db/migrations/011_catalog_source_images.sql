-- Ops-only 1688 / Alibaba listing photos found via Gemini web search.
-- Files live beside SQLite (.data/catalog-images). Not public catalog media.

CREATE TABLE IF NOT EXISTS catalog_source_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id TEXT NOT NULL UNIQUE,
  product_slug TEXT,
  query TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  source_page_url TEXT NOT NULL,
  source_image_url TEXT NOT NULL,
  local_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  checksum_sha256 TEXT,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'saved',
  created_at TEXT NOT NULL,
  created_by_email TEXT,
  gemini_model TEXT
);

CREATE INDEX IF NOT EXISTS idx_catalog_source_images_created
  ON catalog_source_images (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_source_images_slug
  ON catalog_source_images (product_slug, created_at DESC);
