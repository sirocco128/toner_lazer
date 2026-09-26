/**
 * Apply sg_article on SmartGift MySQL.
 * Ops pages may ensure. Public blog must only read if the table already exists.
 */

import type { RowDataPacket } from "mysql2/promise";
import {
  isSmartgiftMysqlEnabled,
  smartgiftExec,
  smartgiftQuery,
} from "@/lib/smartgift-mysql";

const DDL = `CREATE TABLE IF NOT EXISTS sg_article (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(200) NOT NULL,
  excerpt VARCHAR(280) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  cover_url VARCHAR(512) NULL,
  author VARCHAR(120) NOT NULL DEFAULT 'ทีมคอนเทนต์',
  category VARCHAR(32) NOT NULL DEFAULT 'gift',
  status ENUM('draft','review','scheduled','live','archived') NOT NULL DEFAULT 'draft',
  source ENUM('human','ai') NOT NULL DEFAULT 'human',
  brief VARCHAR(800) NULL,
  seo_title VARCHAR(60) NULL,
  meta_description VARCHAR(160) NULL,
  keywords VARCHAR(240) NULL,
  submitted_by VARCHAR(160) NULL,
  reviewed_by VARCHAR(160) NULL,
  published_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sg_article_slug (slug),
  KEY idx_sg_article_status (status, published_at),
  KEY idx_sg_article_category (category, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let ensured: Promise<void> | null = null;

export function resetArticleSchemaCache(): void {
  ensured = null;
}

export async function articleTableReady(): Promise<boolean> {
  if (!isSmartgiftMysqlEnabled()) return false;
  try {
    await smartgiftQuery("SELECT 1 FROM sg_article LIMIT 1");
    return true;
  } catch {
    return false;
  }
}

async function columnExists(column: string): Promise<boolean> {
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT 1 AS ok FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'sg_article' AND column_name = :column
     LIMIT 1`,
    { column },
  );
  return rows.length > 0;
}

async function ensureOnce(): Promise<void> {
  if (!isSmartgiftMysqlEnabled()) {
    throw new Error("SmartGift MySQL is not enabled");
  }
  await smartgiftExec(DDL);
  if (!(await columnExists("category"))) {
    await smartgiftExec(
      `ALTER TABLE sg_article ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT 'gift' AFTER author`,
    );
  }
  await smartgiftExec(
    `ALTER TABLE sg_article
     MODIFY status ENUM('draft','review','scheduled','live','archived') NOT NULL DEFAULT 'draft'`,
  );
}

export async function ensureArticleSchema(): Promise<void> {
  if (!ensured) {
    ensured = ensureOnce().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  await ensured;
}

export async function articleTableExists(): Promise<boolean> {
  if (!isSmartgiftMysqlEnabled()) return false;
  const rows = await smartgiftQuery<RowDataPacket[]>(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'sg_article' LIMIT 1`,
  );
  return rows.length > 0;
}
