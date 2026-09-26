import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  isValidSeoDescription,
  isValidSeoTitle,
  fitSeoDescription,
} from "../lib/seo-limits";
import { listDefaultSeoPages, mergeSeoFields } from "../lib/page-seo";
import { IDEA_THEMES, getIdeaTheme } from "../lib/seo-themes";
import { draftPageSeo } from "../lib/seo-draft";
import {
  pathFromSeoPrompt,
  wantsSeoApply,
  wantsSeoDraft,
} from "../lib/seo-assistant";
import { buildProductJsonLd } from "../lib/seo";
import { products } from "../lib/data";
import { closeDb } from "../lib/database";

function resolveProjectRoot(): string {
  if (
    process.env.PROJECT_ROOT &&
    existsSync(join(process.env.PROJECT_ROOT, "package.json"))
  ) {
    return process.env.PROJECT_ROOT;
  }
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = join(dir, "..");
  }
  return join(__dirname, "..");
}

const ROOT = resolveProjectRoot();

describe("page SEO catalog", () => {
  it("keeps every default title/description in SEO bounds", () => {
    const pages = listDefaultSeoPages();
    assert.ok(pages.length >= 16);
    for (const page of pages) {
      assert.ok(
        isValidSeoTitle(page.seo.seoTitle),
        `${page.path} title length ${page.seo.seoTitle.length}: ${page.seo.seoTitle}`,
      );
      assert.ok(
        isValidSeoDescription(page.seo.metaDescription),
        `${page.path} description length ${page.seo.metaDescription.length}`,
      );
      assert.equal(page.seo.canonicalPath, page.path);
    }
  });

  it("covers nature culture travel health idea pages", () => {
    assert.deepEqual(
      IDEA_THEMES.map((theme) => theme.slug),
      ["nature", "culture", "travel", "health"],
    );
    assert.equal(getIdeaTheme("nature")?.name, "ธรรมชาติ");
    assert.equal(getIdeaTheme("nope"), null);
  });

  it("merges overlay fields without changing canonical path", () => {
    const merged = mergeSeoFields(
      {
        seoTitle: "เดิม",
        metaDescription: "x".repeat(130),
        canonicalPath: "/ideas/nature",
      },
      { seoTitle: "ใหม่ที่ยาวพอสำหรับทดสอบหัวข้อ" },
    );
    assert.equal(merged.seoTitle, "ใหม่ที่ยาวพอสำหรับทดสอบหัวข้อ");
    assert.equal(merged.canonicalPath, "/ideas/nature");
  });
});

describe("seo draft + assistant routing", () => {
  it("fits short descriptions into 120–160 characters", () => {
    const fitted = fitSeoDescription("ชุดของขวัญองค์กรธีมธรรมชาติ");
    assert.ok(isValidSeoDescription(fitted), fitted.length.toString());
  });

  it("drafts a valid template for a theme page without an LLM", async () => {
    const result = await draftPageSeo({
      path: "/ideas/health",
      brief: "เน้นกระบอกน้ำพนักงาน",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(isValidSeoTitle(result.draft.seoTitle));
    assert.ok(isValidSeoDescription(result.draft.metaDescription));
  });

  it("maps Thai theme prompts to idea paths", () => {
    assert.equal(pathFromSeoPrompt("ร่าง SEO ธีมธรรมชาติ"), "/ideas/nature");
    assert.equal(pathFromSeoPrompt("หน้า /ideas/travel"), "/ideas/travel");
    assert.equal(wantsSeoDraft("ร่าง SEO หน้าสุขภาพ"), true);
    assert.equal(wantsSeoApply("แล้วบันทึกลงเว็บ"), true);
  });
});

describe("product JSON-LD", () => {
  it("uses PreOrder and does not claim in-stock", () => {
    const product = products[0];
    assert.ok(product);
    const jsonLd = buildProductJsonLd(product);
    const offers = jsonLd.offers as { availability?: string };
    assert.equal(offers.availability, "https://schema.org/PreOrder");
    assert.notEqual(offers.availability, "https://schema.org/InStock");
  });
});

describe("seo overlay repository", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "giftset-seo-"));
  const sqlitePath = join(dataDir, "leads.sqlite");

  it("persists and reads an override after migrate", async () => {
    process.env.SQLITE_PATH = sqlitePath;
    closeDb();
    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: sqlitePath },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

    const { upsertSeoOverride, getSeoOverride } = await import(
      "../lib/seo-repository"
    );
    upsertSeoOverride({
      path: "/ideas/nature",
      seoTitle: "ของขวัญองค์กรธีมธรรมชาติ ทดสอบ",
      metaDescription:
        "ไอเดียชุดของขวัญองค์กรธีมธรรมชาติสำหรับทดสอบระบบบันทึก SEO ลงหน้าเว็บ สกรีนโลโก้ได้ สั่งผลิตตามออเดอร์จากจีน ขอใบเสนอราคาได้",
      actorEmail: "sales@test.local",
    });
    const saved = getSeoOverride("/ideas/nature");
    assert.ok(saved);
    assert.equal(saved?.seoTitle, "ของขวัญองค์กรธีมธรรมชาติ ทดสอบ");
    closeDb();
  });

  after(() => {
    closeDb();
    rmSync(dataDir, { recursive: true, force: true });
  });
});
