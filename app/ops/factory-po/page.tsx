import Link from "next/link";
import { requireOpsPage } from "@/lib/ops-auth";
import { listPos } from "@/lib/factory-po-queries";
import {
  FACTORY_PO_STATUS_LABELS,
  FACTORY_PO_STATUSES,
  type FactoryPoStatus,
} from "@/lib/factory-po-types";
import { FactoryOpsSubnav } from "@/components/FactoryOpsSubnav";
import { formatThb, formatThaiDateTime } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ q?: string; status?: string }>;

export default async function FactoryPoListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("factory.read");
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const statusRaw = (sp.status || "all").trim();
  const status =
    statusRaw === "all" || (FACTORY_PO_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as FactoryPoStatus | "all")
      : "all";
  const rows = listPos({ q, status });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest">ใบสั่งโรงงานจีน</h1>
          <p className="mt-1 text-sm text-ink/70">
            ส่งสเปคโลโก้และต้นทุนลงเรือกลับโรงงาน — ไม่แสดงบนเว็บลูกค้า
          </p>
        </div>
        <Link
          href="/ops/factories/new"
          className="rounded border border-forest/30 px-3 py-1.5 text-sm text-forest"
        >
          เพิ่มทะเบียนโรงงาน
        </Link>
      </div>
      <FactoryOpsSubnav current="po" />

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นเลข PO / ออเดอร์ / โรงงาน"
          className="min-w-56 flex-1 rounded border border-forest/20 px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-forest/20 px-3 py-2 text-sm"
        >
          <option value="all">ทุกสถานะ</option>
          {FACTORY_PO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FACTORY_PO_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-forest px-4 py-2 text-sm text-paper"
        >
          ค้นหา
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2 font-semibold">ใบสั่ง</th>
              <th className="px-2 py-2 font-semibold">ออเดอร์</th>
              <th className="px-2 py-2 font-semibold">โรงงาน</th>
              <th className="px-2 py-2 font-semibold">สถานะ</th>
              <th className="px-2 py-2 text-right font-semibold">ต้นทุนลงเรือ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-8 text-center text-ink/60">
                  ยังไม่มีใบสั่งโรงงาน — เปิดจากหน้ารายละเอียดออเดอร์
                </td>
              </tr>
            ) : (
              rows.map((po) => (
                <tr key={po.poId} className="border-b border-forest/10">
                  <td className="px-2 py-2.5">
                    <Link
                      href={`/ops/factory-po/${po.poId}`}
                      className="font-mono text-forest underline-offset-2 hover:underline"
                    >
                      {po.poId}
                    </Link>
                    <p className="text-xs text-ink/55">{formatThaiDateTime(po.createdAt)}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <Link
                      href={`/ops/orders/${po.orderId}`}
                      className="font-mono text-xs text-forest underline-offset-2 hover:underline"
                    >
                      {po.orderId}
                    </Link>
                    <p className="text-xs text-ink/70">{po.productName}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    {po.factoryId ? (
                      <Link
                        href={`/ops/factories/${po.factoryId}`}
                        className="text-forest underline-offset-2 hover:underline"
                      >
                        {po.factoryName}
                      </Link>
                    ) : (
                      po.factoryName
                    )}
                  </td>
                  <td className="px-2 py-2.5">{FACTORY_PO_STATUS_LABELS[po.status]}</td>
                  <td className="px-2 py-2.5 text-right font-medium">
                    {formatThb(po.landedTotalThb)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
