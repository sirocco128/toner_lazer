import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addSerialAction,
  createSkuForOriAction,
  saveSkuCostAction,
  updateSkuAction,
} from "@/app/actions/ops-products";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { SkuClassBadge } from "@/components/SkuClassBadge";
import { SkuFilePanel } from "@/components/SkuFilePanel";
import { SkuMoveToCForm } from "@/components/SkuMoveToCForm";
import { SkuTagForm } from "@/components/SkuTagForm";
import { SkuThumb } from "@/components/SkuThumb";
import { OpsProductSubnav } from "@/components/OpsProductSubnav";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { parseProductId } from "@/lib/sku-master-ids";
import {
  getSku,
  listBundleItems,
  listSerials,
  listSkuMoves,
  listSkuTagSuggestions,
} from "@/lib/sku-master-repository";
import { isSkuFileServePath, listSkuFiles } from "@/lib/sku-files";
import { SERIAL_STATUS_LABELS, STOCK_CLASS_LABELS } from "@/lib/sku-master-types";
import { skuPriceStructure } from "@/lib/sku-price-structure";
import { formatThb } from "@/lib/th-billing";
import { SkuPriceStructureTable } from "@/components/SkuPriceStructure";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SkuDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const actor = await requireOpsPage("catalog.write");
  const canSeeCost = actorMay(actor, "factory.read");
  const { productId: raw } = await params;
  if (!parseProductId(raw)) notFound();
  const sku = await getSku(raw);
  if (!sku) notFound();

  const [serials, moves, tags, bundleItems, files] = await Promise.all([
    listSerials(sku.productId),
    listSkuMoves(sku.productId),
    listSkuTagSuggestions(),
    sku.isBundle ? listBundleItems(sku.productId) : Promise.resolve([]),
    listSkuFiles({ productId: sku.productId }),
  ]);
  const remoteImageUrl =
    !isSkuFileServePath(sku.imageUrl) && /^https?:\/\//i.test(sku.displayImageUrl)
      ? sku.displayImageUrl
      : null;
  const standardPrices = skuPriceStructure(sku, "standard");
  const corporatePrices = skuPriceStructure(sku, "corporate");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm">
          <Link href="/ops/products" className="text-forest underline-offset-2 hover:underline">
            ← รหัสขาย
          </Link>
        </p>
        <div className="mt-3 flex items-start gap-4">
          <SkuThumb src={sku.displayImageUrl} alt={sku.nameTh} className="h-16 w-16" />
          <div>
            <h1 className="font-mono text-2xl font-bold text-forest">{sku.productId}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SkuClassBadge stockClass={sku.stockClass} bundle={sku.isBundle} />
              {sku.oriProductCode && sku.oriProductId ? (
                <Link
                  href={`/ops/products/ori/${sku.oriProductId}`}
                  className="text-sm text-forest underline-offset-2 hover:underline"
                >
                  โรงงาน {sku.oriProductCode}
                </Link>
              ) : sku.oriProductCode ? (
                <span className="text-sm text-ink/70">โรงงาน {sku.oriProductCode}</span>
              ) : null}
              {sku.colorNameTh ? <span className="text-sm text-ink/70">{sku.colorNameTh}</span> : null}
            </div>
            <p className="mt-1 text-sm text-ink/70">{STOCK_CLASS_LABELS[sku.stockClass]}</p>
          </div>
        </div>
        <div className="mt-4">
          <OpsProductSubnav current="sku" />
        </div>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm" aria-label="ไปส่วนในหน้า">
          <a href="#edit" className="text-forest underline-offset-2 hover:underline">แก้ไข</a>
          <a href="#files" className="text-forest underline-offset-2 hover:underline">รูปและไฟล์</a>
          {canSeeCost ? (
            <a href="#cost" className="text-forest underline-offset-2 hover:underline">ขั้นต่ำสั่ง</a>
          ) : null}
          {(sku.stockClass === "A" || sku.stockClass === "B") && !sku.isBundle ? (
            <>
              <a href="#serial" className="text-forest underline-offset-2 hover:underline">ซีเรียล</a>
              <a href="#move-c" className="text-forest underline-offset-2 hover:underline">ย้ายเคลียร์</a>
            </>
          ) : null}
        </nav>
      </div>

      <section id="edit" className="scroll-mt-8 rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="font-semibold text-forest">แก้ไขรหัสขาย</h2>
        <div className="mt-4">
          <OpsCycleForm action={updateSkuAction} submitLabel="บันทึกสินค้า">
            <input type="hidden" name="productId" value={sku.productId} />
            <label className="block text-sm">
              <span className="font-medium">ชื่อไทย</span>
              <input
                name="nameTh"
                required
                defaultValue={sku.nameTh}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">ชื่ออังกฤษ</span>
              <input
                name="nameEn"
                defaultValue={sku.nameEn || ""}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">
                {sku.isBundle ? "ราคาบันเดิล (บาท)" : "ราคาขาย (บาท)"}
              </span>
              <input
                name="sellPriceThb"
                type="number"
                min={0}
                step="0.01"
                defaultValue={sku.sellPriceThb ?? ""}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">รหัสหน้าเว็บ (slug)</span>
              <input
                name="catalogSlug"
                defaultValue={sku.catalogSlug || ""}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">URL รูปจริง</span>
              <input
                name="imageUrl"
                defaultValue={sku.imageUrl || ""}
                placeholder="ว่างได้ — จะใช้รูปจากหน้าเว็บถ้ามี slug หรือ placeholder"
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-ink/55">
                แนะนำให้อัปโหลดเข้า MinIO ด้านล่าง ช่องนี้เก็บ URL ปกหลังดึงเข้าคลังแล้ว
              </span>
            </label>
            {sku.stockClass === "C" ? (
              <label className="block text-sm">
                <span className="font-medium">ตำหนิ / เหตุผลเคลียร์</span>
                <textarea
                  name="clearanceReason"
                  rows={3}
                  defaultValue={sku.clearanceReason || ""}
                  className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                />
              </label>
            ) : null}
          </OpsCycleForm>
        </div>
      </section>

      <SkuFilePanel
        productId={sku.productId}
        oriProductId={sku.oriProductId}
        files={files}
        remoteImageUrl={remoteImageUrl}
      />

      {sku.isBundle ? (
        <section className="rounded-xl border border-forest/15 bg-paper p-5">
          <h2 className="font-semibold text-forest">ชิ้นในชุด (ไม่มีราคาชิ้น)</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {bundleItems.map((item) => (
              <li key={item.componentProductId}>
                <Link
                  href={`/ops/products/${item.componentProductId}`}
                  className="font-mono text-forest underline-offset-2 hover:underline"
                >
                  {item.componentProductId}
                </Link>
                <span>
                  {" "}
                  × {item.qty} · {item.nameTh}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SkuTagForm productId={sku.productId} tags={sku.tags} suggestions={tags} />

      <section id="cost" className="scroll-mt-8 rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="font-semibold text-forest">
          {canSeeCost ? "ต้นทุนลงเรือและโครงสร้างราคา" : "โครงสร้างราคาและขั้นต่ำสั่ง"}
        </h2>
        {canSeeCost ? (
          <>
            <p className="mt-1 text-sm text-ink/70">
              บังคับใบเสนอราคาและออเดอร์เมื่อคำนวณแล้ว ค่า USD ในสูตรคือ 32.50 ไม่ใช้เรทตลาดจากใบสั่งโรงงาน
            </p>
            <p className="mt-2 text-sm">
              ขั้นต่ำปัจจุบัน: <strong>{sku.forcedMinQty ?? "ยังไม่คำนวณ"}</strong>
              {sku.unitLandedCostThb != null
                ? ` · ต้นทุนลงเรือ ${formatThb(sku.unitLandedCostThb)}`
                : ""}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink/70">
            ขั้นต่ำสั่งสำหรับใบเสนอราคา:{" "}
            <strong>{sku.forcedMinQty ?? "ยังไม่คำนวณ"}</strong>
            {" "}— ต้นทุนโรงงานและต้นทุนลงเรือไม่เปิดในบัญชีนี้
          </p>
        )}
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-forest">ทั่วไป</h3>
            <SkuPriceStructureTable structure={standardPrices} showCost={canSeeCost} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-forest">องค์กร</h3>
            <SkuPriceStructureTable structure={corporatePrices} showCost={canSeeCost} />
          </div>
        </div>
        {canSeeCost ? (
            <div className="mt-4">
              <OpsCycleForm action={saveSkuCostAction} submitLabel="คำนวณขั้นต่ำสั่ง">
                <input type="hidden" name="productId" value={sku.productId} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium">ต้นทุนโรงงาน (CNY)</span>
                    <input
                      name="factoryUnitCny"
                      type="number"
                      min={0}
                      step="0.0001"
                      defaultValue={sku.factoryUnitCny ?? ""}
                      className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">ต้นทุนโรงงาน (USD)</span>
                    <input
                      name="factoryUnitUsd"
                      type="number"
                      min={0}
                      step="0.0001"
                      defaultValue={sku.factoryUnitUsd ?? ""}
                      className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">ต้นทุนลงเรือต่อชิ้น (บาท)</span>
                    <input
                      name="unitLandedCostThb"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={sku.unitLandedCostThb ?? ""}
                      className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">โปรไฟล์</span>
                    <select name="profile" defaultValue="standard" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
                      <option value="standard">ทั่วไป (กำไรชุด 5,000 / 3,000)</option>
                      <option value="corporate">องค์กร (markup 1.47 กำไรชุด 20,000)</option>
                    </select>
                  </label>
                </div>
              </OpsCycleForm>
            </div>
        ) : null}
      </section>

      {sku.oriProductId && !sku.isBundle ? (
        <section className="rounded-xl border border-forest/15 bg-paper p-5">
          <h2 className="font-semibold text-forest">สร้างรหัส A / B / D ของ ori นี้</h2>
          <div className="mt-4">
            <OpsCycleForm action={createSkuForOriAction} submitLabel="สร้างรหัส">
              <input type="hidden" name="oriProductId" value={sku.oriProductId} />
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
      ) : null}

      {(sku.stockClass === "A" || sku.stockClass === "B") && !sku.isBundle ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section id="serial" className="scroll-mt-8 rounded-xl border border-forest/15 bg-paper p-5">
            <h2 className="font-semibold text-forest">ซีเรียลในคลัง ({sku.onHandQty})</h2>
            {sku.stockClass === "B" && sku.onHandQty === 0 ? (
              <p className="mt-1 text-sm text-ink/60">คลาส B คือสั่งผลิต — ยังไม่มีของในคลังจนกว่าจะรับเข้า</p>
            ) : null}
            <ul className="mt-3 space-y-1 text-sm">
              {serials.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span className="font-mono">{item.serialNo}</span>
                  <span className="text-ink/55">{SERIAL_STATUS_LABELS[item.status]}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <OpsCycleForm action={addSerialAction} submitLabel="เพิ่มซีเรียล">
                <input type="hidden" name="productId" value={sku.productId} />
                <label className="block text-sm">
                  <span className="font-medium">เลขซีเรียล</span>
                  <input name="serialNo" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
                </label>
              </OpsCycleForm>
            </div>
          </section>
          <section id="move-c" className="scroll-mt-8 rounded-xl border border-forest/15 bg-paper p-5">
            <h2 className="font-semibold text-forest">ย้ายซีเรียลไป C</h2>
            <p className="mt-1 text-sm text-ink/70">ตัดออกจาก A/B เข้าเคลียร์พร้อมตำหนิและราคาลด</p>
            <div className="mt-4">
              <SkuMoveToCForm fromProductId={sku.productId} serials={serials} />
            </div>
          </section>
        </div>
      ) : null}

      {sku.stockClass === "C" ? (
        <section className="rounded-xl border border-forest/15 bg-paper p-5">
          <h2 className="font-semibold text-forest">ประวัติย้ายเข้าเคลียร์</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {moves.map((move) => (
              <li key={move.id}>
                {move.serialNo} จาก {move.fromProductId} → {move.toProductId} · {move.defectReason} ·{" "}
                {formatThb(move.clearancePriceThb)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
