import Link from "next/link";
import { setContactInquiryStatusAction } from "@/app/actions/ops-inquiries";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { OpsPager } from "@/components/OpsPager";
import {
  OPS_LIST_PAGE_SIZE,
  opsPageWindow,
  parseOpsPage,
} from "@/lib/ops-pagination";
import {
  countContactInquiries,
  listContactInquiries,
} from "@/lib/contact-inquiry-repository";
import {
  CONTACT_CALLBACK_LABELS,
  CONTACT_INQUIRY_STATUSES,
  CONTACT_INQUIRY_STATUS_LABELS,
  CONTACT_MAIL_STATUS_LABELS,
  CONTACT_TOPICS,
  CONTACT_TOPIC_LABELS,
  contactMailErrorLabel,
  type ContactInquiryStatus,
  type ContactTopic,
} from "@/lib/contact-inquiry-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  topic?: string;
  page?: string;
}>;

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

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

export default async function OpsInquiriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOpsPage("quotes.read");
  const canWrite = actorMay(actor, "quotes.write");
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const statusRaw = (sp.status || "all").trim();
  const topicRaw = (sp.topic || "all").trim();
  const status =
    statusRaw === "all" ||
    (CONTACT_INQUIRY_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as ContactInquiryStatus | "all")
      : "all";
  const topic =
    topicRaw === "all" || (CONTACT_TOPICS as readonly string[]).includes(topicRaw)
      ? (topicRaw as ContactTopic | "all")
      : "all";

  const total = countContactInquiries({ q, status, topic });
  const pageWindow = opsPageWindow(total, parseOpsPage(sp.page), OPS_LIST_PAGE_SIZE);
  const rows = listContactInquiries({
    q,
    status,
    topic,
    limit: pageWindow.pageSize,
    offset: pageWindow.offset,
  });
  const filterParams = {
    q,
    status: status === "all" ? undefined : status,
    topic: topic === "all" ? undefined : topic,
  };
  const filteredEmpty = rows.length === 0 && (q || status !== "all" || topic !== "all");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest">ข้อความติดต่อ</h1>
          <p className="mt-1 text-sm text-ink/70">
            เรื่องจากหน้าเว็บติดต่อ สอบถาม ร้องเรียน — ไม่ใช่ใบเสนอราคา · พบ {total} รายการ
          </p>
        </div>
        <Link
          href="/contact?intent=message"
          className="inline-flex min-h-11 items-center rounded-full border border-forest/20 px-4 text-sm font-semibold text-forest"
        >
          เปิดแบบฟอร์มลูกค้า
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นหา ชื่อ / อีเมล / เลขเรื่อง"
          className="min-w-[220px] flex-1 rounded border border-forest/20 bg-paper px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-forest/20 bg-paper px-3 py-2 text-sm"
        >
          <option value="all">ทุกสถานะ</option>
          {CONTACT_INQUIRY_STATUSES.map((item) => (
            <option key={item} value={item}>
              {CONTACT_INQUIRY_STATUS_LABELS[item]}
            </option>
          ))}
        </select>
        <select
          name="topic"
          defaultValue={topic}
          className="rounded border border-forest/20 bg-paper px-3 py-2 text-sm"
        >
          <option value="all">ทุกหัวข้อ</option>
          {CONTACT_TOPICS.map((item) => (
            <option key={item} value={item}>
              {CONTACT_TOPIC_LABELS[item]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-paper"
        >
          กรอง
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-forest/10 px-4 py-8 text-center text-sm text-ink/60">
          {filteredEmpty
            ? "ไม่พบข้อความที่ตรงตัวกรอง"
            : "ยังไม่มีข้อความ — ลูกค้าส่งจากหน้าติดต่อ / สอบถาม / ร้องเรียน"}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((row) => {
            const phoneLink = telHref(row.phone);
            const mailHint = contactMailErrorLabel(row.mailError);
            return (
              <li
                key={row.inquiryId}
                className="rounded-xl border border-forest/15 bg-paper p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-forest">
                      {row.inquiryId}
                    </p>
                    <p className="mt-1 text-sm text-ink">
                      {row.name}
                      {row.company ? ` · ${row.company}` : ""} ·{" "}
                      {CONTACT_TOPIC_LABELS[row.topic]}
                    </p>
                    <p className="mt-1 text-sm text-ink/70">
                      <a
                        href={`mailto:${row.email}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {row.email}
                      </a>
                      {" · "}
                      {phoneLink ? (
                        <a href={phoneLink} className="underline-offset-2 hover:underline">
                          {row.phone}
                        </a>
                      ) : (
                        row.phone
                      )}
                      {" · ติดต่อกลับ "}
                      {CONTACT_CALLBACK_LABELS[row.callbackChannel]}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink/85">
                      {row.message}
                    </p>
                    <p className="mt-2 text-xs text-ink/55">
                      {formatWhen(row.submittedAt)} · จดหมายตอบรับ{" "}
                      {CONTACT_MAIL_STATUS_LABELS[row.mailStatus]}
                      {mailHint ? ` — ${mailHint}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-medium text-forest">
                    {CONTACT_INQUIRY_STATUS_LABELS[row.status]}
                  </span>
                </div>
                {canWrite ? (
                  <form action={setContactInquiryStatusAction} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="inquiryId" value={row.inquiryId} />
                    {CONTACT_INQUIRY_STATUSES.filter((item) => item !== row.status).map(
                      (item) => (
                        <button
                          key={item}
                          type="submit"
                          name="status"
                          value={item}
                          className="rounded-full border border-forest/20 px-3 py-1 text-xs font-medium text-forest"
                        >
                          ตั้งเป็น {CONTACT_INQUIRY_STATUS_LABELS[item]}
                        </button>
                      ),
                    )}
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6">
        <OpsPager pathname="/ops/inquiries" params={filterParams} window={pageWindow} />
      </div>
    </div>
  );
}
