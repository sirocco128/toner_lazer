import { OpsSeoEditor } from "@/components/OpsSeoEditor";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listResolvedSeoPages } from "@/lib/page-seo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsSeoPage() {
  const actor = await requireOpsPage();

  const pages = listResolvedSeoPages();
  const canWrite = actorMay(actor, "seo.write");

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">SEO หน้าเว็บ</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        แก้ title คำอธิบาย และรูปแชร์ แล้วบันทึกลงหน้าเว็บได้ทันที หรือให้ผู้ช่วยร่างก่อน
        ค่าที่บันทึกทับค่าตั้งต้นของหน้าร้าน ไม่เปิดต้นทุนโรงงาน
      </p>
      <div className="mt-6">
        <OpsSeoEditor pages={pages} canWrite={canWrite} />
      </div>
    </div>
  );
}
