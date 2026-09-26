"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OpsActionResult } from "@/app/actions/ops";
import { draftBlogArticle } from "@/lib/article-draft";
import { resolveArticleTopic } from "@/lib/article-media-catalog";
import {
  createArticle,
  setArticleStatus,
  updateArticle,
  type SaveArticleInput,
} from "@/lib/article-repository";
import { isArticleStatus, parseBangkokDateTimeLocal } from "@/lib/article-types";
import { writeOpsAudit } from "@/lib/ops-audit";
import { requireOpsActor } from "@/lib/ops-auth";
import { isPlatformAdmin } from "@/lib/ops-roles";
import { opsAuditRequestMeta as requestMeta } from "@/lib/ops-request-context";

const ERRORS: Record<string, string> = {
  invalid_title: "กรุณาใส่ชื่อบทความ",
  invalid_excerpt: "กรุณาใส่คำโปรย",
  invalid_body: "กรุณาใส่เนื้อหา",
  invalid_slug: "รหัสหน้าเว็บต้องเป็นอังกฤษตัวเล็กคั่นขีด",
  article_not_found: "ไม่พบบทความ",
  unpublish_before_edit: "เก็บออกจากเว็บก่อนแล้วค่อยแก้",
  invalid_category: "หมวดบทความไม่ถูกต้อง",
  invalid_publish_at: "เวลาเผยแพร่ไม่ถูกต้อง",
  publish_at_not_future: "เวลาเผยแพร่ต้องอยู่ข้างหน้า",
};

function articleError(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return ERRORS[code] || code || "บันทึกไม่สำเร็จ";
}

function saveInputFromForm(formData: FormData): SaveArticleInput {
  return {
    title: String(formData.get("title") || ""),
    slug: String(formData.get("slug") || "") || undefined,
    excerpt: String(formData.get("excerpt") || ""),
    body: String(formData.get("body") || ""),
    coverUrl: String(formData.get("coverUrl") || "") || undefined,
    author: String(formData.get("author") || "") || undefined,
    brief: String(formData.get("brief") || "") || undefined,
    seoTitle: String(formData.get("seoTitle") || "") || undefined,
    metaDescription: String(formData.get("metaDescription") || "") || undefined,
    keywords: String(formData.get("keywords") || "") || undefined,
    category: String(formData.get("category") || "") || undefined,
  };
}

function revalidateArticlePaths(slug?: string) {
  revalidatePath("/ops/blog");
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/blog/${slug}`);
}

export async function generateArticleDraftAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("seo.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์เขียนบทความ" };
  const meta = await requestMeta();
  const brief = String(formData.get("brief") || "");
  const topic = resolveArticleTopic(String(formData.get("topic") || "gift"));
  let createdId: number;

  try {
    const drafted = await draftBlogArticle(brief, topic);
    if (!drafted.ok) return { ok: false, error: drafted.error };
    const created = await createArticle({
      title: drafted.draft.title,
      slug: drafted.draft.slug,
      excerpt: drafted.draft.excerpt,
      body: drafted.draft.body,
      coverUrl: drafted.draft.coverUrl,
      seoTitle: drafted.draft.seoTitle,
      metaDescription: drafted.draft.metaDescription,
      keywords: drafted.draft.keywords,
      brief: `[${topic}] ${brief}`.slice(0, 800),
      source: "ai",
      category: topic,
    });
    createdId = created.id;
    writeOpsAudit({
      actor,
      action: "article.draft.ai",
      status: "ok",
      resourceType: "article",
      resourceId: String(created.id),
      prompt: brief,
      detail: { slug: created.slug, source: "ai", topic },
    ...meta,
    });
    revalidateArticlePaths(created.slug);
  } catch (error) {
    return { ok: false, error: articleError(error) };
  }

  redirect(`/ops/blog/${createdId}`);
}

export async function createArticleAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("seo.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์เขียนบทความ" };
  const meta = await requestMeta();
  let createdId: number;

  try {
    const created = await createArticle({
      ...saveInputFromForm(formData),
      source: "human",
    });
    createdId = created.id;
    writeOpsAudit({
      actor,
      action: "article.create",
      status: "ok",
      resourceType: "article",
      resourceId: String(created.id),
      detail: { slug: created.slug, source: "human" },
    ...meta,
    });
    revalidateArticlePaths(created.slug);
  } catch (error) {
    return { ok: false, error: articleError(error) };
  }

  redirect(`/ops/blog/${createdId}`);
}

export async function updateArticleAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("seo.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์เขียนบทความ" };
  const meta = await requestMeta();
  const id = Number(formData.get("articleId"));
  if (!id) return { ok: false, error: "ไม่พบบทความ" };

  try {
    const updated = await updateArticle(id, saveInputFromForm(formData));
    writeOpsAudit({
      actor,
      action: "article.update",
      status: "ok",
      resourceType: "article",
      resourceId: String(updated.id),
      detail: { slug: updated.slug },
    ...meta,
    });
    revalidatePath(`/ops/blog/${updated.id}`);
    revalidateArticlePaths(updated.slug);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: articleError(error) };
  }
}

export async function setArticleStatusAction(
  _prev: OpsActionResult | null,
  formData: FormData,
): Promise<OpsActionResult> {
  const actor = await requireOpsActor("seo.write");
  if (!actor) return { ok: false, error: "ไม่มีสิทธิ์เขียนบทความ" };
  const meta = await requestMeta();
  const id = Number(formData.get("articleId"));
  const to = String(formData.get("to") || "");
  if (!id) return { ok: false, error: "ไม่พบบทความ" };
  if (!isArticleStatus(to)) return { ok: false, error: "สถานะไม่ถูกต้อง" };

  try {
    const updated = await setArticleStatus({
      id,
      to,
      isAdmin: isPlatformAdmin(actor.role),
      actorEmail: actor.email,
      publishAt: to === "scheduled" ? parseBangkokDateTimeLocal(String(formData.get("publishAt") || "")) : null,
    });
    writeOpsAudit({
      actor,
      action: "article.status",
      status: "ok",
      resourceType: "article",
      resourceId: String(updated.id),
      detail: { slug: updated.slug, to },
    ...meta,
    });
    revalidatePath(`/ops/blog/${updated.id}`);
    revalidateArticlePaths(updated.slug);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: articleError(error) };
  }
}
