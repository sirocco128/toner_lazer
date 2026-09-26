import Link from "next/link";
import { requireOpsPage } from "@/lib/ops-auth";
import { FactoryOpsSubnav } from "@/components/FactoryOpsSubnav";
import { FactoryRegistryForm } from "@/components/FactoryRegistryForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewFactoryPage() {
  await requireOpsPage("factory.write");

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/factories" className="text-forest underline-offset-2 hover:underline">
          ← ทะเบียนโรงงาน
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">เพิ่มโรงงานที่สั่งสินค้า</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/70">
        บันทึกผู้ขายหนึ่งราย แล้วค่อยผูกกับรหัสโรงงานของสินค้าและใบสั่ง PO
      </p>
      <FactoryOpsSubnav current="registry" />
      <div className="mt-6 max-w-3xl rounded-xl border border-forest/15 bg-paper p-5">
        <FactoryRegistryForm />
      </div>
    </div>
  );
}
