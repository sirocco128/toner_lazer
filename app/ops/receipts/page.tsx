import Link from "next/link";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import { OpsTagField } from "@/components/OpsTagField";
import { EntityTagForm } from "@/components/EntityTagForm";
import { TagChips } from "@/components/TagChips";
import { createCashReceiptAction } from "@/app/actions/ops-cycle";
import { requireOpsPage } from "@/lib/ops-auth";
import { listCashReceipts } from "@/lib/ops-cycle-service";
import { listDistinctOpsTags } from "@/lib/ops-tag-links";
import {
  CASH_LINE_KINDS,
  CASH_LINE_KIND_LABELS,
} from "@/lib/ops-cycle-types";
import { getOrderRepository } from "@/lib/order-repository";
import { promptPayQrDataUrl } from "@/lib/qr-svg";
import { formatThaiDateTime, formatThb } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ ok?: string; orderId?: string }>;

export default async function CashReceiptsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("orders.write");
  const sp = await searchParams;
  const orderId = (sp.orderId || "").trim();
  const order = orderId
    ? getOrderRepository().getOrderByOrderId(orderId)
    : null;
  const openPayments = order
    ? getOrderRepository()
        .listPaymentsByOrder(order.orderId)
        .filter((p) => p.status === "pending" || p.status === "submitted" || p.status === "rejected")
    : [];
  const vouchers = listCashReceipts({ limit: 40 });
  const latest = sp.ok ? vouchers.find((v) => v.voucherId === sp.ok) : null;
  const qr = latest?.qrPayload ? await promptPayQrDataUrl(latest.qrPayload) : null;
  const tagSuggestions = listDistinctOpsTags();

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/cycle" className="text-forest underline-offset-2 hover:underline">
          ← วงจรปฏิบัติการ
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">ฟอร์มรับเงินตามรายการรับ</h1>
      <p className="mt-1 text-sm text-ink/70">
        ออกใบรับเงินเป็นบรรทัด มัดจำ / ส่วนที่เหลือ / อื่น ๆ แล้วสแกน QR พร้อมเพย์
      </p>
      {sp.ok ? (
        <p className="mt-4 rounded-lg bg-forest/10 px-3 py-2 text-sm text-forest">
          บันทึกใบรับเงิน {sp.ok} แล้ว
          {" · "}
          <Link
            href={`/ops/receipts/${encodeURIComponent(sp.ok)}/print`}
            className="underline-offset-2 hover:underline"
          >
            พรีวิว / PDF
          </Link>
        </p>
      ) : null}

      {qr ? (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-forest/15 bg-paper p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR พร้อมเพย์" width={160} height={160} />
          <div className="text-sm">
            <p className="font-semibold text-forest">{latest?.voucherId}</p>
            <p className="mt-1">{formatThb(latest?.totalAmount || 0)}</p>
            <p className="mt-1 text-ink/60">ให้ลูกค้าสแกนแล้วกดยืนยันเมื่อเงินเข้า</p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-forest/15 bg-paper p-5">
        <OpsCycleForm action={createCashReceiptAction} submitLabel="ออกใบรับเงิน + QR">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">ผู้จ่าย</span>
              <input
                name="payerName"
                required
                defaultValue={order?.billingName || order?.company || ""}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">เลขออเดอร์</span>
              <input
                name="orderId"
                defaultValue={orderId}
                className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono"
              />
            </label>
          </div>
          <p className="text-xs font-medium text-forest">รายการรับ</p>
          {[0, 1, 2].map((i) => {
            const pay = openPayments[i];
            return (
              <div key={i} className="grid gap-2 rounded-lg bg-forest-mist/40 p-3 sm:grid-cols-4">
                <select
                  name="kind"
                  defaultValue={pay?.kind || (i === 2 ? "extra" : "deposit")}
                  className="rounded border border-forest/20 px-2 py-2 text-sm"
                >
                  {CASH_LINE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {CASH_LINE_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input
                  name="description"
                  defaultValue={
                    pay
                      ? `${CASH_LINE_KIND_LABELS[pay.kind]} ${pay.paymentId}`
                      : ""
                  }
                  placeholder="คำอธิบาย"
                  className="rounded border border-forest/20 px-2 py-2 text-sm sm:col-span-1"
                />
                <input
                  name="amount"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={pay?.amount || ""}
                  placeholder="0.00"
                  className="rounded border border-forest/20 px-2 py-2 text-sm"
                />
                <input
                  name="paymentId"
                  defaultValue={pay?.paymentId || ""}
                  placeholder="เลขงวด (ถ้ามี)"
                  className="rounded border border-forest/20 px-2 py-2 font-mono text-xs"
                />
                <input type="hidden" name="lineOrderId" defaultValue={orderId} />
              </div>
            );
          })}
          <label className="block text-sm">
            <span className="font-medium">หมายเหตุ</span>
            <input name="notes" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
          <OpsTagField
            suggestions={tagSuggestions}
            label="แท็กใบรับเงิน"
            hint="ติดกับใบรับเงินนี้ เช่น ด่วน, ปีใหม่ — ไม่โชว์บนใบรับเงินที่พิมพ์ให้ลูกค้า"
          />
        </OpsCycleForm>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-forest">ใบรับเงิน</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2">เลขที่</th>
              <th className="px-2 py-2">ผู้จ่าย</th>
              <th className="px-2 py-2">แท็ก</th>
              <th className="px-2 py-2 text-right">ยอด</th>
              <th className="px-2 py-2">สถานะ</th>
              <th className="px-2 py-2">เมื่อ</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {vouchers.map((row) => (
              <tr key={row.voucherId} className="border-b border-forest/10">
                <td className="px-2 py-2 font-mono text-xs">{row.voucherId}</td>
                <td className="px-2 py-2">{row.payerName}</td>
                <td className="px-2 py-2 align-top">
                  <TagChips tags={row.tags} />
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-forest">แก้แท็ก</summary>
                    <div className="mt-2 max-w-xs">
                      <EntityTagForm
                        entityType="voucher"
                        entityId={row.voucherId}
                        tags={row.tags}
                        suggestions={tagSuggestions}
                        label="แท็กใบรับเงิน"
                        hint=""
                        compact
                      />
                    </div>
                  </details>
                </td>
                <td className="px-2 py-2 text-right">{formatThb(row.totalAmount)}</td>
                <td className="px-2 py-2">
                  {row.status === "confirmed"
                    ? "ยืนยันแล้ว"
                    : row.rejectReason
                      ? "บัญชีปฏิเสธ"
                      : "รอเงินเข้า"}
                </td>
                <td className="px-2 py-2 text-ink/70">{formatThaiDateTime(row.createdAt)}</td>
                <td className="px-2 py-2">
                  <Link
                    href={`/ops/receipts/${encodeURIComponent(row.voucherId)}/print`}
                    className="text-sm text-forest underline-offset-2 hover:underline"
                  >
                    พรีวิว / PDF
                  </Link>
                  {row.status === "open" ? (
                    <p className="mt-1">
                      <Link
                        href={`/ops/approvals/rv/${encodeURIComponent(row.voucherId)}`}
                        className="text-sm text-forest underline-offset-2 hover:underline"
                      >
                        ตรวจสลิป / อนุมัติ
                      </Link>
                    </p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
