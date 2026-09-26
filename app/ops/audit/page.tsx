import { OpsPager } from "@/components/OpsPager";
import { OpsAuditTable } from "@/components/OpsAuditTable";
import { requireOpsPage } from "@/lib/ops-auth";
import {
  countOpsAudit,
  listOpsAudit,
  listOpsAuditActionOptions,
  listOpsAuditActorOptions,
  listOpsAuditReportOptions,
  opsAuditFilterParams,
  parseOpsAuditSearch,
} from "@/lib/ops-audit";
import { opsAuditActionLabel } from "@/lib/ops-audit-labels";
import {
  OPS_LIST_PAGE_SIZE,
  opsPageHref,
  opsPageWindow,
  parseOpsPage,
} from "@/lib/ops-pagination";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{
  q?: string;
  action?: string;
  user?: string;
  status?: string;
  from?: string;
  to?: string;
  report?: string;
  page?: string;
}>;

export default async function OpsAuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireOpsPage("audit.read");
  const sp = await searchParams;
  const query = parseOpsAuditSearch(sp);
  const total = countOpsAudit(query);
  const pageWindow = opsPageWindow(total, parseOpsPage(sp.page), OPS_LIST_PAGE_SIZE);
  const rows = listOpsAudit({
    ...query,
    limit: pageWindow.pageSize,
    offset: pageWindow.offset,
  });
  const actors = listOpsAuditActorOptions();
  const actions = listOpsAuditActionOptions();
  const reports = listOpsAuditReportOptions();
  const filterParams = opsAuditFilterParams(query);
  const exportHref = opsPageHref("/ops/audit/export", filterParams, 1);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest">บันทึกการใช้งาน</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/70">
            ใครเข้าคอนโซล จากที่ไหน เครื่องไหน แก้หรืออนุมัติอะไร กระทบรายการไหน
            และดึงรายงานช่วงวันที่ / ตัวกรองใด — รหัสลับถูกปิดก่อนบันทึก
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex min-h-11 items-center rounded border border-forest/30 px-4 py-2 text-sm text-forest"
        >
          ส่งออก CSV ตามตัวกรอง
        </a>
      </div>

      <form
        className="mt-6 grid gap-3 rounded-lg border border-forest/15 bg-paper p-4 sm:grid-cols-2 lg:grid-cols-4"
        method="get"
      >
        <label className="text-sm sm:col-span-2">
          <span className="block text-xs text-ink/55">ค้นหา</span>
          <input
            name="q"
            defaultValue={query.q || ""}
            placeholder="ผู้ใช้ / การกระทำ / IP / รหัสรายการ / รายงาน"
            className="mt-1 w-full rounded border border-forest/20 bg-paper px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink/55">ตั้งแต่</span>
          <input
            type="date"
            name="from"
            defaultValue={query.fromDate || ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink/55">ถึง</span>
          <input
            type="date"
            name="to"
            defaultValue={query.toDate || ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink/55">ผู้ใช้</span>
          <select
            name="user"
            defaultValue={query.actorEmail || ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          >
            <option value="">ทุกคน</option>
            {actors.map((actor) => (
              <option key={actor.email} value={actor.email}>
                {actor.name ? `${actor.name} (${actor.email})` : actor.email}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink/55">การกระทำ</span>
          <select
            name="action"
            defaultValue={query.action || ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          >
            <option value="">ทั้งหมด</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {opsAuditActionLabel(action)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink/55">สถานะ</span>
          <select
            name="status"
            defaultValue={query.status === "ok" || query.status === "denied" ? query.status : ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          >
            <option value="">ทั้งหมด</option>
            <option value="ok">สำเร็จ</option>
            <option value="denied">ปฏิเสธ</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-ink/55">รายงานที่ดึง</span>
          <select
            name="report"
            defaultValue={query.reportName || ""}
            className="mt-1 w-full rounded border border-forest/20 px-3 py-2 text-sm"
          >
            <option value="">ทุกรายงาน</option>
            {reports.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="min-h-11 rounded bg-forest px-4 py-2 text-sm text-paper"
          >
            กรองบันทึก
          </button>
          <a
            href="/ops/audit"
            className="inline-flex min-h-11 items-center rounded border border-forest/20 px-4 py-2 text-sm text-forest"
          >
            ล้างตัวกรอง
          </a>
        </div>
      </form>

      <p className="mt-4 text-sm text-ink/65">พบ {total} รายการ</p>
      <div className="mt-3">
        <OpsAuditTable rows={rows} />
      </div>
      <OpsPager pathname="/ops/audit" params={filterParams} window={pageWindow} />
    </div>
  );
}
