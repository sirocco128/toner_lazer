import Link from "next/link";
import { requireOpsPage } from "@/lib/ops-auth";
import { FactoryOpsSubnav } from "@/components/FactoryOpsSubnav";
import { listFactoriesWithPoCount } from "@/lib/factory-registry-repository";
import {
  FACTORY_ORIGIN_LABELS,
  FACTORY_STATUS_LABELS,
  FACTORY_STATUSES,
  type FactoryStatus,
} from "@/lib/factory-registry-types";
import { FACTORY_PLATFORM_LABELS } from "@/lib/factory-po-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ q?: string; status?: string }>;

export default async function FactoriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("factory.read");
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const statusRaw = (sp.status || "all").trim();
  const status =
    statusRaw === "all" || (FACTORY_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as FactoryStatus | "all")
      : "all";
  const rows = listFactoriesWithPoCount({ q, status });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest">ทะเบียนโรงงาน</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/70">
            ผู้ขายที่สั่งของ — ผูกกับรหัสโรงงานของสินค้า (ori) และใบสั่ง PO
            คนละชุดกับรหัสขาย A/B/C/D
          </p>
        </div>
        <Link
          href="/ops/factories/new"
          className="rounded bg-forest px-3 py-1.5 text-sm text-paper"
        >
          เพิ่มโรงงาน
        </Link>
      </div>
      <FactoryOpsSubnav current="registry" />

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นรหัส / ชื่อ / เมือง / WeChat"
          className="min-w-56 flex-1 rounded border border-forest/20 px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-forest/20 px-3 py-2 text-sm"
        >
          <option value="all">ทุกสถานะ</option>
          {FACTORY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FACTORY_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-forest px-4 py-2 text-sm text-paper">
          ค้นหา
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2 font-semibold">รหัส</th>
              <th className="px-2 py-2 font-semibold">โรงงาน</th>
              <th className="px-2 py-2 font-semibold">ต้นทาง</th>
              <th className="px-2 py-2 font-semibold">สถานะ</th>
              <th className="px-2 py-2 text-right font-semibold">ใบสั่ง</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-8 text-center text-ink/60">
                  {q
                    ? "ไม่พบโรงงานที่ตรงคำค้น"
                    : "ยังไม่มีทะเบียน — เพิ่มโรงงานก่อนสั่งของ เพื่อไม่ให้ชื่อสะกดคนละแบบ"}
                </td>
              </tr>
            ) : (
              rows.map((factory) => (
                <tr key={factory.id} className="border-b border-forest/10">
                  <td className="px-2 py-2.5">
                    <Link
                      href={`/ops/factories/${factory.id}`}
                      className="font-mono text-forest underline-offset-2 hover:underline"
                    >
                      {factory.factoryCode}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5">
                    <p>{factory.name}</p>
                    <p className="text-xs text-ink/55">
                      {FACTORY_PLATFORM_LABELS[factory.platform]}
                      {factory.city ? ` · ${factory.city}` : ""}
                    </p>
                  </td>
                  <td className="px-2 py-2.5 text-ink/70">
                    {factory.origin ? FACTORY_ORIGIN_LABELS[factory.origin] : "—"}
                  </td>
                  <td className="px-2 py-2.5">{FACTORY_STATUS_LABELS[factory.status]}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{factory.poCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
