import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { extractOfferImagesFromHtml } from "../lib/alibaba/images";
import {
  candidatesFromCitations,
  mergeSourceImageCandidates,
  parseGeminiSearchJson,
} from "../lib/alibaba/gemini-parse";
import {
  extract1688OfferId,
  extractAlibabaListingUrls,
  normalizeAlibabaListingUrl,
} from "../lib/alibaba/listing-urls";
import { extractOpenRouterCitations } from "../lib/openrouter-chat";

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

describe("1688 / Alibaba listing URLs", () => {
  it("keeps real offer and product-detail pages", () => {
    assert.equal(
      normalizeAlibabaListingUrl(
        "https://detail.1688.com/offer/720123456789.html?spm=a",
      ),
      "https://detail.1688.com/offer/720123456789.html",
    );
    assert.equal(
      normalizeAlibabaListingUrl(
        "https://www.alibaba.com/product-detail/Custom-Tumbler_1600123456789.html?from=xx",
      ),
      "https://www.alibaba.com/product-detail/Custom-Tumbler_1600123456789.html",
    );
    assert.equal(extract1688OfferId("https://detail.1688.com/offer/720123456789.html"), "720123456789");
  });

  it("drops invented or non-listing URLs", () => {
    assert.equal(normalizeAlibabaListingUrl("https://evil.example/offer/123456.html"), null);
    assert.equal(normalizeAlibabaListingUrl("https://detail.1688.com/"), null);
    assert.equal(normalizeAlibabaListingUrl("javascript:alert(1)"), null);
    assert.equal(normalizeAlibabaListingUrl("https://passport.1688.com/offer/720123456789.html"), null);
  });

  it("unwraps Google image redirects to 1688 listings", () => {
    const wrapped =
      "https://www.google.com/imgres?imgurl=https%3A%2F%2Fcbu01.alicdn.com%2Fkf%2Fp.jpg&imgrefurl=https%3A%2F%2Fdetail.1688.com%2Foffer%2F720123456789.html";
    assert.equal(
      normalizeAlibabaListingUrl(wrapped),
      "https://detail.1688.com/offer/720123456789.html",
    );
  });

  it("extracts listings from mixed model text", () => {
    const text = [
      "see https://detail.1688.com/offer/720123456789.html and",
      "https://www.alibaba.com/product-detail/Pen_1600999.html",
      "ignore https://shopee.com/item/1",
    ].join(" ");
    const urls = extractAlibabaListingUrls(text);
    assert.equal(urls.length, 2);
    assert.ok(urls[0]?.includes("1688.com"));
    assert.ok(urls[1]?.includes("alibaba.com"));
  });
});

describe("Gemini search parse", () => {
  it("keeps only allowlisted page + alicdn image pairs", () => {
    const parsed = parseGeminiSearchJson(`
      here
      {"results":[
        {"title":"Tumbler","platform":"1688","pageUrl":"https://detail.1688.com/offer/720123456789.html","imageUrl":"https://cbu01.alicdn.com/kf/ok.jpg"},
        {"title":"Fake","platform":"1688","pageUrl":"https://detail.1688.com/offer/720123456789.html","imageUrl":"https://evil.example/x.jpg"},
        {"title":"Wiki","platform":"alibaba","pageUrl":"https://en.wikipedia.org/wiki/Mug","imageUrl":"https://cbu01.alicdn.com/kf/ok.jpg"}
      ]}
    `);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]?.imageUrl, "https://cbu01.alicdn.com/kf/ok.jpg");
    assert.equal(parsed[0]?.pageUrl, "https://detail.1688.com/offer/720123456789.html");
  });

  it("pulls alicdn photos from citation snippets", () => {
    const found = candidatesFromCitations([
      {
        url: "https://detail.1688.com/offer/720123456789.html",
        title: "礼品杯",
        content: 'img src="https://cbu01.alicdn.com/kf/live.jpg" and https://evil.example/x.jpg',
      },
    ]);
    assert.equal(found.length, 1);
    assert.equal(found[0]?.imageUrl, "https://cbu01.alicdn.com/kf/live.jpg");
    assert.equal(found[0]?.platform, "1688");
  });

  it("merges unique candidates and caps", () => {
    const a = {
      title: "A",
      platform: "1688" as const,
      pageUrl: "https://detail.1688.com/offer/720123456789.html",
      imageUrl: "https://cbu01.alicdn.com/kf/a.jpg",
    };
    const merged = mergeSourceImageCandidates([[a], [a, { ...a, imageUrl: "https://cbu01.alicdn.com/kf/b.jpg" }]]);
    assert.equal(merged.length, 2);
  });

  it("reads OpenRouter url_citation annotations", () => {
    const citations = extractOpenRouterCitations({
      choices: [
        {
          message: {
            content: "{}",
            annotations: [
              {
                type: "url_citation",
                url_citation: {
                  url: "https://detail.1688.com/offer/720123456789.html",
                  title: "offer",
                  content: "https://cbu01.alicdn.com/kf/p.jpg",
                },
              },
            ],
          },
        },
      ],
    });
    assert.equal(citations.length, 1);
    assert.match(citations[0]!.url, /1688\.com/);
  });
});

describe("HTML alicdn extract", () => {
  it("finds s.alicdn and cbu01 URLs in markup", () => {
    const html = `
      <img src="https://cbu01.alicdn.com/kf/p.jpg" />
      <img src="https://s.alicdn.com/@sc04/kf/Habc.jpg" />
      <img src="https://s.alicdn.com/@img/imgextra/i2/O1CN01-tps-3840-80.png" />
      <img src="https://s.alicdn.com/@sc04/kf/Hicon.jpg_60x60.jpg" />
      <img src="https://evil.example/x.jpg" />
    `;
    const urls = extractOfferImagesFromHtml(html);
    assert.ok(urls.includes("https://cbu01.alicdn.com/kf/p.jpg"));
    assert.ok(urls.some((url) => url.includes("s.alicdn.com")));
    assert.equal(urls.some((url) => url.includes("evil")), false);
    assert.equal(urls.some((url) => url.includes("tps-3840-80")), false);
    assert.equal(urls.some((url) => url.includes("60x60")), false);
  });
});

describe("catalog_source_images table", () => {
  let dataDir = "";
  let sqlitePath = "";

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), "giftset-catalog-img-"));
    sqlitePath = join(dataDir, "leads.sqlite");
    process.env.SQLITE_PATH = sqlitePath;
    const migrate = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: ROOT,
      env: { ...process.env, SQLITE_PATH: sqlitePath },
      encoding: "utf8",
    });
    assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);
  });

  after(async () => {
    try {
      const { closeDb } = await import("../lib/database");
      closeDb();
    } catch {
      // ignore
    }
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists rows saved beside sqlite", async () => {
    const { closeDb } = await import("../lib/database");
    closeDb();
    const { getDb } = await import("../lib/database");
    const { listCatalogSourceImages, getCatalogSourceImageByImageId, catalogImagesDir } =
      await import("../lib/catalog-source-images");

    mkdirSync(catalogImagesDir(), { recursive: true });
    writeFileSync(join(catalogImagesDir(), "CSI-TEST00000001.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0x00]));

    getDb()
      .prepare(
        `INSERT INTO catalog_source_images (
          image_id, product_slug, query, source_platform, source_page_url, source_image_url,
          local_path, content_type, byte_size, title, status, created_at, created_by_email, gemini_model
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'saved', ?, ?, ?)`,
      )
      .run(
        "CSI-TEST00000001",
        "tumbler-notebook-pen-set",
        "กระบอกน้ำ",
        "1688",
        "https://detail.1688.com/offer/720123456789.html",
        "https://cbu01.alicdn.com/kf/ok.jpg",
        "CSI-TEST00000001.jpg",
        "image/jpeg",
        4,
        "礼品杯",
        new Date().toISOString(),
        "admin",
        "google/gemini-2.5-flash",
      );

    const rows = listCatalogSourceImages(10);
    assert.ok(rows.some((row) => row.imageId === "CSI-TEST00000001"));
    const one = getCatalogSourceImageByImageId("CSI-TEST00000001");
    assert.equal(one?.productSlug, "tumbler-notebook-pen-set");
    assert.equal(one?.sourcePlatform, "1688");
  });
});
