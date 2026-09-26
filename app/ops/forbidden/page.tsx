import Link from "next/link";
import { redirect } from "next/navigation";
import { getOpsActor, isOpsAuthConfigured } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsForbiddenPage() {
  if (!isOpsAuthConfigured()) redirect("/ops/login");
  const actor = await getOpsActor();
  if (!actor) redirect("/ops/login");

  return (
    <div className="max-w-lg">
      <p className="text-sm font-semibold uppercase tracking-wide text-brass">
        ไม่มีสิทธิ์
      </p>
      <h1 className="mt-2 text-2xl font-bold text-forest">
        บัญชีนี้เข้าหน้านี้ไม่ได้
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink/75">
        คุณยังล็อกอินอยู่เป็น {actor.email} แต่บทบาทหรือสิทธิ์ที่กำหนดไว้ไม่ครอบคลุมหน้านี้
        กลับไปหน้าที่ใช้ได้ หรือให้ผู้ดูแลปรับสิทธิ์ที่ผู้ใช้ / สิทธิ์
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/ops"
          className="rounded bg-forest px-4 py-2 text-sm font-medium text-paper"
        >
          กลับภาพรวม
        </Link>
        <Link
          href="/ops/quotes"
          className="rounded border border-forest/20 px-4 py-2 text-sm font-medium text-forest"
        >
          ใบเสนอราคา
        </Link>
      </div>
    </div>
  );
}
