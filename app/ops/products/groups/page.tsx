import Link from "next/link";
import { requireOpsPage } from "@/lib/ops-auth";
import { createGroupAction } from "@/app/actions/ops-products";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { OpsProductSubnav } from "@/components/OpsProductSubnav";
import { listSkuGroups } from "@/lib/sku-master-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SkuGroupsPage() {
  await requireOpsPage("catalog.write");
  const groups = await listSkuGroups();

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/products" className="text-forest underline-offset-2 hover:underline">
          ← รหัสขาย
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">กลุ่มสินค้า</h1>
      <p className="mt-2 text-sm text-ink/70">ลากหรือเลือก product_id เข้ากลุ่ม แล้วใช้กรองรายการรหัสขาย</p>
      <div className="mt-4">
        <OpsProductSubnav current="groups" />
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-forest/15 bg-paper p-5">
          <h2 className="font-semibold text-forest">สร้างกลุ่ม</h2>
          <div className="mt-4">
            <OpsCycleForm action={createGroupAction} submitLabel="สร้างกลุ่ม">
              <label className="block text-sm">
                <span className="font-medium">ชื่อกลุ่ม</span>
                <input name="name" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">หมายเหตุ</span>
                <input name="notes" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
              </label>
            </OpsCycleForm>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/ops/products/groups/${group.id}`}
                className="flex justify-between rounded-lg border border-forest/10 px-3 py-2 hover:bg-forest-mist/40"
              >
                <span className="font-medium text-forest">{group.name}</span>
                <span className="text-ink/55">{group.itemCount} รหัส</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
