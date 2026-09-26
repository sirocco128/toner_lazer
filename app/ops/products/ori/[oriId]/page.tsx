import Link from "next/link";
import { notFound } from "next/navigation";
import { createSkuForOriAction, updateOriAction } from "@/app/actions/ops-products";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { OpsProductSubnav } from "@/components/OpsProductSubnav";
import { SkuClassBadge } from "@/components/SkuClassBadge";
import { SkuThumb } from "@/components/SkuThumb";
import { SkuFilePanel } from "@/components/SkuFilePanel";
import { requireOpsPage } from "@/lib/ops-auth";
import { listSkuFiles } from "@/lib/sku-files";
import { getOriProduct, listColors, listSkusForOri } from "@/lib/sku-master-repository";
import { listFactoriesForPoForm } from "@/lib/factory-registry-service";
import { getFactoryById } from "@/lib/factory-registry-repository";
import { STOCK_CLASS_LABELS } from "@/lib/sku-master-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OriProductDetailPage({
  params,
}: {
  params: Promise<{ oriId: string }>;
}) {
  await requireOpsPage("catalog.write");
  const { oriId } = await params;
  const oriProductId = Number(oriId);
  if (!Number.isInteger(oriProductId) || oriProductId < 1) notFound();
  const ori = await getOriProduct(oriProductId);
  if (!ori) notFound();
  const [colors, skus, files] = await Promise.all([
    listColors(),
    listSkusForOri(ori.oriProductId),
    listSkuFiles({ oriProductId: ori.oriProductId }),
  ]);
  const factories = listFactoriesForPoForm(ori.factoryId);
  const linkedFactory = ori.factoryId ? getFactoryById(ori.factoryId) : null;
  const existingClasses = new Set(skus.filter((sku) => !sku.isBundle).map((sku) => sku.stockClass));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm">
          <Link href="/ops/products/ori" className="text-forest underline-offset-2 hover:underline">
            ← รหัสโรงงาน
          </Link>
        </p>
        <div className="mt-3 flex items-start gap-4">
          <SkuThumb src={ori.displayImageUrl} alt={ori.oriProductNameTh} className="h-16 w-16" />
          <div>
            <h1 className="font-mono text-2xl font-bold text-forest">{ori.oriProductCode}</h1>
            <p className="mt-1 text-sm text-ink/70">{ori.oriProductNameTh}</p>
            {linkedFactory ? (
              <p className="mt-1 text-xs text-ink/55">
                สั่งจาก{" "}
                <Link
                  href={`/ops/factories/${linkedFactory.id}`}
                  className="text-forest underline-offset-2 hover:underline"
                >
                  {linkedFactory.factoryCode} · {linkedFactory.name}
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-xs text-ink/45">ยังไม่ผูกทะเบียนโรงงานที่สั่ง</p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <OpsProductSubnav current="ori" />
        </div>
      </div>

      <section className="rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="font-semibold text-forest">แก้ไขรหัสโรงงาน</h2>
        <div className="mt-4">
          <OpsCycleForm action={updateOriAction} submitLabel="บันทึก ori">
            <input type="hidden" name="oriProductId" value={ori.oriProductId} />
            <label className="block text-sm">
              <span className="font-medium">ชื่อไทย</span>
              <input
                name="oriProductNameTh"
                required
                defaultValue={ori.oriProductNameTh}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">ชื่ออังกฤษ</span>
              <input
                name="oriProductNameEng"
                defaultValue={ori.oriProductNameEng || ""}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">สีสินค้า</span>
              <select
                name="colorId"
                defaultValue={ori.colorId ?? ""}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              >
                <option value="">ไม่ระบุ</option>
                {colors.map((color) => (
                  <option key={color.id} value={color.id}>
                    {color.nameTh}
                    {color.hex ? ` (${color.hex})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">ทะเบียนโรงงานที่สั่ง</span>
              <select
                name="factoryId"
                defaultValue={ori.factoryId ?? ""}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              >
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
              <textarea
                name="notes"
                rows={2}
                defaultValue={ori.notes || ""}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
          </OpsCycleForm>
        </div>
      </section>

      <SkuFilePanel oriProductId={ori.oriProductId} files={files} />

      <section className="rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="font-semibold text-forest">รหัสขายที่ผูกกับ ori นี้</h2>
        {skus.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">ยังไม่มีรหัสขาย</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {skus.map((sku) => (
              <li key={sku.productId} className="flex items-center gap-3 rounded-lg border border-forest/10 px-3 py-2">
                <SkuThumb src={sku.displayImageUrl} alt={sku.nameTh} className="h-10 w-10" />
                <Link
                  href={`/ops/products/${sku.productId}`}
                  className="font-mono text-forest underline-offset-2 hover:underline"
                >
                  {sku.productId}
                </Link>
                <SkuClassBadge stockClass={sku.stockClass} bundle={sku.isBundle} />
                <span className="min-w-0 flex-1 truncate text-sm">{sku.nameTh}</span>
                <span className="text-xs text-ink/50">{STOCK_CLASS_LABELS[sku.stockClass]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="font-semibold text-forest">สร้างรหัส A / B / D</h2>
        <p className="mt-1 text-sm text-ink/70">
          คลาส C สร้างได้เฉพาะตอนย้ายซีเรียลเข้าเคลียร์
          {existingClasses.size > 0
            ? ` — มีแล้ว: ${[...existingClasses].join(", ")}`
            : ""}
        </p>
        <div className="mt-4">
          <OpsCycleForm action={createSkuForOriAction} submitLabel="สร้างรหัสขาย">
            <input type="hidden" name="oriProductId" value={ori.oriProductId} />
            <label className="block text-sm">
              <span className="font-medium">คลาส</span>
              <select name="stockClass" defaultValue="D" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
                <option value="A">A — มีของในคลัง</option>
                <option value="B">B — สั่งตามออเดอร์</option>
                <option value="D">D — ซื้อซัพสำรอง</option>
              </select>
            </label>
          </OpsCycleForm>
        </div>
      </section>
    </div>
  );
}
