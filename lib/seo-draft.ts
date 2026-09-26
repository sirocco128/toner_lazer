/**
 * Draft public-page SEO (title, description, keywords).
 * Uses OpenRouter when available; otherwise a deterministic template.
 * Never invents prices, lead times, or factory cost.
 */

import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { looksFactoryLeak } from "@/lib/ai-safety";
import {
  clampSeoDescription,
  clampSeoTitle,
  fitSeoDescription,
  isValidSeoDescription,
  isValidSeoTitle,
  SEO_DESC_MAX,
  SEO_DESC_MIN,
  SEO_TITLE_MAX,
} from "@/lib/seo-limits";
import {
  getDefaultSeoPage,
  type CatalogSeoPage,
} from "@/lib/page-seo";
import { getIdeaTheme } from "@/lib/seo-themes";

export type SeoDraft = {
  seoTitle: string;
  metaDescription: string;
  keywords: string;
  notes: string;
};

const DRAFT_SYSTEM = [
  "คุณช่วยร่าง SEO หน้าร้านของขวัญองค์กรภาษาไทย",
  `seoTitle ไม่เกิน ${SEO_TITLE_MAX} ตัวอักษร ใส่คำค้นหลัก ไม่วางชื่อแบรนด์ซ้ำถ้าไม่จำเป็น`,
  `metaDescription ยาว ${SEO_DESC_MIN}-${SEO_DESC_MAX} ตัวอักษร บอกสกรีนโลโก้ได้ และสั่งผลิตตามออเดอร์จากจีน`,
  "ห้ามใส่ราคาแน่นอน วันส่งของแน่นอน RFQ MOQ SKU 1688 หรือต้นทุนโรงงาน",
  "ห้ามสัญญาว่ามีสินค้าพร้อมส่ง",
  "keywords เป็นวลีภาษาไทยคั่นด้วยจุลภาค ไม่เกิน 6 วลี",
  'ตอบเป็น JSON เท่านั้น: {"seoTitle":"...","metaDescription":"...","keywords":"..."}',
].join("\n");

function pageContext(page: CatalogSeoPage): string {
  const themeSlug = page.path.startsWith("/ideas/")
    ? page.path.slice("/ideas/".length)
    : "";
  const theme = themeSlug ? getIdeaTheme(themeSlug) : null;
  return [
    `path: ${page.path}`,
    `label: ${page.label}`,
    `kind: ${page.kind}`,
    `currentTitle: ${page.seo.seoTitle}`,
    `currentDescription: ${page.seo.metaDescription}`,
    theme ? `theme: ${theme.name} — ${theme.lede}` : "",
    page.keywords.length ? `seedKeywords: ${page.keywords.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function templateDraft(page: CatalogSeoPage, brief: string): SeoDraft {
  const seed = brief.trim();
  const focus = seed || page.keywords[0] || page.label;
  const seoTitle = clampSeoTitle(
    page.kind === "theme"
      ? `${page.label.replace("ไอเดียธีม", "ของขวัญองค์กรธีม")} สกรีนโลโก้`
      : `${focus} สกรีนโลโก้ได้`.replace(/\s+/g, " "),
  );
  const metaDescription = fitSeoDescription(
    `${page.seo.metaDescription} ${seed}`.trim(),
  );
  const keywords = (page.keywords.length
    ? page.keywords
    : [page.label, "ของขวัญองค์กร", "สกรีนโลโก้"]
  )
    .slice(0, 6)
    .join(", ");
  return {
    seoTitle,
    metaDescription,
    keywords,
    notes: "ร่างจากแม่แบบของหน้า — ตรวจความยาวแล้วยืนยันก่อนบันทึกลงเว็บ",
  };
}

function parseDraftJson(raw: string): Partial<SeoDraft> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
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

export function normalizeSeoDraft(
  draft: Partial<SeoDraft>,
  fallback: SeoDraft,
): SeoDraft {
  const seoTitle = clampSeoTitle(draft.seoTitle || fallback.seoTitle);
  const metaDescription = fitSeoDescription(
    clampSeoDescription(draft.metaDescription || fallback.metaDescription),
  );
  const keywords = (draft.keywords || fallback.keywords)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
  return {
    seoTitle: isValidSeoTitle(seoTitle) ? seoTitle : fallback.seoTitle,
    metaDescription: isValidSeoDescription(metaDescription)
      ? metaDescription
      : fallback.metaDescription,
    keywords: keywords || fallback.keywords,
    notes: fallback.notes,
  };
}

export async function draftPageSeo(input: {
  path: string;
  brief?: string;
}): Promise<{ ok: true; draft: SeoDraft; page: CatalogSeoPage } | { ok: false; error: string }> {
  const page = getDefaultSeoPage(input.path);
  if (!page) {
    return { ok: false, error: "ไม่พบหน้าที่อนุญาตให้แก้ SEO" };
  }
  const fallback = templateDraft(page, input.brief || "");
  const llm = await completeOpenRouterChat(
    [
      { role: "system", content: DRAFT_SYSTEM },
      {
        role: "user",
        content: `ข้อมูลหน้า:\n${pageContext(page)}\n\nคำสั่งเพิ่ม: ${input.brief?.trim() || "ร่างใหม่ให้ค้นหาเจอและยังสุภาพ"}\n`,
      },
    ],
    { maxTokens: 280, temperature: 0.3 },
  );

  if (!llm || looksFactoryLeak(llm)) {
    return { ok: true, draft: fallback, page };
  }
  const parsed = parseDraftJson(llm);
  if (!parsed) {
    return { ok: true, draft: fallback, page };
  }
  return {
    ok: true,
    draft: normalizeSeoDraft(
      { ...parsed, notes: "ร่างโดยผู้ช่วย — ตรวจแล้วกดบันทึกลงหน้าเว็บ" },
      fallback,
    ),
    page,
  };
}
