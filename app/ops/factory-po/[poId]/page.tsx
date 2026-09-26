import Link from "next/link";
import { notFound } from "next/navigation";
import { FactoryPoForm } from "@/components/FactoryPoForm";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { getFactoryPo } from "@/lib/factory-po-queries";
import { listFactoriesForPoForm } from "@/lib/factory-registry-service";
import { FACTORY_PO_STATUS_LABELS } from "@/lib/factory-po-types";
import { getOrderRepository } from "@/lib/order-repository";
import { formatThb } from "@/lib/th-billing";
import { costFromPo } from "@/lib/po-cost";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ poId: string }>;

export default async function FactoryPoDetailPage({
  params,
}: {
  params: Params;
}) {
  const actor = await requireOpsPage("factory.read");
  const canWrite = actorMay(actor, "factory.write");
  const { poId } = await params;
  const po = getFactoryPo(poId);
  if (!po) notFound();
  const order = getOrderRepository().getOrderByOrderId(po.orderId);
  const cost = costFromPo(po);
  const gp = order ? order.subtotalExVat - cost.cogsThb : null;

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/factory-po" className="text-forest underline-offset-2 hover:underline">
          ← ใบสั่งโรงงาน
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold text-forest sm:text-2xl">{po.poId}</h1>
          <p className="mt-1 text-sm text-ink/70">
            {FACTORY_PO_STATUS_LABELS[po.status]} · {po.factoryName}
            {order ? (
              <>
                {" · "}
                <Link
                  href={`/ops/orders/${po.orderId}`}
                  className="text-forest underline-offset-2 hover:underline"
                >
                  {po.orderId}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/ops/factory-po/${po.poId}/print`}
            className="rounded border border-forest/30 px-3 py-1.5 text-sm text-forest hover:bg-forest/5"
          >
            พรีวิว / PDF
          </Link>
          {canWrite ? (
            <>
              <Link
                href={`/ops/inbound?poId=${encodeURIComponent(po.poId)}`}
                className="rounded border border-forest/30 px-3 py-1.5 text-sm text-forest hover:bg-forest/5"
              >
                รับสินค้าตาม PO
              </Link>
              <Link
                href="/ops/pay-factory"
                className="rounded border border-forest/30 px-3 py-1.5 text-sm text-forest hover:bg-forest/5"
              >
                จ่ายตามของที่รับ
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-forest/10 bg-paper p-3">
          <dt className="text-xs text-ink/55">ต้นทุนขาย</dt>
          <dd className="text-lg font-semibold">{formatThb(cost.cogsThb)}</dd>
        </div>
        <div className="rounded-xl border border-forest/10 bg-paper p-3">
          <dt className="text-xs text-ink/55">ลงเรือรวม</dt>
          <dd className="text-lg font-semibold">{formatThb(cost.landedTotalThb)}</dd>
        </div>
        <div className="rounded-xl border border-forest/10 bg-paper p-3">
          <dt className="text-xs text-ink/55">รายได้ไม่รวม VAT</dt>
          <dd className="text-lg font-semibold">
            {order ? formatThb(order.subtotalExVat) : "—"}
          </dd>
        </div>
        <div className="rounded-xl bg-forest p-3 text-paper">
          <dt className="text-xs text-paper/70">กำไรขั้นต้นใบนี้</dt>
          <dd className="text-lg font-semibold">
            {gp == null ? "—" : formatThb(gp)}
          </dd>
        </div>
      </dl>

      {canWrite ? (
        <div className="mt-8">
          <FactoryPoForm
            orderId={po.orderId}
            po={po}
            factories={listFactoriesForPoForm(po.factoryId)}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink/70">ดูได้อย่างเดียว</p>
      )}
    </div>
  );
}
