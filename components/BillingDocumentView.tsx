import { COMPANY, formatRegisteredAddress } from "@/lib/company";
import {
  BILLING_DOCUMENT_LABELS,
  type BillingDocumentRecord,
} from "@/lib/order-types";
import { formatThaiDate, formatThb } from "@/lib/th-billing";

export function BillingDocumentView({
  document,
}: {
  document: BillingDocumentRecord;
}) {
  const isTax = document.documentType === "tax_invoice";
  const isReceipt =
    document.documentType === "receipt" ||
    document.documentType === "deposit_receipt";

  return (
    <article className="max-w-full break-words bg-white text-ink">
      <header className="border-b border-forest/20 pb-4">
        <p className="text-lg font-bold text-forest">{COMPANY.legalName}</p>
        <p className="mt-1 text-sm text-ink/75">{formatRegisteredAddress()}</p>
        <p className="text-sm">
          เลขประจำตัวผู้เสียภาษี {COMPANY.taxId} · สำนักงานใหญ่
        </p>
        <h1 className="mt-4 text-center text-xl font-bold tracking-wide">
          {BILLING_DOCUMENT_LABELS[document.documentType]}
        </h1>
        {isTax ? (
          <p className="text-center text-xs text-ink/60">
            (ใบกำกับภาษีอย่างเต็มรูป)
          </p>
        ) : null}
      </header>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink/55">เลขที่</dt>
          <dd className="font-mono font-semibold">{document.documentId}</dd>
        </div>
        <div>
          <dt className="text-ink/55">วันที่</dt>
          <dd>{formatThaiDate(document.issuedAt)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-ink/55">ผู้ซื้อ</dt>
          <dd className="font-medium">{document.buyerName}</dd>
          {document.buyerBranch ? (
            <dd className="text-ink/70">{document.buyerBranch}</dd>
          ) : null}
          {document.buyerAddress ? (
            <dd className="text-ink/70">{document.buyerAddress}</dd>
          ) : null}
          {document.buyerTaxId ? (
            <dd>เลขประจำตัวผู้เสียภาษี {document.buyerTaxId}</dd>
          ) : null}
        </div>
      </dl>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-forest/20 text-left">
            <th className="py-2">รายการ</th>
            <th className="py-2 text-right">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-forest/10">
            <td className="py-3">{document.lineDescription}</td>
            <td className="py-3 text-right">{formatThb(document.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <dt>มูลค่าสินค้า</dt>
          <dd>{formatThb(document.subtotalExVat)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>ภาษีมูลค่าเพิ่ม 7%</dt>
          <dd>{formatThb(document.vatAmount)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>จำนวนเงินรวม</dt>
          <dd>{formatThb(document.grandTotal)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm">
        จำนวนเงินเป็นตัวอักษร: {document.amountText}
      </p>

      {document.documentType === "deposit_receipt" ? (
        <p className="mt-4 text-xs text-ink/65">
          เอกสารนี้เป็นการรับเงินมัดจำ ไม่ใช่ใบกำกับภาษี
          ใบกำกับภาษีจะออกเมื่อสินค้าเข้าคลังหรือส่งมอบและชำระครบ
        </p>
      ) : null}
      {isReceipt && document.documentType === "receipt" ? (
        <p className="mt-4 text-xs text-ink/65">
          ได้รับเงินไว้เป็นการถูกต้องแล้ว
        </p>
      ) : null}
    </article>
  );
}
