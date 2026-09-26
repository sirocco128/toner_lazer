import Link from "next/link";
import { notFound } from "next/navigation";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { FactoryOpsSubnav } from "@/components/FactoryOpsSubnav";
import { FactoryRegistryForm } from "@/components/FactoryRegistryForm";
import { getFactoryById } from "@/lib/factory-registry-repository";
import {
  FACTORY_ORIGIN_LABELS,
  FACTORY_STATUS_LABELS,
} from "@/lib/factory-registry-types";
import { FACTORY_PLATFORM_LABELS, FACTORY_PO_STATUS_LABELS } from "@/lib/factory-po-types";
import { listPosForFactory } from "@/lib/factory-po-queries";
import { formatThb } from "@/lib/th-billing";
import { isSmartgiftMysqlEnabled } from "@/lib/smartgift-mysql";
import { listOriProductsByFactoryId } from "@/lib/sku-master-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ factoryId: string }>;

export default async function FactoryDetailPage({ params }: { params: Params }) {
  const actor = await requireOpsPage("factory.read");
  const { factoryId: raw } = await params;
  const factoryId = Number(raw);
  if (!Number.isInteger(factoryId) || factoryId < 1) notFound();
  const factory = getFactoryById(factoryId);
  if (!factory) notFound();
  const canWrite = actorMay(actor, "factory.write");
  const pos = listPosForFactory(factory.id);

  let oriRows: Awaited<ReturnType<typeof listOriProductsByFactoryId>> = [];
  if (isSmartgiftMysqlEnabled()) {
    try {
      oriRows = await listOriProductsByFactoryId(factory.id);
    } catch {
      oriRows = [];
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm">
          <Link href="/ops/factories" className="text-forest underline-offset-2 hover:underline">
            ← ทะเบียนโรงงาน
          </Link>
        </p>
        <h1 className="mt-3 font-mono text-2xl font-bold text-forest">{factory.factoryCode}</h1>
        <p className="mt-1 text-sm text-ink/70">
          {factory.name} · {FACTORY_PLATFORM_LABELS[factory.platform]} ·{" "}
          {FACTORY_STATUS_LABELS[factory.status]}
          {factory.origin ? ` · ${FACTORY_ORIGIN_LABELS[factory.origin]}` : ""}
        </p>
        <FactoryOpsSubnav current="registry" />
      </div>

      {canWrite ? (
        <div className="max-w-3xl rounded-xl border border-forest/15 bg-paper p-5">
          <FactoryRegistryForm factory={factory} />
        </div>
      ) : (
        <p className="text-sm text-ink/70">ดูได้อย่างเดียว</p>
      )}

      <section className="rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="font-semibold text-forest">รหัสโรงงานของสินค้าที่ผูก</h2>
        {oriRows.length === 0 ? (
          <p className="mt-2 text-sm text-ink/60">
            ยังไม่ผูก ori — เปิดหน้ารหัสโรงงานของสินค้าแล้วเลือกโรงงานนี้
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {oriRows.map((ori) => (
              <li key={ori.oriProductId}>
                <Link
                  href={`/ops/products/ori/${ori.oriProductId}`}
                  className="font-mono text-forest underline-offset-2 hover:underline"
                >
                  {ori.oriProductCode}
                </Link>
                <span className="text-ink/70"> · {ori.oriProductNameTh}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-forest/15 bg-paper p-5">
        <h2 className="font-semibold text-forest">ใบสั่ง PO</h2>
        {pos.length === 0 ? (
          <p className="mt-2 text-sm text-ink/60">ยังไม่มีใบสั่งจากโรงงานนี้</p>
        ) : (
          <ul className="mt-3 divide-y divide-forest/10 text-sm">
            {pos.map((po) => (
              <li key={po.poId} className="flex flex-wrap justify-between gap-2 py-2">
                <Link
                  href={`/ops/factory-po/${po.poId}`}
                  className="font-mono text-forest underline-offset-2 hover:underline"
                >
                  {po.poId}
                </Link>
                <span>
                  {FACTORY_PO_STATUS_LABELS[po.status]} · ลงเรือ {formatThb(po.landedTotalThb)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
