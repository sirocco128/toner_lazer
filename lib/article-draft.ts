/**
 * Draft a Thai blog post. Always returns a draft payload — never publishes.
 * Topics: gift (corporate gift guide) or factual travel/it/ai/earth.
 * OpenRouter when available; otherwise a conservative template.
 */

import { completeOpenRouterChatDetailed } from "@/lib/openrouter-chat";
import {
  detectPromptInjection,
  looksFactoryLeak,
  looksFirmQuote,
} from "@/lib/ai-safety";
import {
  creditLinesForBody,
  mediaForTopic,
  resolveArticleTopic,
  type ArticleTopic,
} from "@/lib/article-media-catalog";
import {
  clampSeoDescription,
  clampSeoTitle,
  fitSeoDescription,
  SEO_DESC_MIN,
} from "@/lib/seo-limits";
import { slugifyArticle, toArticleHtml } from "@/lib/article-types";

function fitTopicSeoDescription(value: string, topic: ArticleTopic): string {
  if (topic === "gift") return fitSeoDescription(value);
  const pad =
    " อ่านสรุปข้อเท็จจริงพร้อมแหล่งอ้างอิงหน่วยงานต้นทางได้ในบทความนี้";
  let text = clampSeoDescription(value);
  let guard = 0;
  while (text.length < SEO_DESC_MIN && guard < 4) {
    text = clampSeoDescription(`${text}${pad}`);
    guard += 1;
  }
  return text;
}

export type ArticleDraftPayload = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverUrl: string;
  seoTitle: string;
  metaDescription: string;
  keywords: string;
  notes: string;
  topic: ArticleTopic;
};

const JSON_SHAPE =
  'ตอบเป็น JSON เท่านั้น: {"title":"...","slug":"...","excerpt":"...","bodyMarkdown":"...","seoTitle":"...","metaDescription":"...","keywords":"..."}';

const SHARED_FORMAT = [
  "เนื้อหาเป็น markdown: หัวข้อ ## ### ย่อหน้า รายการขึ้นต้นด้วย - และ blockquote ด้วย >",
  "slug เป็น kebab-case ภาษาอังกฤษเท่านั้น",
  "excerpt ไม่เกิน 180 ตัวอักษร",
  "seoTitle ไม่เกิน 60 ตัวอักษร metaDescription 120-160 ตัวอักษร",
  "keywords เป็นวลีไทยคั่นจุลภาค ไม่เกิน 6 วลี",
  JSON_SHAPE,
].join("\n");

const GIFT_SYSTEM = [
  "คุณเขียนบทความคู่มือของขวัญองค์กรภาษาไทย สำหรับ SmartGift",
  "น้ำเสียงสุภาพ น่าเชื่อถือ ไม่ใช่โฆษณาถูก ๆ",
  "ห้ามใส่ราคาแน่นอน วันส่งของ RFQ MOQ SKU 1688 Alibaba ต้นทุนโรงงาน หรือสัญญาพร้อมส่ง",
  "บอกได้ว่าสกรีนโลโก้ได้ และสั่งผลิตตามออเดอร์จากจีน แล้วให้ขอใบเสนอราคา",
  SHARED_FORMAT,
].join("\n");

const FACTUAL_SYSTEM = [
  "คุณเขียนบทความสาระภาษาไทยจากข้อเท็จจริงเท่านั้น ห้ามแต่งเหตุการณ์ ตัวละคร หรือสถิติ",
  "น้ำเสียงสุภาพ น่าเชื่อถือ เหมือนบทความอธิบาย ไม่ใช่โฆษณา",
  "ต้องมีส่วน ## แหล่งอ้างอิง ท้ายบทความ มีรายการอย่างน้อย 2 ข้อ เป็น URL หรือชื่อหน่วยงานจริง (เช่น UNESCO OECD IPCC MDN IETF UNEP)",
  "ห้ามใส่ราคาโรงงาน RFQ MOQ SKU 1688 Alibaba หรือสัญญาพร้อมส่ง",
  "ถ้าไม่แน่ใจข้อเท็จจริง ให้เขียนระดับทั่วไปและอ้างหน่วยงาน ไม่แต่งตัวเลข",
  SHARED_FORMAT,
].join("\n");

function systemForTopic(topic: ArticleTopic): string {
  return topic === "gift" ? GIFT_SYSTEM : FACTUAL_SYSTEM;
}

function withMediaCredits(body: string, topic: ArticleTopic): string {
  const credits = creditLinesForBody(topic);
  if (!credits.length) return body;
  const trimmed = body.trim();
  const alreadyCredited = credits.some((line) => trimmed.includes(line.slice(0, 40)));
  if (alreadyCredited) return trimmed;

  const isHtml = /<(h2|h3|p|blockquote|li)\b/i.test(trimmed);
  if (isHtml) {
    const creditHtml = credits.map((line) => `<li>${line}</li>`).join("\n");
    if (/แหล่งอ้างอิง/i.test(trimmed)) {
      return `${trimmed}\n${creditHtml}`;
    }
    return `${trimmed}\n<h2>แหล่งอ้างอิง</h2>\n${creditHtml}`;
  }

  const creditBlock = credits.map((line) => `- ${line}`).join("\n");
  if (/##\s*แหล่งอ้างอิง/i.test(trimmed)) {
    return `${trimmed}\n\n${creditBlock}`;
  }
  return `${trimmed}\n\n## แหล่งอ้างอิง\n\n${creditBlock}`;
}

/** Require real citations before photo credits are appended. */
export function hasFactualSources(body: string): boolean {
  if (!/แหล่งอ้างอิง/i.test(body)) return false;
  const after = body.split(/แหล่งอ้างอิง/i).slice(1).join(" ");
  const lines = after
    .split(/\n/)
    .map((line) =>
      line
        .replace(/^[-*]\s+/, "")
        .replace(/<\/?li[^>]*>/gi, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .filter((line) => !/^(รูปปก:|หน้าไฟล์ภาพ:|ใบอนุญาต:)/i.test(line));
  const citations = lines.filter(
    (line) =>
      /https?:\/\//i.test(line) ||
      /(UNESCO|OECD|IPCC|IPBES|UNEP|IETF|MDN|WHO|IUCN|NASA|กรมอุทยาน)/i.test(
        line,
      ),
  );
  return citations.length >= 2;
}

function giftTemplate(brief: string): ArticleDraftPayload {
  const topicText = brief.replace(/\s+/g, " ").trim() || "ของขวัญองค์กรสกรีนโลโก้";
  const title = topicText.slice(0, 80);
  const excerpt =
    `${topicText} สำหรับงานองค์กร สกรีนโลโก้ได้ สั่งผลิตตามออเดอร์จากจีน ขอใบเสนอราคาก่อนผลิต`.slice(
      0,
      180,
    );
  const body = toArticleHtml(
    [
      `## ${title}`,
      "",
      `${topicText} เหมาะกับงานแจกขององค์กรที่ต้องการภาพลักษณ์สุภาพและสกรีนโลโก้ได้`,
      "",
      "ของขวัญชุดนี้สั่งผลิตตามออเดอร์จากจีน ไม่ใช่สินค้าพร้อมส่งบนเว็บ กรุณาขอใบเสนอราคาเมื่อทราบจำนวนและงบ",
      "",
      "## สิ่งที่ควรบอกตอนขอราคา",
      "",
      "- จำนวนโดยประมาณและงงาน",
      "- โลโก้หรือข้อความที่ต้องการสกรีน",
      "- งบต่อชิ้นถ้ามี",
      "",
      "> ทีมขายยืนยันสเปกและเวลานำหลังได้รับรายละเอียดจากแบบฟอร์ม",
    ].join("\n"),
  );
  const media = mediaForTopic("gift");
  return {
    title,
    slug: slugifyArticle(topicText, "corporate-gift-guide"),
    excerpt,
    body,
    coverUrl: media.coverUrl,
    seoTitle: clampSeoTitle(`${topicText} สกรีนโลโก้ได้`),
    metaDescription: fitSeoDescription(excerpt),
    keywords: [topicText.slice(0, 40), "ของขวัญองค์กร", "สกรีนโลโก้"]
      .filter(Boolean)
      .join(", "),
    notes: "ร่างจากแม่แบบ — ตรวจสำนวนแล้วค่อยส่งตรวจ",
    topic: "gift",
  };
}

function factualTemplate(brief: string, topic: ArticleTopic): ArticleDraftPayload {
  const topicText = brief.replace(/\s+/g, " ").trim();
  const defaults: Record<Exclude<ArticleTopic, "gift">, {
    title: string;
    slug: string;
    excerpt: string;
    keywords: string;
    sources: string[];
  }> = {
    travel: {
      title: "เขาใหญ่ในฐานะมรดกโลก: สิ่งที่นักท่องเที่ยวควรรู้",
      slug: "khao-yai-unesco-world-heritage",
      excerpt:
        "อุทยานแห่งชาติเขาใหญ่เป็นส่วนหนึ่งของดงพญาเย็น–เขาใหญ่ ซึ่งยูเนสโกขึ้นทะเบียนเป็นมรดกโลกทางธรรมชาติ",
      keywords: "เขาใหญ่, มรดกโลก, ท่องเที่ยวธรรมชาติ",
      sources: [
        "UNESCO World Heritage Centre — Dong Phayayen-Khao Yai Forest Complex https://whc.unesco.org/en/list/590/",
        "กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช — ข้อมูลอุทยานแห่งชาติเขาใหญ่",
      ],
    },
    it: {
      title: "HTTPS คืออะไร และทำไมเว็บสมัยใหม่ต้องเข้ารหัส",
      slug: "what-is-https-tls",
      excerpt:
        "HTTPS ใช้ TLS เข้ารหัสการสื่อสารระหว่างเบราว์เซอร์กับเซิร์ฟเวอร์ ลดการดักฟังและปลอมแปลงข้อมูลระหว่างทาง",
      keywords: "HTTPS, TLS, ความปลอดภัยเว็บ",
      sources: [
        "MDN Web Docs — HTTPS https://developer.mozilla.org/en-US/docs/Glossary/HTTPS",
        "IETF — RFC 8446 The Transport Layer Security (TLS) Protocol Version 1.3 https://www.rfc-editor.org/rfc/rfc8446",
      ],
    },
    ai: {
      title: "หลักการ AI ของ OECD ที่องค์กรอ้างอิงได้",
      slug: "oecd-ai-principles-overview",
      excerpt:
        "OECD AI Principles เป็นแนวทางระหว่างประเทศเรื่อง AI ที่น่าเชื่อถือ ครอบคลุมสิทธิมนุษยชน ความโปร่งใส และความรับผิดชอบ",
      keywords: "OECD AI, จริยธรรมเอไอ, AI principles",
      sources: [
        "OECD — AI Principles https://oecd.ai/en/ai-principles",
        "OECD Legal Instruments — Recommendation on Artificial Intelligence",
      ],
    },
    earth: {
      title: "ทำไมความหลากหลายทางชีวภาพสำคัญต่อโลกที่อยู่อาศัยได้",
      slug: "why-biodiversity-matters-ipbes",
      excerpt:
        "รายงานระดับโลกชี้ว่าความหลากหลายทางชีวภาพกำลังลดลงจากกิจกรรมมนุษย์ ส่งผลต่ออาหาร น้ำ และภูมิอากาศ",
      keywords: "ความหลากหลายทางชีวภาพ, IPBES, อนุรักษ์โลก",
      sources: [
        "IPBES — Global Assessment Report on Biodiversity and Ecosystem Services https://www.ipbes.net/global-assessment",
        "UNEP — Biodiversity https://www.unep.org/topics/nature-action/biodiversity",
      ],
    },
  };

  const pack = defaults[topic as Exclude<ArticleTopic, "gift">];
  const title = (topicText.length >= 12 ? topicText : pack.title).slice(0, 80);
  const excerpt = pack.excerpt.slice(0, 180);
  const media = mediaForTopic(topic);
  const bodyMd = withMediaCredits(
    [
      `## ${title}`,
      "",
      excerpt,
      "",
      "เนื้อหานี้สรุปจากแหล่งสาธารณะของหน่วยงานที่เกี่ยวข้อง อ่านรายละเอียดเต็มได้จากลิงก์ด้านล่าง",
      "",
      "## จุดที่ควรจำ",
      "",
      "- อ้างอิงหน่วยงานต้นทางก่อนแชร์ตัวเลขหรือข้อสรุป",
      "- ข้อมูลอาจมีการอัปเดต — ตรวจวันที่บนหน้าเว็บต้นทาง",
      "",
      "## แหล่งอ้างอิง",
      "",
      ...pack.sources.map((s) => `- ${s}`),
    ].join("\n"),
    topic,
  );

  return {
    title,
    slug: slugifyArticle(pack.slug, pack.slug),
    excerpt,
    body: toArticleHtml(bodyMd),
    coverUrl: media.coverUrl,
    seoTitle: clampSeoTitle(title),
    metaDescription: fitTopicSeoDescription(excerpt, topic),
    keywords: pack.keywords,
    notes: "ร่างแม่แบบข้อเท็จจริง — ตรวจแหล่งอ้างอิงก่อนส่งตรวจ",
    topic,
  };
}

function templateDraft(brief: string, topic: ArticleTopic): ArticleDraftPayload {
  return topic === "gift" ? giftTemplate(brief) : factualTemplate(brief, topic);
}

function parseDraftJson(raw: string): Partial<ArticleDraftPayload> & {
  bodyMarkdown?: string;
} | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      title: typeof parsed.title === "string" ? parsed.title : undefined,
      slug: typeof parsed.slug === "string" ? parsed.slug : undefined,
      excerpt: typeof parsed.excerpt === "string" ? parsed.excerpt : undefined,
      bodyMarkdown:
        typeof parsed.bodyMarkdown === "string" ? parsed.bodyMarkdown : undefined,
      seoTitle: typeof parsed.seoTitle === "string" ? parsed.seoTitle : undefined,
      metaDescription:
        typeof parsed.metaDescription === "string"
          ? parsed.metaDescription
          : undefined,
      keywords: typeof parsed.keywords === "string" ? parsed.keywords : undefined,
    };
  } catch {
    return null;
  }
}

export function normalizeArticleDraft(
  draft: Partial<ArticleDraftPayload> & { bodyMarkdown?: string },
  fallback: ArticleDraftPayload,
): ArticleDraftPayload {
  const topic = resolveArticleTopic(draft.topic || fallback.topic);
  const title = String(draft.title || fallback.title)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  const excerpt = String(draft.excerpt || fallback.excerpt)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  let bodySource = String(draft.bodyMarkdown || draft.body || fallback.body);
  if (topic !== "gift") {
    if (!hasFactualSources(bodySource)) {
      return fallback;
    }
    bodySource = withMediaCredits(bodySource, topic);
  }
  const body = toArticleHtml(bodySource);
  const leaked = looksFactoryLeak(`${title}\n${excerpt}\n${body}`) || looksFirmQuote(body);
  if (!title || !excerpt || !body || leaked) return fallback;
  const media = mediaForTopic(topic);
  return {
    title,
    slug: slugifyArticle(draft.slug || title, fallback.slug),
    excerpt,
    body,
    coverUrl: String(draft.coverUrl || media.coverUrl).trim() || media.coverUrl,
    seoTitle: clampSeoTitle(draft.seoTitle || title),
    metaDescription: fitTopicSeoDescription(
      clampSeoDescription(draft.metaDescription || excerpt),
      topic,
    ),
    keywords: String(draft.keywords || fallback.keywords)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(", "),
    notes: draft.notes || fallback.notes,
    topic,
  };
}

export async function draftBlogArticle(
  brief: string,
  topicInput: string | ArticleTopic = "gift",
): Promise<{ ok: true; draft: ArticleDraftPayload } | { ok: false; error: string }> {
  const topic = resolveArticleTopic(topicInput);
  const prompt = String(brief || "").trim();
  if (prompt.length < 8) {
    return { ok: false, error: "เขียนหัวข้อหรือโจทย์อย่างน้อยหนึ่งประโยค" };
  }
  if (detectPromptInjection(prompt)) {
    return { ok: false, error: "โจทย์นี้ใช้ร่างบทความไม่ได้" };
  }
  if (looksFactoryLeak(prompt)) {
    return { ok: false, error: "ห้ามใส่ต้นทุนโรงงานหรือแหล่งผลิตในโจทย์บทความ" };
  }

  const fallback = templateDraft(prompt, topic);
  const userHint =
    topic === "gift"
      ? `โจทย์บทความ:\n${prompt}\n\nร่างบทความคู่มือ 4–7 ย่อหน้า ภาษาไทยสุภาพ`
      : `หมวด: ${topic}\nโจทย์บทความ:\n${prompt}\n\nร่างบทความข้อเท็จจริง 4–7 ย่อหน้า ภาษาไทย มีส่วน ## แหล่งอ้างอิง อย่างน้อย 2 แหล่งหน่วยงานจริง`;

  const llm = await completeOpenRouterChatDetailed(
    [
      { role: "system", content: systemForTopic(topic) },
      { role: "user", content: userHint },
    ],
    { maxTokens: 1800, temperature: topic === "gift" ? 0.4 : 0.25, timeoutMs: 45_000 },
  );

  const raw = llm?.content?.trim() || "";
  if (!raw || looksFactoryLeak(raw) || looksFirmQuote(raw)) {
    return { ok: true, draft: fallback };
  }
  const parsed = parseDraftJson(raw);
  if (!parsed) {
    return { ok: true, draft: fallback };
  }
  return {
    ok: true,
    draft: normalizeArticleDraft(
      {
        ...parsed,
        topic,
        coverUrl: mediaForTopic(topic).coverUrl,
        notes:
          topic === "gift"
            ? "ร่างโดยผู้ช่วย — ตรวจสำนวน แล้วส่งเข้าคิวรอตรวจ อย่าเผยแพร่ทันที"
            : "ร่างโดยผู้ช่วย (ข้อเท็จจริง) — ตรวจแหล่งอ้างอิงกับต้นทางก่อนส่งตรวจ อย่าเผยแพร่ทันที",
      },
      fallback,
    ),
  };
}
