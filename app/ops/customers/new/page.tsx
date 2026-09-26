import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerOpsForm } from "@/components/CustomerOpsForm";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listDistinctOpsTags } from "@/lib/ops-tag-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsNewCustomerPage() {
  const actor = await requireOpsPage("customers.write");
  if (!actorMay(actor, "customers.write")) redirect("/ops/customers");

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/customers" className="text-forest underline-offset-2 hover:underline">
          ← รายการลูกค้า
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">เพิ่มลูกค้า</h1>
      <p className="mt-1 text-sm text-ink/70">
        สำหรับลูกค้าที่คุยทางไลน์หรือวอล์กอิน โดยยังไม่มีคำขอบนเว็บ
      </p>
      <CustomerOpsForm mode="create" tagSuggestions={listDistinctOpsTags()} />
    </div>
  );
}
