-- SmartGift offer document (header + BOM + qty price ladder)
-- Maps 1:1 to catalog_offers[] in 1smartgift_catalog_master.json
-- Example: TSQ01-2 / Light humidifier + neck massager (P-02)

SET NAMES utf8mb4;
USE smartgift;
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS v_sg_offer_document;
DROP TABLE IF EXISTS sg_offer_alias;
DROP TABLE IF EXISTS sg_offer_price;
DROP TABLE IF EXISTS sg_offer_item;
DROP TABLE IF EXISTS sg_offer;

CREATE TABLE sg_offer (
  offer_code            VARCHAR(32)  NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  gift_tier             VARCHAR(32)  NULL,
  supplier_code         VARCHAR(32)  NULL COMMENT 'default / catalog supplier, e.g. P-02',
  interest_theme        VARCHAR(255) NULL,
  interest_theme_slug   VARCHAR(64)  NULL,
  catalog_match_status  VARCHAR(64)  NULL,
  unboxing_experience   TEXT         NULL,
  image_url             VARCHAR(512) NULL,
  source_slug           VARCHAR(128) NULL,
  lead_days             SMALLINT     NULL,
  source_url            VARCHAR(512) NULL,
  product_master        VARCHAR(64) NULL,
  product_family        VARCHAR(64) NULL,
  catalog_page          INT           NULL,
  price_source          VARCHAR(32) NULL COMMENT 'flowaccount | catalog_json | null',
  has_price             TINYINT(1)  NOT NULL DEFAULT 0,
  price_min             DECIMAL(12,2) NULL,
  price_max             DECIMAL(12,2) NULL,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (offer_code),
  KEY idx_sg_offer_supplier (supplier_code),
  KEY idx_sg_offer_theme (interest_theme_slug),
  KEY idx_sg_offer_tier (gift_tier),
  KEY idx_sg_offer_family (product_family),
  KEY idx_sg_offer_source_slug (source_slug),
  CONSTRAINT fk_sg_offer_theme
    FOREIGN KEY (interest_theme_slug) REFERENCES sg_categories (slug)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='catalog offer header = one JSON object in catalog_offers';

CREATE TABLE sg_offer_item (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  offer_code    VARCHAR(32)  NOT NULL,
  line_no       SMALLINT UNSIGNED NOT NULL,
  product_code  VARCHAR(32)  NOT NULL,
  qty           INT          NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sg_offer_item_line (offer_code, line_no),
  UNIQUE KEY uk_sg_offer_item_product (offer_code, product_code),
  KEY idx_sg_offer_item_product (product_code),
  CONSTRAINT fk_sg_offer_item_offer
    FOREIGN KEY (offer_code) REFERENCES sg_offer (offer_code)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sg_offer_item_product
    FOREIGN KEY (product_code) REFERENCES sg_products (code)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='offer components[] BOM lines';

CREATE TABLE sg_offer_price (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  offer_code           VARCHAR(32)  NOT NULL,
  supplier_code        VARCHAR(32)  NOT NULL DEFAULT '' COMMENT 'price list group e.g. P-02',
  min_qty              INT          NOT NULL,
  unit_price           DECIMAL(12,2) NOT NULL,
  unit_price_with_vat  DECIMAL(12,2) NULL,
  currency             CHAR(3)     NOT NULL DEFAULT 'THB',
  price_source         VARCHAR(32) NULL,
  commercial_sku       VARCHAR(80) NULL COMMENT 'e.g. TSQ01-2(P-02)-10',
  PRIMARY KEY (id),
  UNIQUE KEY uk_sg_offer_price (offer_code, supplier_code, min_qty),
  KEY idx_sg_offer_price_qty (min_qty, unit_price),
  KEY idx_sg_offer_price_sku (commercial_sku),
  CONSTRAINT fk_sg_offer_price_offer
    FOREIGN KEY (offer_code) REFERENCES sg_offer (offer_code)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='offer price_tiers[] per supplier qty ladder 10/20/50/100/500';

CREATE TABLE sg_offer_alias (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  offer_code  VARCHAR(32)  NOT NULL,
  alias       VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sg_offer_alias (offer_code, alias(191)),
  CONSTRAINT fk_sg_offer_alias_offer
    FOREIGN KEY (offer_code) REFERENCES sg_offer (offer_code)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW v_sg_offer_document AS
SELECT
  o.offer_code,
  JSON_OBJECT(
    'offer_code', o.offer_code,
    'name', o.name,
    'gift_tier', o.gift_tier,
    'supplier_code', o.supplier_code,
    'interest_theme', o.interest_theme,
    'interest_theme_slug', o.interest_theme_slug,
    'catalog_match_status', o.catalog_match_status,
    'components', (
      SELECT IFNULL(JSON_ARRAYAGG(JSON_OBJECT(
               'product_code', i.product_code,
               'qty', i.qty
             )), JSON_ARRAY())
      FROM sg_offer_item i
      WHERE i.offer_code = o.offer_code
    ),
    'price_tiers', (
      SELECT IFNULL(JSON_ARRAYAGG(JSON_OBJECT(
               'min_qty', p.min_qty,
               'unit_price', CAST(p.unit_price AS DOUBLE)
             )), JSON_ARRAY())
      FROM sg_offer_price p
      WHERE p.offer_code = o.offer_code
        AND p.supplier_code = IFNULL(o.supplier_code, '')
    ),
    'unboxing_experience', o.unboxing_experience,
    'product_master', o.product_master,
    'product_family', o.product_family,
    'price_source', o.price_source
  ) AS document
FROM sg_offer o;

SET FOREIGN_KEY_CHECKS = 1;
