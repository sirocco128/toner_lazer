import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOpsPage } from "@/lib/ops-auth";
import { saveGroupItemsAction } from "@/app/actions/ops-products";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { OpsProductSubnav } from "@/components/OpsProductSubnav";
import { SkuGroupItemPicker } from "@/components/SkuGroupItemPicker";
import {
  listGroupItems,
  listSkuGroups,
  listSkus,
} from "@/lib/sku-master-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SkuGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  await requireOpsPage("catalog.write");
  const { groupId: raw } = await params;
  const groupId = Number(raw);
  const groups = await listSkuGroups();
  const group = groups.find((item) => item.id === groupId);
  if (!group) notFound();
  const [selected, skus] = await Promise.all([
    listGroupItems(groupId),
    listSkus({ limit: 2000 }),
  ]);

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/products/groups" className="text-forest underline-offset-2 hover:underline">
          ← กลุ่มสินค้า
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">{group.name}</h1>
      <p className="mt-2 text-sm text-ink/70">
        ลากรหัสเข้ากลุ่ม จัดลำดับได้ — มือถือใช้ปุ่มขึ้น/ลง
      </p>
      <div className="mt-4">
        <OpsProductSubnav current="groups" />
      </div>
      <div className="mt-6 rounded-xl border border-forest/15 bg-paper p-5">
        <OpsCycleForm action={saveGroupItemsAction} submitLabel="บันทึกสมาชิกกลุ่ม">
          <input type="hidden" name="groupId" value={group.id} />
          <SkuGroupItemPicker skus={skus} selectedIds={selected} />
        </OpsCycleForm>
      </div>
    </div>
  );
}
