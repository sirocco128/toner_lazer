import Link from "next/link";
import { OpsProductSubnav } from "@/components/OpsProductSubnav";
import { requireOpsPage } from "@/lib/ops-auth";
import { createOriAction } from "@/app/actions/ops-products";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { listColors } from "@/lib/sku-master-repository";
import { listFactoriesForPoForm } from "@/lib/factory-registry-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewOriPage() {
  await requireOpsPage("catalog.write");
  const colors = await listColors();
  const factories = listFactoriesForPoForm();

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/products/ori" className="text-forest underline-offset-2 hover:underline">
          ← รหัสโรงงาน
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">เพิ่มรหัสโรงงาน</h1>
      <p className="mt-2 text-sm text-ink/70">
        ระบบจะออกรหัสขายสองใบ คนละรันนิ่ง เช่น nt0001 ได้ A (พร้อมส่ง) และ B (สั่งผลิต)
      </p>
      <div className="mt-4">
        <OpsProductSubnav current="ori" />
      </div>
      <div className="mt-6 max-w-xl rounded-xl border border-forest/15 bg-paper p-5">
        <OpsCycleForm action={createOriAction} submitLabel="สร้าง ori + A/B">
          <label className="block text-sm">
            <span className="font-medium">รหัสโรงงาน (เช่น nt0001)</span>
            <input name="oriProductCode" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">ชื่อไทย</span>
            <input name="oriProductNameTh" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">ชื่ออังกฤษ</span>
            <input name="oriProductNameEng" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">สี</span>
            <select name="colorId" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
              <option value="">ไม่ระบุ</option>
              {colors.map((color) => (
                <option key={color.id} value={color.id}>
                  {color.nameTh}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">ทะเบียนโรงงานที่สั่ง</span>
            <select name="factoryId" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
              <option value="">ยังไม่ผูก</option>
              {factories.map((factory) => (
                <option key={factory.id} value={factory.id}>
                  {factory.factoryCode} · {factory.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">หมายเหตุ</span>
            <textarea name="notes" rows={2} className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
        </OpsCycleForm>
      </div>
    </div>
  );
}
