import { notFound } from "next/navigation";
import { DocumentPreviewShell } from "@/components/DocumentPreviewShell";
import { COMPANY, formatRegisteredAddress } from "@/lib/company";
import { getFactoryPo } from "@/lib/factory-po-queries";
import { requireOpsPage } from "@/lib/ops-auth";
import { getClaimByReceiptId, getGoodsReceipt } from "@/lib/ops-cycle-service";
import { DESTINATION_LABELS } from "@/lib/ops-cycle-types";
import { formatThaiDate, formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ receiptId: string }>;

export default async function GoodsReceiptPrintPage({
  params,
}: {
  params: Params;
}) {
  await requireOpsPage("factory.read");
  const { receiptId } = await params;
  const receipt = getGoodsReceipt(receiptId);
  if (!receipt) notFound();
  const po = getFactoryPo(receipt.poId);
  const claim = getClaimByReceiptId(receipt.receiptId);

  return (
    <DocumentPreviewShell
      backHref="/ops/inbound"
      backLabel="← กลับรับสินค้าเข้า"
      fileName={receipt.receiptId}
    >
      <article className="max-w-full break-words">
        <header className="border-b border-forest/20 pb-4">
          <p className="text-lg font-bold text-forest">{COMPANY.legalName}</p>
          <p className="mt-1 text-sm text-ink/75">{formatRegisteredAddress()}</p>
          <p className="text-sm">เลขประจำตัวผู้เสียภาษี {COMPANY.taxId}</p>
          <h1 className="mt-4 text-center text-xl font-bold tracking-wide">ใบรับสินค้า</h1>
          <p className="text-center text-xs text-ink/60">ตามใบสั่งโรงงาน — เอกสารภายใน</p>
        </header>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink/55">เลขที่ใบรับ</dt>
            <dd className="font-mono font-semibold">{receipt.receiptId}</dd>
          </div>
          <div>
            <dt className="text-ink/55">วันที่รับ</dt>
            <dd>{formatThaiDate(receipt.receivedAt)}</dd>
          </div>
          <div>
            <dt className="text-ink/55">ใบสั่งโรงงาน</dt>
            <dd className="font-mono">{receipt.poId}</dd>
          </div>
          <div>
            <dt className="text-ink/55">ออเดอร์ลูกค้า</dt>
            <dd className="font-mono">{receipt.orderId || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ink/55">สินค้า</dt>
            <dd className="font-medium">{po?.productName || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink/55">ปลายทาง</dt>
            <dd>{DESTINATION_LABELS[receipt.destination]}</dd>
          </div>
          <div>
            <dt className="text-ink/55">เลขติดตามไทย</dt>
            <dd>{receipt.trackingTh || "—"}</dd>
          </div>
        </dl>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-forest/20 text-left">
              <th className="py-2">รายการ</th>
              <th className="py-2 text-right">จำนวน</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-forest/10">
              <td className="py-2">สั่งในใบสั่ง</td>
              <td className="py-2 text-right">{receipt.qtyOrdered}</td>
            </tr>
            <tr className="border-b border-forest/10">
              <td className="py-2">รับดี</td>
              <td className="py-2 text-right">{receipt.qtyReceived}</td>
            </tr>
            <tr className="border-b border-forest/10">
              <td className="py-2">เสีย / ไม่ผ่าน QC</td>
              <td className="py-2 text-right">{receipt.qtyDamaged}</td>
            </tr>
            <tr className="border-b border-forest/10">
              <td className="py-2">ขาด</td>
              <td className="py-2 text-right">{receipt.qtyShort}</td>
            </tr>
            <tr>
              <td className="py-2">ยอดตามของที่รับ (บาท)</td>
              <td className="py-2 text-right font-semibold">{formatThb(receipt.amountThb)}</td>
            </tr>
          </tbody>
        </table>

        {receipt.qcNotes ? (
          <p className="mt-4 whitespace-pre-wrap text-sm">บันทึก QC: {receipt.qcNotes}</p>
        ) : null}
        {claim ? (
          <p className="mt-3 text-sm">
            เปิดเคลมอัตโนมัติจากของเสีย{" "}
            <span className="font-mono">{claim.claimId}</span>
          </p>
        ) : null}

        <p className="mt-8 text-xs text-ink/50">
          เอกสารภายในสำหรับรับของตามใบสั่งโรงงาน — ไม่แสดงราคาขายลูกค้า
        </p>
      </article>
    </DocumentPreviewShell>
  );
}
