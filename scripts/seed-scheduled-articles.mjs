#!/usr/bin/env node
/**
 * Queue the thirty planned articles as status=scheduled.
 * Skips rows that are already live. Updates draft/review/scheduled copies.
 *
 * Usage: node scripts/seed-scheduled-articles.mjs
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

const tsc = spawnSync(
  process.execPath,
  [resolve(ROOT, "node_modules/typescript/lib/tsc.js"), "-p", "tsconfig.test.json", "--pretty", "false"],
  { cwd: ROOT, stdio: "inherit" },
);
if (tsc.status !== 0) {
  process.exit(tsc.status ?? 1);
}

const preloadPath = resolve(ROOT, ".tmp/test-alias-preload.cjs");
writeFileSync(
  preloadPath,
  `
const path = require("node:path");
const Module = require("node:module");
const root = ${JSON.stringify(resolve(ROOT, ".tmp/tests"))};
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === "string" && request.startsWith("@/")) {
    request = path.join(root, request.slice(2));
  }
  return original.call(this, request, parent, isMain, options);
};
`,
  "utf8",
);
require(preloadPath);
const { PLANNED_ARTICLES } = require(resolve(ROOT, ".tmp/tests/lib/article-publish-plan.js"));

const conn = await mysql.createConnection({
  host: process.env.SMARTGIFT_MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.SMARTGIFT_MYSQL_PORT || 3307),
  user: process.env.SMARTGIFT_MYSQL_USER || "biz",
  password: process.env.SMARTGIFT_MYSQL_PASSWORD || "biz_secret",
  database: process.env.SMARTGIFT_MYSQL_DATABASE || "smartgift",
  charset: "utf8mb4",
});

await conn.query(
  `CREATE TABLE IF NOT EXISTS sg_article (
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
    KEY idx_sg_article_status (status, published_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
);

const [categoryCols] = await conn.query(
  `SELECT 1 AS ok FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'sg_article' AND column_name = 'category' LIMIT 1`,
);
if (!categoryCols.length) {
  await conn.query(
    `ALTER TABLE sg_article ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT 'gift' AFTER author`,
  );
}
await conn.query(
  `ALTER TABLE sg_article
   MODIFY status ENUM('draft','review','scheduled','live','archived') NOT NULL DEFAULT 'draft'`,
);

let inserted = 0;
let updated = 0;
let skipped = 0;

for (const article of PLANNED_ARTICLES) {
  const [rows] = await conn.query(`SELECT id, status FROM sg_article WHERE slug = ? LIMIT 1`, [
    article.slug,
  ]);
  const existing = rows[0];
  if (existing && existing.status === "live") {
    skipped += 1;
    console.log(`skip live ${article.slug}`);
    continue;
  }
  const params = [
    article.title,
    article.excerpt,
    article.body,
    article.coverUrl,
    article.category,
    article.seoTitle,
    article.metaDescription,
    article.keywords,
    article.publishAt,
  ];
  if (existing) {
    await conn.query(
      `UPDATE sg_article SET
         title = ?, excerpt = ?, body = ?, cover_url = ?, author = 'ทีมคอนเทนต์',
         category = ?, status = 'scheduled', source = 'human',
         brief = 'คิวเผยแพร่ 30 บทความ',
         seo_title = ?, meta_description = ?, keywords = ?,
         reviewed_by = 'seed-schedule', published_at = ?
       WHERE id = ?`,
      [...params, existing.id],
    );
    updated += 1;
    console.log(`updated ${article.slug}`);
  } else {
    await conn.query(
      `INSERT INTO sg_article (
         slug, title, excerpt, body, cover_url, author, category, status, source, brief,
         seo_title, meta_description, keywords, reviewed_by, published_at
       ) VALUES (?, ?, ?, ?, ?, 'ทีมคอนเทนต์', ?, 'scheduled', 'human', 'คิวเผยแพร่ 30 บทความ', ?, ?, ?, 'seed-schedule', ?)`,
      [article.slug, ...params],
    );
    inserted += 1;
    console.log(`scheduled ${article.slug}`);
  }
}

console.log(`done inserted=${inserted} updated=${updated} skipped=${skipped}`);
await conn.end();
