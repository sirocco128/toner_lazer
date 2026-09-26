import Link from "next/link";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { createDropshipAction, setDropshipStatusAction } from "@/app/actions/ops-dropship";
import { COMPANY } from "@/lib/company";
import {
  DROPSHIP_STATUSES,
  DROPSHIP_STATUS_LABELS,
  DROPSHIP_TRANSITIONS,
  buildSupplierMessage,
  isDropshipStatus,
} from "@/lib/dropship";
import { listDropshipOrders } from "@/lib/dropship-repository";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { formatThaiDateTime, formatThb } from "@/lib/th-billing";
import { TONER_CATALOG } from "@/lib/toner-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ ok?: string; status?: string; orderId?: string }>;

const field = "mt-1 w-full rounded border border-forest/20 px-3 py-2";

export default async function DropshipPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireOpsPage("factory.read");
  const canWrite = actorMay(actor, "factory.write");
  const sp = await searchParams;
  const status = sp.status && isDropshipStatus(sp.status) ? sp.status : undefined;
  const rows = listDropshipOrders({ status, limit: 100 });

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">ใบสั่งส่งตรง (Dropship)</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink/70">
        สั่งซัพพลายเออร์แพ็กในกล่อง {COMPANY.brandName} แล้วส่งตรงถึงลูกค้า
        คัดลอกข้อความไปส่งทาง LINE หรืออีเมล เมื่อได้เลขพัสดุให้บันทึกกลับ
      </p>
      {sp.ok ? (
        <p className="mt-4 rounded-lg bg-forest/10 px-3 py-2 text-sm text-forest">บันทึก {sp.ok} แล้ว</p>
      ) : null}

      {canWrite ? (
        <details className="mt-6 rounded-xl border border-forest/15 bg-paper p-5" open={rows.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-forest">สร้างใบสั่งส่งตรงใหม่</summary>
          <div className="mt-4">
            <OpsCycleForm action={createDropshipAction} submitLabel="สร้างใบสั่งส่งตรง">
              <label className="block text-sm">
                <span className="font-medium">เลขออเดอร์ (ถ้ามี — ดึงชื่อและที่อยู่จัดส่งจากออเดอร์)</span>
                <input name="orderId" defaultValue={sp.orderId || ""} className={field} placeholder="ORD-..." />
              </label>
              <label className="block text-sm">
                <span className="font-medium">รายการ (บรรทัดละรุ่น: รุ่นหรือรหัส x จำนวน)</span>
                <textarea
                  name="lines"
                  required
                  rows={4}
                  className={`${field} font-mono`}
                  placeholder={"85A x 5\nTN-2380 x 2\nTL-SS-D111S 3"}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium">ชื่อผู้รับ</span>
                  <input name="shipToName" className={field} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">โทรผู้รับ</span>
                  <input name="shipToPhone" className={field} inputMode="tel" />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium">ที่อยู่จัดส่ง</span>
                  <textarea name="shipToAddress" rows={2} className={field} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">จังหวัด</span>
                  <input name="shipToProvince" className={field} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">หมายเหตุถึงซัพพลายเออร์</span>
                  <input name="notes" className={field} />
                </label>
              </div>
            </OpsCycleForm>
            <p className="mt-4 text-xs text-ink/60">
              รุ่นที่มี: {TONER_CATALOG.map((t) => t.model).join(" · ")}
            </p>
          </div>
        </details>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/ops/dropship" className={!status ? "font-semibold text-forest" : "text-ink/70"}>
          ทั้งหมด
        </Link>
        {DROPSHIP_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/ops/dropship?status=${s}`}
            className={status === s ? "font-semibold text-forest" : "text-ink/70"}
          >
            · {DROPSHIP_STATUS_LABELS[s]}
          </Link>
        ))}
        <a
          href={`/api/ops/dropship${status ? `?status=${status}` : ""}`}
          className="ml-auto rounded border border-forest/20 px-3 py-1.5 text-forest"
        >
          ดาวน์โหลด CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">ยังไม่มีใบสั่งส่งตรง</p>
      ) : (
        <ul className="mt-6 space-y-5">
          {rows.map((row) => {
            const message = buildSupplierMessage(row, COMPANY.brandName);
            const next = DROPSHIP_TRANSITIONS[row.status];
            return (
              <li key={row.dropshipId} id={row.dropshipId} className="rounded-xl border border-forest/15 bg-paper p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold text-forest">
                    {row.dropshipId}
                    {row.orderId ? (
                      <Link href={`/ops/orders/${row.orderId}`} className="ml-2 text-sm font-normal text-brass">
                        {row.orderId}
                      </Link>
                    ) : null}
                  </h2>
                  <span className="rounded-full bg-forest/10 px-3 py-1 text-xs text-forest">
                    {DROPSHIP_STATUS_LABELS[row.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/60">
                  สร้าง {formatThaiDateTime(row.createdAt)} โดย {row.createdBy || "-"}
                  {row.trackingNo ? ` · พัสดุ ${row.carrier ? `${row.carrier} ` : ""}${row.trackingNo}` : ""}
                </p>
                <p className="mt-2 text-sm">
                  {row.totalQty} ตลับ · ค่าสินค้าจ่ายซัพพลายเออร์ {formatThb(row.supplierTotalThb)} ·
                  ค่ากล่อง {formatThb(row.boxTotalThb)}
                </p>
                <label className="mt-3 block text-xs text-ink/60">
                  ข้อความส่งซัพพลายเออร์ (เลือกทั้งหมดแล้วคัดลอก)
                  <textarea readOnly rows={Math.min(18, message.split("\n").length + 1)} defaultValue={message} className="mt-1 w-full rounded border border-forest/15 bg-forest-mist/30 p-3 font-mono text-xs text-ink" />
                </label>
                {canWrite && next.length > 0 ? (
                  <div className="mt-3">
                    <OpsCycleForm action={setDropshipStatusAction} submitLabel="บันทึกสถานะ">
                      <input type="hidden" name="dropshipId" value={row.dropshipId} />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="block text-sm">
                          <span className="font-medium">สถานะถัดไป</span>
                          <select name="status" defaultValue={next[0]} className={field}>
                            {next.map((s) => (
                              <option key={s} value={s}>
                                {DROPSHIP_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">ขนส่ง</span>
                          <input name="carrier" defaultValue={row.carrier || ""} className={field} placeholder="Flash, Kerry, ไปรษณีย์" />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">เลขพัสดุ</span>
                          <input name="trackingNo" defaultValue={row.trackingNo || ""} className={field} />
                        </label>
                      </div>
                    </OpsCycleForm>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
