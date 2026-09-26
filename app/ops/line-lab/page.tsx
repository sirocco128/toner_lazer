import { redirect } from "next/navigation";
import { LineLabSpa } from "@/components/LineLabSpa";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import {
  lineOaLabStatus,
  listLineLabContacts,
  listLineLabTokens,
} from "@/lib/line-oa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsLineLabPage() {
  const actor = await requireOpsPage("customers.write");
  if (!actorMay(actor, "customers.write")) redirect("/ops/customers");

  const status = lineOaLabStatus();

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">ทดลองไลน์ webhook</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/70">
        หน้านี้จำลองแชทไลน์แล้วยิงเข้าเส้นทางเดียวกับ LINE จริง ({status.webhookPath})
        รวมตรวจลายเซ็น HMAC — ไม่เรียกเซิร์ฟเวอร์ LINE
      </p>
      <div className="mt-6">
        <LineLabSpa
          initialStatus={status}
          initialContacts={listLineLabContacts()}
          initialTokens={listLineLabTokens()}
        />
      </div>
    </div>
  );
}
