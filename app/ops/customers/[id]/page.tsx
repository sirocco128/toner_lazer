import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CustomerContactsPanel } from "@/components/CustomerContactsPanel";
import { CustomerMergeForm } from "@/components/CustomerImportForm";
import { CustomerOpsForm } from "@/components/CustomerOpsForm";
import { TagChips } from "@/components/TagChips";
import { isCustomerTaxReady } from "@/lib/customer-billing";
import {
  findPossibleDuplicates,
  getCustomerById,
  listCustomerContacts,
} from "@/lib/customer-repository";
import {
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_TYPE_LABELS,
} from "@/lib/customer-types";
import { isLineOaEnabled } from "@/lib/line-oa";
import { listMockupAssets } from "@/lib/mockup-assets";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listDistinctOpsTags } from "@/lib/ops-tag-links";
import { listQuoteRequests } from "@/lib/quote-repository";
import {
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "@/lib/quote-types";
import { formatThaiDateTime, formatThb } from "@/lib/th-billing";
import { buildCustomerSalesHistory } from "@/lib/customer-sales-history";
import { classifyProductKind, PRODUCT_KIND_LABELS, productLabelFromParts } from "@/lib/product-kind";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export default async function OpsCustomerDetailPage({
  params,
}: {
  params: Params;
}) {
  const actor = await requireOpsPage("customers.read");
  const canWrite = actorMay(actor, "customers.write");
  const canMerge = actorMay(actor, "customers.merge");

  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) notFound();

  const requested = getCustomerById(id);
  if (!requested) notFound();
  if (requested.id !== id) {
    redirect(`/ops/customers/${requested.id}`);
  }
  const customer = requested;

  const quotes = listQuoteRequests({ customerId: customer.id, limit: 50 });
  const sales = buildCustomerSalesHistory(customer.id);
  const contacts = listCustomerContacts(customer.id);
  const duplicates = canMerge ? findPossibleDuplicates(customer) : [];
  const taxReady = isCustomerTaxReady(customer);
  const tagSuggestions = listDistinctOpsTags();

  return (
    <div>
      <p className="text-sm">
        <Link
          href="/ops/customers"
          className="text-forest underline-offset-2 hover:underline"
        >
          ← รายการลูกค้า
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">{customer.company}</h1>
      <p className="mt-1 text-sm text-ink/70">
        {customer.email} · {CUSTOMER_TYPE_LABELS[customer.customerType]} ·{" "}
        {CUSTOMER_SOURCE_LABELS[customer.source]} · คำขอ {customer.quoteCount} ·
        ออเดอร์ {customer.orderCount}
      </p>
      <div className="mt-3">
        <TagChips tags={customer.tags} hrefBase="/ops/customers?tag=" />
      </div>

      {!taxReady ? (
        <p className="mt-4 rounded border border-amber-700/30 bg-amber-50 px-3 py-2 text-sm">
          ข้อมูลออกใบกำกับภาษียังไม่ครบ (เลข 13 หลัก + ที่อยู่ผู้ซื้อ + สาขา)
        </p>
      ) : null}

      {canMerge ? <CustomerMergeForm targetId={customer.id} duplicates={duplicates} /> : null}

      <CustomerOpsForm
        customer={customer}
        readOnly={!canWrite}
        tagSuggestions={tagSuggestions}
      />

      <CustomerContactsPanel
        customerId={customer.id}
        contacts={contacts}
        readOnly={!canWrite}
        lineOaEnabled={isLineOaEnabled()}
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-forest">ประเภทสินค้าที่เคยซื้อ</h2>
        <p className="mt-1 text-sm text-ink/65">
          สรุปจากออเดอร์ที่ยังไม่ยกเลิก — ใช้ตอนคุยงานรอบถัดไปว่าลูกค้าใช้ชุดประเภทใดอยู่แล้ว
        </p>
        {sales.kindsBought.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">ยังไม่มีออเดอร์ที่ซื้อสินค้า</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {sales.kindsBought.map((row) => (
              <li
                key={row.kind}
                className="rounded-xl border border-forest/15 bg-paper px-4 py-3"
              >
                <p className="font-semibold text-forest">{row.label}</p>
                <p className="mt-1 text-sm text-ink/70">
                  {row.orderCount} ออเดอร์ · {row.quantity} ชุด · {formatThb(row.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {sales.inquiredKinds.length > 0 ? (
          <p className="mt-3 text-sm text-ink/60">
            เคยสอบถามแต่ยังไม่เปิดออเดอร์:{" "}
            {sales.inquiredKinds.map((row) => row.label).join(" · ")}
          </p>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-forest">ประวัติใบเสนอราคา</h2>
        <ul className="mt-3 divide-y divide-forest/10 border-t border-forest/10">
          {quotes.length === 0 ? (
            <li className="py-4 text-sm text-ink/60">ยังไม่มีคำขอที่ผูกกับลูกค้านี้</li>
          ) : (
            quotes.map((q) => {
              const assets = listMockupAssets(q.requestId);
              const kind = classifyProductKind({
                productSlug: q.productSlug,
                productInterest: q.productInterest,
              });
              return (
                <li
                  key={q.requestId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <Link
                    href={`/ops/quotes/${q.requestId}`}
                    className="font-mono text-xs text-forest underline-offset-2 hover:underline"
                  >
                    {q.requestId}
                  </Link>
                  <span className="min-w-[10rem] text-ink/80">
                    {productLabelFromParts({
                      productSlug: q.productSlug,
                      productInterest: q.productInterest,
                    })}
                  </span>
                  <span className="rounded-full bg-forest-mist px-2 py-0.5 text-xs text-forest">
                    {PRODUCT_KIND_LABELS[kind]}
                  </span>
                  <span>
                    {LEAD_STATUS_LABELS[q.leadStatus as LeadStatus] || q.leadStatus}
                  </span>
                  <span className="text-ink/65">{q.quantity} ชุด</span>
                  {assets.length ? (
                    <span className="text-xs text-forest">มีไฟล์แบบ {assets.length}</span>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-forest">ประวัติการขาย</h2>
        {sales.orders.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">ยังไม่มีออเดอร์</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-forest/15 text-forest">
                  <th className="px-2 py-2 font-semibold">ออเดอร์</th>
                  <th className="px-2 py-2 font-semibold">สินค้า</th>
                  <th className="px-2 py-2 font-semibold">ประเภท</th>
                  <th className="px-2 py-2 font-semibold">จำนวน</th>
                  <th className="px-2 py-2 font-semibold">ยอด</th>
                  <th className="px-2 py-2 font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {sales.orders.map((row) => (
                  <tr key={row.order.orderId} className="border-b border-forest/10">
                    <td className="px-2 py-2.5">
                      <Link
                        href={`/ops/orders/${row.order.orderId}`}
                        className="font-mono text-xs text-forest underline-offset-2 hover:underline"
                      >
                        {row.order.orderId}
                      </Link>
                      <p className="text-xs text-ink/50">
                        {formatThaiDateTime(row.order.createdAt)}
                      </p>
                    </td>
                    <td className="px-2 py-2.5">
                      {row.productLabel}
                      {row.decorationLabel ? (
                        <p className="text-xs text-ink/55">โลโก้: {row.decorationLabel}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="rounded-full bg-forest-mist px-2 py-0.5 text-xs text-forest">
                        {row.kindLabel}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">{row.order.quantity} ชุด</td>
                    <td className="px-2 py-2.5">{formatThb(row.order.totalAmount)}</td>
                    <td className="px-2 py-2.5">
                      {row.paymentLabel}
                      <p className="text-xs text-ink/55">{row.fulfillmentLabel}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
