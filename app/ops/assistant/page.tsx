import Link from "next/link";
import { OpsAssistantChat } from "@/components/OpsAssistantChat";
import { requireOpsPage } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsAssistantPage() {
  await requireOpsPage("assistant.use");

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">ผู้ช่วยเซลล์</h1>
      <p className="mt-2 text-sm text-ink/70">
        สรุปคำขอ ร่างข้อความติดต่อลูกค้า ค้นแคตตาล็อก และร่าง SEO แล้วบันทึกลงหน้าเว็บ
        ไม่ใช่เครื่องคิดราคา และไม่เปิดต้นทุนโรงงาน — คิดราคาขายที่{" "}
        <Link href="/ops/pricing" className="text-forest underline-offset-2 hover:underline">
          เครื่องคิดราคา
        </Link>
      </p>
      <div className="mt-6">
        <OpsAssistantChat />
      </div>
    </div>
  );
}
