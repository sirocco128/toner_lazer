import Link from "next/link";
import { requireOpsPage } from "@/lib/ops-auth";
import { createColorAction } from "@/app/actions/ops-products";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { OpsProductSubnav } from "@/components/OpsProductSubnav";
import { listColors } from "@/lib/sku-master-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SkuColorsPage() {
  await requireOpsPage("catalog.write");
  const colors = await listColors();

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/products" className="text-forest underline-offset-2 hover:underline">
          ← รหัสขาย
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">มาสเตอร์สี</h1>
      <p className="mt-2 text-sm text-ink/70">สีสินค้าจากโรงงาน ไม่ผูกกับธีมเว็บ</p>
      <div className="mt-4">
        <OpsProductSubnav current="colors" />
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-forest/15 bg-paper p-5">
          <h2 className="font-semibold text-forest">เพิ่มสี</h2>
          <div className="mt-4">
            <OpsCycleForm action={createColorAction} submitLabel="บันทึกสี">
              <label className="block text-sm">
                <span className="font-medium">รหัส (อังกฤษ)</span>
                <input name="code" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">ชื่อไทย</span>
                <input name="nameTh" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">ชื่ออังกฤษ</span>
                <input name="nameEn" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Hex</span>
                <input name="hex" placeholder="#111111" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
              </label>
            </OpsCycleForm>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          {colors.map((color) => (
            <li key={color.id} className="flex items-center gap-3 rounded-lg border border-forest/10 px-3 py-2">
              <span
                className="h-5 w-5 rounded-full border border-forest/20"
                style={{ background: color.hex || "#eee" }}
              />
              <span className="font-medium">{color.nameTh}</span>
              <span className="text-ink/50">{color.code}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
