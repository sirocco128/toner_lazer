import Link from "next/link";
import {
  createArticleAction,
  generateArticleDraftAction,
} from "@/app/actions/ops-articles";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import {
  ARTICLE_TOPIC_LABELS,
  ARTICLE_TOPICS,
} from "@/lib/article-media-catalog";
import { requireOpsPage } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewArticlePage() {
  await requireOpsPage("seo.write");

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/blog" className="text-forest underline-offset-2 hover:underline">
          ← บทความ
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">ร่างบทความใหม่</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        ผู้ช่วยร่างเป็นฉบับร่างเท่านั้น ไม่ขึ้นเว็บจนกว่าผู้ดูแลจะเผยแพร่
      </p>

      <div className="mt-6 max-w-xl rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="font-semibold text-forest">ร่างด้วยผู้ช่วย</h2>
        <p className="mt-1 text-sm text-ink/65">
          เลือกหมวดแล้วเขียนโจทย์ หมวดท่องเที่ยว / ไอที / เอไอ / อนุรักษ์โลก จะบังคับแหล่งอ้างอิงและรูปปกจริง
        </p>
        <div className="mt-4">
          <OpsCycleForm action={generateArticleDraftAction} submitLabel="ร่างด้วยผู้ช่วย">
            <label className="block text-sm">
              <span className="font-medium">หมวดบทความ</span>
              <select
                name="topic"
                defaultValue="gift"
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              >
                {ARTICLE_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {ARTICLE_TOPIC_LABELS[topic]}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium">โจทย์บทความ</span>
              <textarea
                name="brief"
                required
                minLength={8}
                rows={4}
                placeholder="เช่น คู่มือกระบอกน้ำสกรีนโลโก้ หรือ เขาใหญ่มรดกโลกยูเนสโก"
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
          </OpsCycleForm>
        </div>
      </div>

      <div className="mt-8 max-w-xl rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="font-semibold text-forest">สร้างร่างว่าง</h2>
        <p className="mt-1 text-sm text-ink/65">เขียนเองทั้งฉบับ แล้วส่งเข้าคิวรอตรวจ</p>
        <div className="mt-4">
          <OpsCycleForm action={createArticleAction} submitLabel="สร้างร่าง">
            <label className="block text-sm">
              <span className="font-medium">ชื่อบทความ</span>
              <input name="title" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">รหัสหน้าเว็บ (slug)</span>
              <input
                name="slug"
                placeholder="ว่างได้ — ระบบจะสร้างจากชื่อ"
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">คำโปรย</span>
              <textarea name="excerpt" required rows={2} className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">เนื้อหา</span>
              <textarea
                name="body"
                required
                rows={10}
                placeholder="ใช้ ## หัวข้อ หรือ HTML ย่อหน้า / รายการ"
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">ผู้เขียน</span>
              <input name="author" placeholder="ทีมคอนเทนต์" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">หมวดบทความ</span>
              <select name="category" defaultValue="gift" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
                {ARTICLE_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {ARTICLE_TOPIC_LABELS[topic]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">URL รูปปก</span>
              <input name="coverUrl" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">SEO title</span>
              <input name="seoTitle" maxLength={60} className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">คำอธิบายเมตา</span>
              <textarea name="metaDescription" rows={2} maxLength={160} className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">คำค้น (คั่นจุลภาค)</span>
              <input name="keywords" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
          </OpsCycleForm>
        </div>
      </div>
    </div>
  );
}
