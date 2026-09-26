import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  articleTransitionError,
  formatBangkokDateTimeLocal,
  parseBangkokDateTimeLocal,
  slugifyArticle,
  toArticleHtml,
} from "../lib/article-types";
import {
  normalizeArticleDraft,
  type ArticleDraftPayload,
} from "../lib/article-draft";
import {
  mediaForTopic,
  resolveArticleTopic,
} from "../lib/article-media-catalog";
import { PLANNED_ARTICLES } from "../lib/article-publish-plan";
import { isValidSeoDescription, isValidSeoTitle } from "../lib/seo-limits";

describe("article blog", () => {
  it("slugifyArticle falls back when the title is Thai-only", () => {
    assert.equal(slugifyArticle("ชุดของขวัญองค์กร"), "bai-khwam");
    assert.equal(slugifyArticle("ชุดของขวัญองค์กร", "corporate-gifts"), "corporate-gifts");
    assert.equal(slugifyArticle("New Year Gift Set 2026"), "new-year-gift-set-2026");
  });

  it("toArticleHtml converts markdown headings and lists", () => {
    const html = toArticleHtml(
      ["## หัวข้อหลัก", "", "ย่อหน้าหนึ่ง", "", "- ข้อหนึ่ง", "- ข้อสอง", "", "### หัวข้อย่อย"].join(
        "\n",
      ),
    );
    assert.match(html, /<h2>หัวข้อหลัก<\/h2>/);
    assert.match(html, /<p>ย่อหน้าหนึ่ง<\/p>/);
    assert.match(html, /<li>ข้อหนึ่ง<\/li>/);
    assert.match(html, /<li>ข้อสอง<\/li>/);
    assert.match(html, /<h3>หัวข้อย่อย<\/h3>/);
  });

  it("articleTransitionError lets only admin publish", () => {
    assert.equal(
      articleTransitionError({ from: "review", to: "live", isAdmin: false }),
      "เฉพาะผู้ดูแลจึงจะเผยแพร่ได้",
    );
    assert.equal(
      articleTransitionError({ from: "review", to: "live", isAdmin: true }),
      null,
    );
    assert.equal(
      articleTransitionError({ from: "draft", to: "review", isAdmin: false }),
      null,
    );
    assert.equal(
      articleTransitionError({ from: "live", to: "draft", isAdmin: true }),
      "เปลี่ยนสถานะนี้ไม่ได้",
    );
  });

  it("resolveArticleTopic and media catalog cover factual topics", () => {
    assert.equal(resolveArticleTopic("travel"), "travel");
    assert.equal(resolveArticleTopic("unknown"), "gift");
    assert.equal(mediaForTopic("earth").coverUrl, "/images/articles/earth-biodiversity.jpg");
    assert.match(mediaForTopic("travel").commonsUrl, /wikimedia\.org/);
  });

  it("normalizeArticleDraft strips factory leak to the fallback", () => {
    const fallback: ArticleDraftPayload = {
      title: "คู่มือของขวัญองค์กร",
      slug: "corporate-gift-guide",
      excerpt: "เลือกของขวัญองค์กร สกรีนโลโก้ได้ สั่งผลิตตามออเดอร์จากจีน",
      body: "<p>เนื้อหาสำรอง</p>",
      coverUrl: "/images/article-cover.svg",
      seoTitle: "คู่มือของขวัญองค์กร",
      metaDescription:
        "เลือกของขวัญองค์กร สกรีนโลโก้ได้ สั่งผลิตตามออเดอร์จากจีน ขอใบเสนอราคาก่อนผลิต",
      keywords: "ของขวัญองค์กร",
      notes: "แม่แบบ",
      topic: "gift",
    };
    const leaked = normalizeArticleDraft(
      {
        title: "ราคาโรงงาน 1688",
        excerpt: "ชุดจาก Alibaba ถูกกว่าท้องตลาด",
        bodyMarkdown: "## ของถูก\n\nต้นทุนโรงงานต่ำ",
      },
      fallback,
    );
    assert.deepEqual(leaked, fallback);

    const clean = normalizeArticleDraft(
      {
        title: "เลือกกระบอกน้ำสกรีนโลโก้",
        excerpt: "กระบอกน้ำสำหรับงานองค์กร สกรีนโลโก้ได้",
        bodyMarkdown: "## เลือกกระบอกน้ำ\n\nบอกจำนวนและโลโก้ตอนขอใบเสนอราคา",
        notes: "ร่างผู้ช่วย",
      },
      fallback,
    );
    assert.equal(clean.title, "เลือกกระบอกน้ำสกรีนโลโก้");
    assert.match(clean.body, /<h2>เลือกกระบอกน้ำ<\/h2>/);
    assert.equal(clean.notes, "ร่างผู้ช่วย");
    assert.equal(clean.topic, "gift");
  });

  it("normalizeArticleDraft requires sources for factual topics", () => {
    const fallback: ArticleDraftPayload = {
      title: "เขาใหญ่มรดกโลก",
      slug: "khao-yai-unesco-world-heritage",
      excerpt: "ดงพญาเย็น–เขาใหญ่เป็นมรดกโลกทางธรรมชาติของยูเนสโก",
      body: "<h2>แหล่งอ้างอิง</h2>\n<li>UNESCO</li>",
      coverUrl: "/images/articles/travel-khao-yai.jpg",
      seoTitle: "เขาใหญ่มรดกโลก",
      metaDescription: "ดงพญาเย็น–เขาใหญ่เป็นมรดกโลกทางธรรมชาติของยูเนสโก อ่านสรุปก่อนเดินทาง",
      keywords: "เขาใหญ่, มรดกโลก",
      notes: "แม่แบบ",
      topic: "travel",
    };

    const missingSources = normalizeArticleDraft(
      {
        topic: "travel",
        title: "ทริปเขาใหญ่",
        excerpt: "ไปเขาใหญ่ช่วงหน้าหนาว",
        bodyMarkdown: "## ทริป\n\nไปเดินป่าสนุกมาก",
      },
      fallback,
    );
    assert.deepEqual(missingSources, fallback);

    const withSources = normalizeArticleDraft(
      {
        topic: "travel",
        title: "เขาใหญ่ในฐานะมรดกโลก",
        excerpt: "ดงพญาเย็น–เขาใหญ่ขึ้นทะเบียนมรดกโลกกับยูเนสโก",
        bodyMarkdown: [
          "## เขาใหญ่",
          "",
          "เป็นส่วนหนึ่งของดงพญาเย็น–เขาใหญ่",
          "",
          "## แหล่งอ้างอิง",
          "",
          "- UNESCO World Heritage Centre https://whc.unesco.org/en/list/590/",
          "- กรมอุทยานแห่งชาติ",
        ].join("\n"),
        notes: "ร่างข้อเท็จจริง",
      },
      fallback,
    );
    assert.equal(withSources.title, "เขาใหญ่ในฐานะมรดกโลก");
    assert.match(withSources.body, /แหล่งอ้างอิง/);
    assert.match(withSources.body, /Mammalwatcher|travel-khao-yai|commons\.wikimedia/);
    assert.equal(withSources.coverUrl, "/images/articles/travel-khao-yai.jpg");
    assert.equal(withSources.topic, "travel");
  });

  it("schedule transitions stay with an admin and a future time", () => {
    assert.equal(
      articleTransitionError({ from: "review", to: "scheduled", isAdmin: false }),
      "เฉพาะผู้ดูแลจึงจะตั้งเวลาเผยแพร่ได้",
    );
    assert.equal(
      articleTransitionError({ from: "review", to: "scheduled", isAdmin: true }),
      null,
    );
    assert.equal(
      articleTransitionError({ from: "scheduled", to: "scheduled", isAdmin: true }),
      null,
    );
    assert.equal(
      articleTransitionError({ from: "scheduled", to: "draft", isAdmin: false }),
      "เฉพาะผู้ดูแลจึงจะยกเลิกเวลาได้",
    );
    const morning = parseBangkokDateTimeLocal("2026-09-25T09:00");
    assert.ok(morning);
    assert.equal(formatBangkokDateTimeLocal(morning.toISOString()), "2026-09-25T09:00");
  });

  it("queues thirty articles across the five blog categories", () => {
    assert.equal(PLANNED_ARTICLES.length, 30);
    const slugs = new Set(PLANNED_ARTICLES.map((article) => article.slug));
    assert.equal(slugs.size, 30);
    const counts: Record<string, number> = {};
    let previous = 0;
    for (const article of PLANNED_ARTICLES) {
      counts[article.category] = (counts[article.category] || 0) + 1;
      assert.equal(article.categoryName.length > 0, true);
      assert.equal(isValidSeoTitle(article.seoTitle), true);
      assert.equal(isValidSeoDescription(article.metaDescription), true);
      assert.ok(article.publishAt.getTime() > previous);
      previous = article.publishAt.getTime();
      assert.equal(formatBangkokDateTimeLocal(article.publishAt.toISOString()).endsWith("T09:00"), true);
    }
    assert.deepEqual(counts, { gift: 11, earth: 5, travel: 5, it: 5, ai: 4 });
  });
});
