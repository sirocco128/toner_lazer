import { revalidatePath } from "next/cache";
import type { OpsActor } from "@/lib/ops-roles";
import { actorMay } from "@/lib/ops-roles";
import {
  getDefaultSeoPage,
  isAllowedSeoPath,
  normalizeSeoPath,
  resolveSeoFields,
} from "@/lib/page-seo";
import { draftPageSeo, type SeoDraft } from "@/lib/seo-draft";
import { upsertSeoOverride } from "@/lib/seo-repository";
import { IDEA_THEMES, ideaThemePath } from "@/lib/seo-themes";

const PATH_RE = /\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)+/i;

const STATIC_HINTS: Array<{ re: RegExp; path: string }> = [
  { re: /หน้าแรก|โฮม/i, path: "/" },
  { re: /สมุดแคตตาล็อก|สมุดพลิก/i, path: "/catalog" },
  { re: /สินค้าพรีเมียม|แคตตาล็อก/i, path: "/products" },
  { re: /ติดต่อ|ขอใบเสนอราคา/i, path: "/contact" },
  { re: /บทความ/i, path: "/blog" },
  { re: /ไอเดีย/i, path: "/ideas" },
  { re: /เกี่ยวกับ/i, path: "/about" },
  { re: /ผลงาน/i, path: "/portfolio" },
  { re: /ออกแบบเซ็ต/i, path: "/customize-gift-set" },
];

export function pathFromSeoPrompt(message: string): string | null {
  const explicit = message.match(PATH_RE)?.[0];
  if (explicit) {
    const path = normalizeSeoPath(explicit);
    if (isAllowedSeoPath(path)) return path;
  }
  for (const theme of IDEA_THEMES) {
    if (message.includes(theme.name) || message.includes(theme.slug)) {
      return ideaThemePath(theme.slug);
    }
  }
  for (const hint of STATIC_HINTS) {
    if (hint.re.test(message)) return hint.path;
  }
  return null;
}

export function wantsSeoDraft(message: string): boolean {
  return /seo|เมต้า|meta|title|คีย์เวิร์ด|keyword|ร่าง\s*seo|หัวข้อหน้า/i.test(
    message,
  );
}

export function wantsSeoApply(message: string): boolean {
  return /บันทึก|ลงหน้าเว็บ|ลงเว็บ|ใช้กับหน้า|apply/i.test(message);
}

export function summarizeCurrentSeo(path: string): string {
  const page = getDefaultSeoPage(path);
  if (!page) return `ไม่พบหน้า ${path} ในรายการ SEO`;
  const seo = resolveSeoFields(path, page.seo);
  return [
    `หน้า ${page.label} (${page.path})`,
    `title: ${seo.seoTitle}`,
    `description: ${seo.metaDescription}`,
    seo.keywords ? `keywords: ${seo.keywords}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function draftSeoForPrompt(message: string): Promise<{
  text: string;
  path: string | null;
  draft: SeoDraft | null;
}> {
  const path = pathFromSeoPrompt(message);
  if (!path) {
    return {
      text: "ระบุหน้าที่จะร่าง เช่น /ideas/nature หรือ ธีมสุขภาพ",
      path: null,
      draft: null,
    };
  }
  const result = await draftPageSeo({ path, brief: message });
  if (!result.ok) {
    return { text: result.error, path, draft: null };
  }
  const { draft } = result;
  return {
    path,
    draft,
    text: [
      `ร่าง SEO สำหรับ ${result.page.label} (${path})`,
      `title: ${draft.seoTitle}`,
      `description: ${draft.metaDescription}`,
      `keywords: ${draft.keywords}`,
      draft.notes,
    ].join("\n"),
  };
}

export function applySeoDraft(input: {
  actor: OpsActor;
  path: string;
  draft: SeoDraft;
}): string {
  if (!actorMay(input.actor, "seo.write")) {
    return "บัญชีนี้ไม่มีสิทธิ์บันทึก SEO ลงหน้าเว็บ";
  }
  if (!isAllowedSeoPath(input.path)) {
    return `หน้านี้อยู่นอกรายการที่บันทึกได้: ${input.path}`;
  }
  const page = getDefaultSeoPage(input.path);
  upsertSeoOverride({
    path: input.path,
    seoTitle: input.draft.seoTitle,
    metaDescription: input.draft.metaDescription,
    ogImage: page?.seo.ogImage || null,
    keywords: input.draft.keywords,
    noIndex: Boolean(page?.seo.noIndex),
    actorEmail: input.actor.email,
    actorName: input.actor.name,
  });
  revalidatePath(input.path);
  revalidatePath("/sitemap.xml");
  return `บันทึก SEO ลง ${input.path} แล้ว — เปิดหน้าเว็บจะเห็น title และคำอธิบายใหม่`;
}
