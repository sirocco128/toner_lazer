import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerImportForm } from "@/components/CustomerImportForm";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsImportCustomersPage() {
  const actor = await requireOpsPage("customers.import");
  if (!actorMay(actor, "customers.import")) redirect("/ops/customers");

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/customers" className="text-forest underline-offset-2 hover:underline">
          ← รายการลูกค้า
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">นำเข้าลูกค้า</h1>
      <CustomerImportForm />
    </div>
  );
}
