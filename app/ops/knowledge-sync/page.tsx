import { redirect } from "next/navigation";
import { OpsKnowledgeSyncPanel } from "@/components/OpsKnowledgeSyncPanel";
import { isPlatformAdmin, requireOpsPage } from "@/lib/ops-auth";
import {
  knowledgeSyncConfigured,
  listKnowledgeSyncLogs,
} from "@/lib/ops-knowledge-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsKnowledgeSyncPage() {
  const actor = await requireOpsPage();
  if (!isPlatformAdmin(actor.role)) redirect("/ops/forbidden");

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">อัปเดตคลังความรู้ Smart Gift</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink/70">
        สำหรับผู้ดูแลระบบ — เทียบและอัปเดต FAQ ใน TranTech AI จากข้อเท็จจริงบนเว็บชุดของขวัญ
        พร้อมบันทึกประวัติเพื่อวิเคราะห์ว่าอะไรเปลี่ยนเมื่อไหร่
      </p>
      <div className="mt-6">
        <OpsKnowledgeSyncPanel
          initialLogs={listKnowledgeSyncLogs(40)}
          config={knowledgeSyncConfigured()}
        />
      </div>
    </div>
  );
}
