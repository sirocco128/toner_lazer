import { notFound } from "next/navigation";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";
import { COMPANY, formatRegisteredAddress } from "@/lib/company";
import { requireOpsPage } from "@/lib/ops-auth";
import { getFactoryPo } from "@/lib/factory-po-queries";
import {
  FACTORY_CURRENCY_LABELS,
  FACTORY_PLATFORM_LABELS,
  FACTORY_PO_STATUS_LABELS,
  FREIGHT_MODE_LABELS,
  factoryCurrencyNoun,
  factoryFxPairLabel,
} from "@/lib/factory-po-types";
import { LOGO_DECORATION_OPTIONS } from "@/lib/product-decoration";
import { formatThaiDate } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ poId: string }>;

export default async function FactoryPoPrintPage({
  params,
}: {
  params: Params;
}) {
  await requireOpsPage("factory.read");
  const { poId } = await params;
  const po = getFactoryPo(poId);
  if (!po) notFound();
  const decoration =
    LOGO_DECORATION_OPTIONS.find((o) => o.value === po.decorationMethod)?.label ||
    po.decorationMethod ||
    "—";

  return (
    <DocumentPreviewShell
      backHref={`/ops/factory-po/${po.poId}`}
      backLabel="← กลับใบสั่ง"
      fileName={po.poId}
    >
      <header className="border-b border-forest/20 pb-4">
        <p className="text-xs tracking-wide text-ink/55">ใบสั่งผลิต — โรงงานจีน</p>
        <h1 className="mt-1 text-2xl font-bold text-forest">{COMPANY.legalName}</h1>
        <p className="text-sm text-ink/70">
          เลขประจำตัวผู้เสียภาษี {COMPANY.taxId} · {formatRegisteredAddress()}
        </p>
        <p className="mt-3 font-mono text-lg font-semibold">{po.poId}</p>
        <p className="text-sm">
          {FACTORY_PO_STATUS_LABELS[po.status]} · {formatThaiDate(po.createdAt)}
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-forest">โรงงาน</h2>
          <p className="mt-1 font-medium">{po.factoryName}</p>
          <p className="text-sm text-ink/70">{FACTORY_PLATFORM_LABELS[po.factoryPlatform]}</p>
          {po.factoryContact ? <p className="text-sm">{po.factoryContact}</p> : null}
          {po.sourceOfferId ? (
            <p className="font-mono text-xs text-ink/60">{po.sourceOfferId}</p>
          ) : null}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-forest">จัดส่งปลายทาง (ไทย)</h2>
          <p className="mt-1">{po.shipToName || "—"}</p>
          <p className="text-sm">{po.shipToPhone || ""}</p>
          <p className="text-sm whitespace-pre-wrap">{po.shipToAddress || "—"}</p>
          <p className="text-sm">{po.shipToProvince || ""}</p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-forest">รายละเอียดผลิต</h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b border-forest/10">
              <td className="py-1.5 text-ink/55">สินค้า</td>
              <td className="py-1.5 font-medium">{po.productName}</td>
            </tr>
            <tr className="border-b border-forest/10">
              <td className="py-1.5 text-ink/55">จำนวน</td>
              <td className="py-1.5">{po.quantity}</td>
            </tr>
            <tr className="border-b border-forest/10">
              <td className="py-1.5 text-ink/55">สี / วัสดุ</td>
              <td className="py-1.5">
                {po.color || "—"} / {po.material || "—"}
              </td>
            </tr>
            <tr className="border-b border-forest/10">
              <td className="py-1.5 text-ink/55">สกรีนโลโก้</td>
              <td className="py-1.5">
                {decoration}
                {po.logoPosition ? ` · ${po.logoPosition}` : ""}
              </td>
            </tr>
            <tr className="border-b border-forest/10">
              <td className="py-1.5 text-ink/55">โลโก้</td>
              <td className="whitespace-pre-wrap py-1.5">{po.logoNotes || "—"}</td>
            </tr>
            <tr className="border-b border-forest/10">
              <td className="py-1.5 text-ink/55">แพ็กเกจ</td>
              <td className="whitespace-pre-wrap py-1.5">{po.packagingNotes || "—"}</td>
            </tr>
            <tr className="border-b border-forest/10">
              <td className="py-1.5 text-ink/55">QC</td>
              <td className="whitespace-pre-wrap py-1.5">{po.qcNotes || "—"}</td>
            </tr>
            <tr className="border-b border-forest/10">
              <td className="py-1.5 text-ink/55">
                ราคาโรงงาน ({factoryCurrencyNoun(po.factoryCurrency)})
              </td>
              <td className="py-1.5">
                {po.factoryUnitCny.toFixed(2)} {FACTORY_CURRENCY_LABELS[po.factoryCurrency]} / ชิ้น · รวม{" "}
                {po.factoryAmountCny.toFixed(2)} {factoryCurrencyNoun(po.factoryCurrency)}
                {" · "}เรท {po.fxCnyThb} {factoryFxPairLabel(po.factoryCurrency)}
              </td>
            </tr>
            <tr>
              <td className="py-1.5 text-ink/55">ขนส่ง</td>
              <td className="py-1.5">
                {po.freightMode ? FREIGHT_MODE_LABELS[po.freightMode] : "—"}
                {po.trackingCn ? ` · CN ${po.trackingCn}` : ""}
                {po.trackingTh ? ` · TH ${po.trackingTh}` : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="mt-8 text-xs text-ink/50">
        เอกสารภายในสำหรับสั่งผลิต — ห้ามส่งต่อราคาขายและมาร์กอัปให้โรงงาน
      </p>
    </DocumentPreviewShell>
  );
}
