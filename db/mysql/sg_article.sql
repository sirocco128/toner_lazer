-- Editorial blog on SmartGift MySQL. Public site reads status=live only.
-- AI drafts land as draft/review — never auto-publish.

SET NAMES utf8mb4;
USE smartgift;

CREATE TABLE IF NOT EXISTS sg_article (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug             VARCHAR(160) NOT NULL,
  title            VARCHAR(200) NOT NULL,
  excerpt          VARCHAR(280) NOT NULL,
  body             MEDIUMTEXT NOT NULL,
  cover_url        VARCHAR(512) NULL,
  author           VARCHAR(120) NOT NULL DEFAULT 'ทีมคอนเทนต์',
  category         VARCHAR(32) NOT NULL DEFAULT 'gift',
  status           ENUM('draft','review','scheduled','live','archived') NOT NULL DEFAULT 'draft',
  source           ENUM('human','ai') NOT NULL DEFAULT 'human',
  brief            VARCHAR(800) NULL,
  seo_title        VARCHAR(60) NULL,
  meta_description VARCHAR(160) NULL,
  keywords         VARCHAR(240) NULL,
  submitted_by     VARCHAR(160) NULL,
  reviewed_by      VARCHAR(160) NULL,
  published_at     DATETIME NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sg_article_slug (slug),
  KEY idx_sg_article_status (status, published_at),
  KEY idx_sg_article_category (category, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ops-reviewed blog; live rows only on the public storefront';
