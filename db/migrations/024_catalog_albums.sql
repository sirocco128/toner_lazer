-- Ops-created catalog albums (FlipHTML5-style publications without their API).
-- Inbox files have album_id NULL until assembled into a published book.

CREATE TABLE IF NOT EXISTS catalog_albums (
  album_id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  layout TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  filter_slug TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by_email TEXT,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_catalog_albums_created
  ON catalog_albums (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_albums_status
  ON catalog_albums (status, created_at DESC);

CREATE TABLE IF NOT EXISTS catalog_album_files (
  file_id TEXT PRIMARY KEY NOT NULL,
  album_id TEXT,
  group_slug TEXT NOT NULL,
  original_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_kind TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by_email TEXT,
  FOREIGN KEY (album_id) REFERENCES catalog_albums (album_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_album_files_inbox
  ON catalog_album_files (album_id, group_slug, sort_order);

CREATE INDEX IF NOT EXISTS idx_catalog_album_files_album
  ON catalog_album_files (album_id);
