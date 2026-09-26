import Link from "next/link";
import { BoardStatusRulesNote } from "@/components/BoardStatusRulesNote";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import {
  countQuoteRequests,
  listQuoteRequests,
} from "@/lib/quote-repository";
import { countApprovalQueue } from "@/lib/payment-approval";
import { countInboundPos } from "@/lib/factory-po-queries";
import { getStrapiAdminUrl } from "@/lib/strapi-url";
import {
  formatCampaignSourceLabel,
  isSmartgiftWebLead,
} from "@/lib/attribution";
import { LEAD_STATUS_LABELS } from "@/lib/quote-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function OpsIndexPage() {
  const actor = await requireOpsPage();
  const canQuotes = actorMay(actor, "quotes.read");
  const newQuotes = canQuotes ? countQuoteRequests({ leadStatus: "new" }) : 0;
  const approvals = actorMay(actor, "orders.read") ? countApprovalQueue() : 0;
  const inbound = actorMay(actor, "factory.read") ? countInboundPos() : 0;
  const recentNew = canQuotes
    ? listQuoteRequests({ leadStatus: "new", limit: 6, offset: 0 })
    : [];

  const cards = [
    canQuotes
      ? {
          href: "/ops/quotes?status=new",
          title: "คำขอใหม่",
          count: newQuotes,
          body: "ใบเสนอราคาที่ยังไม่ได้ติดต่อ — รวมจากเว็บ Smart Gift",
          hot: newQuotes > 0,
        }
      : null,
    canQuotes
      ? {
          href: "/ops/pricing",
          title: "คิดราคา",
          count: "—",
          body: "บันไดจำนวนตามสูตรราคาบนเว็บ",
          hot: false,
        }
      : null,
    actorMay(actor, "orders.read")
      ? {
          href: "/ops/approvals",
          title: "รออนุมัติยอด",
          count: approvals,
          body: "สลิปที่บัญชีต้องตรวจ",
          hot: approvals > 0,
        }
      : null,
    actorMay(actor, "factory.read")
      ? {
          href: actorMay(actor, "factory.write")
            ? "/ops/inbound"
            : "/ops/factory-po",
          title: "ค้างรับของ",
          count: inbound,
          body: "ใบสั่งโรงงานที่ยังรับไม่ครบ",
          hot: inbound > 0,
        }
      : null,
    actorMay(actor, "reports.read")
      ? {
          href: "/ops/reports",
          title: "รายงานวงจร",
          count: "—",
          body: "คำขอถึงรับเงิน — ทุกขั้น ตามสิทธิ์บัญชีนี้",
          hot: false,
        }
      : null,
  ].filter((card) => card !== null);

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">ภาพรวมงานวันนี้</h1>
      <p className="mt-1 text-sm text-ink/70">
        คิวที่ต้องเคลียร์ก่อน — เปิดรายการจากบัตรหรือตารางด้านล่าง
      </p>
      <div className="mt-4 max-w-2xl">
        <BoardStatusRulesNote compact />
        <p className="mt-2 text-sm">
          <Link href="/ops/board" className="text-brass hover:underline">
            เปิดบอร์ดงานและกติกาครบ →
          </Link>
        </p>
      </div>
      {cards.length ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.href}>
              <Link
                href={card.href}
                className={`block rounded-xl border bg-paper p-5 transition hover:border-brass/50 ${
                  card.hot
                    ? "border-brass/60 shadow-sm ring-1 ring-brass/20"
                    : "border-forest/15"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-ink/65">{card.title}</p>
                  {card.hot ? (
                    <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[11px] font-semibold text-forest">
                      ต้องทำ
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-3xl font-bold text-forest">{card.count}</p>
                <p className="mt-2 text-sm text-ink/70">{card.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-ink/70">ยังไม่มีคิวที่บัญชีนี้ดูได้</p>
      )}

      {canQuotes ? (
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-forest">
                คำขอใหม่ล่าสุด
              </h2>
              <p className="mt-1 text-sm text-ink/70">
                จากเว็บสาธารณะและแบบฟอร์ม — ติดต่อเร็วจะปิดดีลได้ง่ายขึ้น
              </p>
            </div>
            <Link
              href="/ops/quotes?status=new"
              className="text-sm text-brass hover:underline"
            >
              ดูทั้งหมด →
            </Link>
          </div>
          {recentNew.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-forest/20 px-4 py-6 text-center text-sm text-ink/60">
              ยังไม่มีคำขอสถานะใหม่ — เมื่อลูกค้าส่งคำขอจากเว็บ Smart Gift
              จะโผล่ที่นี่
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-forest/10 overflow-hidden rounded-xl border border-forest/15 bg-paper">
              {recentNew.map((row) => {
                const fromSmg = isSmartgiftWebLead(row);
                return (
                  <li key={row.requestId}>
                    <Link
                      href={`/ops/quotes/${row.requestId}`}
                      className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 hover:bg-forest-mist/30"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-forest">
                            {row.requestId}
                          </span>
                          {fromSmg ? (
                            <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-medium text-forest">
                              Smart Gift
                            </span>
                          ) : null}
                          <span className="text-[11px] text-ink/55">
                            {LEAD_STATUS_LABELS[row.leadStatus] || row.leadStatus}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-medium text-ink">
                          {row.company} · {row.name}
                        </p>
                        <p className="text-xs text-ink/60">
                          {formatCampaignSourceLabel(row)} · จำนวน {row.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-ink/55">
                        {formatWhen(row.createdAt)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {actorMay(actor, "catalog.write") ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-forest">แคตตาล็อกและรูป</h2>
          <p className="mt-1 text-sm text-ink/70">
            จัดการสินค้า/ราคาในคอนโซล — รูปสาธารณะอยู่ที่ MinIO{" "}
            <code className="rounded bg-forest/5 px-1 text-xs">
              terabis-public/images/
            </code>
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link
              href="/ops/products"
              className="block rounded-xl border border-forest/15 bg-paper p-5 hover:border-brass/50"
            >
              <p className="font-semibold text-forest">สินค้า A/B/C/D</p>
              <p className="mt-2 text-sm text-ink/70">
                อัปโหลดรูปปกและไฟล์ SKU ในหน้ารหัสขาย
              </p>
            </Link>
            <a
              href={getStrapiAdminUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-forest/15 bg-paper p-5 hover:border-brass/50"
            >
              <p className="font-semibold text-forest">เข้า Strapi</p>
              <p className="mt-2 text-sm text-ink/70">
                เปิดแอดมินแคตตาล็อก (สินค้า หมวด รูป CMS)
              </p>
            </a>
            <Link
              href="/ops/catalog-books"
              className="block rounded-xl border border-forest/15 bg-paper p-5 hover:border-brass/50"
            >
              <p className="font-semibold text-forest">สร้างสมุดแคตตาล็อก</p>
              <p className="mt-2 text-sm text-ink/70">
                จัดไฟล์เป็นอัลบั้มพลิกพร้อมลิงก์ส่งลูกค้า
              </p>
            </Link>
            <Link
              href="/ops/catalog-images"
              className="block rounded-xl border border-forest/15 bg-paper p-5 hover:border-brass/50"
            >
              <p className="font-semibold text-forest">รูปโรงงาน</p>
              <p className="mt-2 text-sm text-ink/70">
                ค้นรูปจากเว็บโรงงาน แล้วนำไปใส่ใน Strapi ทีหลัง
              </p>
            </Link>
            <Link
              href="/ops/pricing/import"
              className="block rounded-xl border border-forest/15 bg-paper p-5 hover:border-brass/50"
            >
              <p className="font-semibold text-forest">อัปเดตราคาจาก Excel</p>
              <p className="mt-2 text-sm text-ink/70">
                พรีวิวทั้งตาราง แล้วค่อยอัปเดตราคาขาย
              </p>
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
