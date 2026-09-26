import Link from "next/link";
import { requireOpsPage } from "@/lib/ops-auth";
import { OpsProductSubnav } from "@/components/OpsProductSubnav";
import { SkuBundleBuilder } from "@/components/SkuBundleBuilder";
import { listBundleComponentOptions } from "@/lib/sku-master-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewBundlePage() {
  await requireOpsPage("catalog.write");
  const options = await listBundleComponentOptions();

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/products" className="text-forest underline-offset-2 hover:underline">
          ← รหัสขาย
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">สร้างบันเดิล</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        ตั้งชื่อชุดเอง เลือกชิ้น A/B ไม่โชว์ราคาชิ้น ระบบออกรหัสใหม่ที่มีราคาเดียว
      </p>
      <div className="mt-4">
        <OpsProductSubnav current="sku" />
      </div>
      <div className="mt-6 max-w-2xl rounded-xl border border-forest/15 bg-paper p-5">
        <SkuBundleBuilder options={options} />
      </div>
    </div>
  );
}
