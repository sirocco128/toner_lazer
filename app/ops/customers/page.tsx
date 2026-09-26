import Link from "next/link";
import {
  countCustomers,
  listCustomers,
} from "@/lib/customer-repository";
import { isCustomerTaxReady } from "@/lib/customer-billing";
import type { CustomerSource, CustomerStatus, CustomerType } from "@/lib/customer-types";
import {
  CUSTOMER_SOURCES,
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
} from "@/lib/customer-types";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import {
  PRODUCT_KINDS,
  PRODUCT_KIND_LABELS,
  type ProductKind,
} from "@/lib/product-kind";
import { purchaseKindLabelsForCustomers } from "@/lib/customer-sales-history";
import { listDistinctOpsTags } from "@/lib/ops-tag-links";
import { TagChips } from "@/components/TagChips";
import { OpsPager } from "@/components/OpsPager";
import {
  OPS_LIST_PAGE_SIZE,
  opsPageWindow,
  parseOpsPage,
} from "@/lib/ops-pagination";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  type?: string;
  source?: string;
  tag?: string;
  tax?: string;
  province?: string;
  orders?: string;
  kind?: string;
  page?: string;
}>;

export default async function OpsCustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOpsPage("customers.read");
  const canWrite = actorMay(actor, "customers.write");
  const canImport = actorMay(actor, "customers.import");

  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const statusRaw = (sp.status || "all").trim();
  const status =
    statusRaw === "all" ||
    (CUSTOMER_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as CustomerStatus | "all")
      : "all";
  const typeRaw = (sp.type || "all").trim();
  const customerType =
    typeRaw === "all" || (CUSTOMER_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as CustomerType | "all")
      : "all";
  const sourceRaw = (sp.source || "all").trim();
  const source =
    sourceRaw === "all" ||
    (CUSTOMER_SOURCES as readonly string[]).includes(sourceRaw)
      ? (sourceRaw as CustomerSource | "all")
      : "all";
  const taxReady: "all" | "ready" | "missing" =
    sp.tax === "ready" || sp.tax === "missing" ? sp.tax : "all";
  const hasOrders: "all" | "yes" | "no" =
    sp.orders === "yes" || sp.orders === "no" ? sp.orders : "all";
  const kindRaw = (sp.kind || "all").trim();
  const kindFilter: ProductKind | "all" =
    kindRaw === "all" || (PRODUCT_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as ProductKind | "all")
      : "all";
  const tag = (sp.tag || "").trim();
  const province = (sp.province || "").trim();

  const filters = {
    q,
    status,
    customerType,
    source,
    tag,
    taxReady,
    province,
    hasOrders,
  };
  const kindLabelFilter =
    kindFilter === "all" ? null : PRODUCT_KIND_LABELS[kindFilter];
  const requestedPage = parseOpsPage(sp.page);

  let customers;
  let total: number;
  let pageWindow;
  if (kindLabelFilter) {
    const customersAll = listCustomers({ ...filters, limit: 500, offset: 0 });
    const kindLabels = purchaseKindLabelsForCustomers(customersAll.map((c) => c.id));
    const filtered = customersAll.filter((c) =>
      (kindLabels.get(c.id) || []).includes(kindLabelFilter),
    );
    total = filtered.length;
    pageWindow = opsPageWindow(total, requestedPage, OPS_LIST_PAGE_SIZE);
    customers = filtered.slice(pageWindow.offset, pageWindow.offset + pageWindow.pageSize);
  } else {
    total = countCustomers(filters);
    pageWindow = opsPageWindow(total, requestedPage, OPS_LIST_PAGE_SIZE);
    customers = listCustomers({
      ...filters,
      limit: pageWindow.pageSize,
      offset: pageWindow.offset,
    });
  }
  const kindLabels = purchaseKindLabelsForCustomers(customers.map((c) => c.id));
  const filterParams = {
    q,
    status: status === "all" ? undefined : status,
    type: typeRaw === "all" ? undefined : typeRaw,
    source: sourceRaw === "all" ? undefined : sourceRaw,
    tag: tag || undefined,
    tax: taxReady === "all" ? undefined : taxReady,
    province: province || undefined,
    orders: hasOrders === "all" ? undefined : hasOrders,
    kind: kindFilter === "all" ? undefined : kindFilter,
  };
  const knownTags = listDistinctOpsTags();
  const exportQs = new URLSearchParams(
    Object.entries({
      q,
      status,
      type: typeRaw,
      source: sourceRaw,
      tag,
      tax: taxReady,
      province,
      orders: hasOrders,
      kind: kindFilter,
    }).filter(([, v]) => v && v !== "all") as [string, string][],
  ).toString();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest">ลูกค้า</h1>
          <p className="mt-1 text-sm text-ink/70">
            พบ {total} รายการ — เปิดการ์ดลูกค้าเพื่อดูประเภทสินค้าที่เคยซื้อ
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {canWrite ? (
            <Link
              href="/ops/customers/new"
              className="rounded bg-forest px-4 py-2 font-medium text-paper"
            >
              เพิ่มลูกค้า
            </Link>
          ) : null}
          {canImport ? (
            <Link
              href="/ops/customers/import"
              className="rounded border border-forest px-4 py-2 text-forest"
            >
              นำเข้า CSV
            </Link>
          ) : null}
          <Link
            href={`/ops/customers/export${exportQs ? `?${exportQs}` : ""}`}
            className="rounded border border-forest/30 px-4 py-2"
          >
            ส่งออก
          </Link>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นหา บริษัท / อีเมล / ไลน์ / เลขผู้เสียภาษี"
          className="min-w-[220px] flex-1 rounded border border-forest/20 bg-paper px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={status} className="rounded border border-forest/20 bg-paper px-3 py-2 text-sm">
          <option value="all">ทุกสถานะ</option>
          <option value="active">ใช้งาน</option>
          <option value="inactive">ปิดใช้งาน</option>
        </select>
        <select name="type" defaultValue={customerType} className="rounded border border-forest/20 bg-paper px-3 py-2 text-sm">
          <option value="all">ทุกประเภท</option>
          {CUSTOMER_TYPES.map((t) => (
            <option key={t} value={t}>{CUSTOMER_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select name="source" defaultValue={source} className="rounded border border-forest/20 bg-paper px-3 py-2 text-sm">
          <option value="all">ทุกที่มา</option>
          {CUSTOMER_SOURCES.map((s) => (
            <option key={s} value={s}>{CUSTOMER_SOURCE_LABELS[s]}</option>
          ))}
        </select>
        <select name="tax" defaultValue={taxReady} className="rounded border border-forest/20 bg-paper px-3 py-2 text-sm">
          <option value="all">ภาษีทั้งหมด</option>
          <option value="ready">ภาษีครบ</option>
          <option value="missing">ภาษียังไม่ครบ</option>
        </select>
        <select name="kind" defaultValue={kindFilter} className="rounded border border-forest/20 bg-paper px-3 py-2 text-sm">
          <option value="all">ทุกประเภทสินค้า</option>
          {PRODUCT_KINDS.map((k) => (
            <option key={k} value={k}>{PRODUCT_KIND_LABELS[k]}</option>
          ))}
        </select>
        <select name="orders" defaultValue={hasOrders} className="rounded border border-forest/20 bg-paper px-3 py-2 text-sm">
          <option value="all">ทุกออเดอร์</option>
          <option value="yes">มีออเดอร์</option>
          <option value="no">ยังไม่มีออเดอร์</option>
        </select>
        <input
          name="province"
          defaultValue={province}
          placeholder="จังหวัดจัดส่ง"
          className="w-36 rounded border border-forest/20 bg-paper px-3 py-2 text-sm"
        />
        <input
          name="tag"
          defaultValue={tag}
          list="ops-customer-tags"
          placeholder="แท็ก"
          className="w-28 rounded border border-forest/20 bg-paper px-3 py-2 text-sm"
        />
        <datalist id="ops-customer-tags">
          {knownTags.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <button type="submit" className="rounded bg-forest px-4 py-2 text-sm font-medium text-paper">
          กรอง
        </button>
      </form>

      <div className="mt-6 space-y-3 md:hidden">
        {customers.length === 0 ? (
          <p className="rounded-xl border border-forest/10 px-4 py-8 text-center text-sm text-ink/60">
            ยังไม่มีลูกค้า — ส่งคำขอที่แบบฟอร์มติดต่อ หรือกดเพิ่มลูกค้า
          </p>
        ) : (
          customers.map((c) => (
            <article key={c.id} className="rounded-xl border border-forest/10 p-4">
              <Link
                href={`/ops/customers/${c.id}`}
                className="font-medium text-forest underline-offset-2 hover:underline"
              >
                {c.company}
              </Link>
              <p className="mt-1 text-xs text-ink/55">{c.email}</p>
              <p className="mt-2 text-sm text-ink/75">
                {c.contactName || "—"} · {CUSTOMER_TYPE_LABELS[c.customerType]}
              </p>
              <p className="mt-1 text-xs text-ink/55">
                คำขอ {c.quoteCount} · ออเดอร์ {c.orderCount} · ภาษี{" "}
                {isCustomerTaxReady(c) ? "ครบ" : "ยังไม่ครบ"}
              </p>
            </article>
          ))
        )}
      </div>

      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2 font-semibold">บริษัท</th>
              <th className="px-2 py-2 font-semibold">ผู้ติดต่อ</th>
              <th className="px-2 py-2 font-semibold">กลุ่ม</th>
              <th className="px-2 py-2 font-semibold">แท็ก</th>
              <th className="px-2 py-2 font-semibold">คำขอ</th>
              <th className="px-2 py-2 font-semibold">ออเดอร์</th>
              <th className="px-2 py-2 font-semibold">เคยซื้อ</th>
              <th className="px-2 py-2 font-semibold">ภาษี</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-8 text-center text-ink/60">
                  ยังไม่มีลูกค้า — ส่งคำขอที่แบบฟอร์มติดต่อ หรือกดเพิ่มลูกค้า
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b border-forest/10 hover:bg-paper/80">
                  <td className="px-2 py-2.5">
                    <Link
                      href={`/ops/customers/${c.id}`}
                      className="font-medium text-forest underline-offset-2 hover:underline"
                    >
                      {c.company}
                    </Link>
                    <p className="text-xs text-ink/55">{c.email}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    {c.contactName || "—"}
                    {c.lineId ? <p className="text-xs text-ink/55">ไลน์ {c.lineId}</p> : null}
                  </td>
                  <td className="px-2 py-2.5 text-xs">
                    {CUSTOMER_TYPE_LABELS[c.customerType]}
                    <br />
                    {CUSTOMER_SOURCE_LABELS[c.source]}
                  </td>
                  <td className="px-2 py-2.5">
                    <TagChips tags={c.tags} hrefBase="/ops/customers?tag=" />
                  </td>
                  <td className="px-2 py-2.5">{c.quoteCount}</td>
                  <td className="px-2 py-2.5">{c.orderCount}</td>
                  <td className="px-2 py-2.5 text-xs text-ink/75">
                    {(kindLabels.get(c.id) || []).join(" · ") || "—"}
                  </td>
                  <td className="px-2 py-2.5">
                    {isCustomerTaxReady(c) ? "ครบ" : "ยังไม่ครบ"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {customers.length > 0 ? (
        <OpsPager pathname="/ops/customers" params={filterParams} window={pageWindow} />
      ) : null}
    </div>
  );
}
