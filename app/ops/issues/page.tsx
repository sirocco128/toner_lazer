import Link from "next/link";
import { OpsCycleForm } from "@/components/OpsCycleForm";
import {
  claimFromIssueAction,
  createOpsIssueAction,
  setIssueStatusAction,
} from "@/app/actions/ops-cycle";
import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { getClaimByIssueId, listIssues } from "@/lib/ops-cycle-service";
import {
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_LABELS,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
} from "@/lib/ops-cycle-types";
import { formatThaiDateTime } from "@/lib/th-billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ ok?: string }>;

export default async function OpsIssuesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireOpsPage("orders.read");
  const canWrite = actorMay(actor, "orders.write");
  const canClaim = actorMay(actor, "factory.write");
  const sp = await searchParams;
  const rows = listIssues(80);
  const claimsByIssue = new Map(
    rows.map((row) => [row.issueId, getClaimByIssueId(row.issueId)] as const),
  );

  return (
    <div>
      <p className="text-sm">
        <Link href="/ops/cycle" className="text-forest underline-offset-2 hover:underline">
          ← วงจรปฏิบัติการ
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">รับแจ้งปัญหา</h1>
      <p className="mt-1 text-sm text-ink/70">
        เรื่องจากหน้าเว็บสาธารณะ <Link href="/issues" className="underline-offset-2 hover:underline">/issues</Link>{" "}
        และที่เซลล์รับโทรศัพท์
      </p>
      {sp.ok ? (
        <p className="mt-4 rounded-lg bg-forest/10 px-3 py-2 text-sm text-forest">
          บันทึก {sp.ok} แล้ว
        </p>
      ) : null}

      {canWrite ? (
        <div className="mt-6 rounded-xl border border-forest/15 bg-paper p-5">
          <OpsCycleForm action={createOpsIssueAction} submitLabel="เปิดเรื่อง">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">บริษัท</span>
              <input name="company" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">ผู้ติดต่อ</span>
              <input name="contactName" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">อีเมล</span>
              <input name="email" type="email" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">โทร</span>
              <input name="phone" className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">เลขออเดอร์</span>
              <input name="orderId" className="mt-1 w-full rounded border border-forest/20 px-3 py-2 font-mono" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">ประเภท</span>
              <select name="category" defaultValue="other" className="mt-1 w-full rounded border border-forest/20 px-3 py-2">
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {ISSUE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium">หัวข้อ</span>
            <input name="title" required className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">รายละเอียด</span>
            <textarea name="detail" required rows={3} className="mt-1 w-full rounded border border-forest/20 px-3 py-2" />
          </label>
        </OpsCycleForm>
        </div>
      ) : null}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-forest/15 text-forest">
              <th className="px-2 py-2">เลขเรื่อง</th>
              <th className="px-2 py-2">แหล่ง</th>
              <th className="px-2 py-2">หัวข้อ</th>
              <th className="px-2 py-2">สถานะ</th>
              <th className="px-2 py-2">เคลม</th>
              <th className="px-2 py-2">เมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.issueId} className="border-b border-forest/10 align-top">
                <td className="px-2 py-2 font-mono text-xs">{row.issueId}</td>
                <td className="px-2 py-2">{row.source === "public" ? "เว็บ" : "ภายใน"}</td>
                <td className="px-2 py-2">
                  <p className="font-medium">{row.title}</p>
                  <p className="mt-1 text-xs text-ink/60">
                    {ISSUE_CATEGORY_LABELS[row.category]}
                    {row.company ? ` · ${row.company}` : ""}
                    {row.orderId ? ` · ${row.orderId}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-ink/75">{row.detail}</p>
                </td>
                <td className="px-2 py-2">
                  <form action={setIssueStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="issueId" value={row.issueId} />
                    <select
                      name="status"
                      defaultValue={row.status}
                      className="rounded border border-forest/20 px-2 py-1 text-xs"
                    >
                      {ISSUE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {ISSUE_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="text-xs text-forest underline-offset-2 hover:underline">
                      บันทึก
                    </button>
                  </form>
                </td>
                <td className="px-2 py-2">
                  {(() => {
                    const linked = claimsByIssue.get(row.issueId);
                    if (linked) {
                      return (
                        <Link
                          href={`/ops/claims?ok=${encodeURIComponent(linked.claimId)}`}
                          className="font-mono text-xs text-forest underline-offset-2 hover:underline"
                        >
                          {linked.claimId}
                        </Link>
                      );
                    }
                    if (canClaim) {
                      return (
                        <form action={claimFromIssueAction}>
                          <input type="hidden" name="issueId" value={row.issueId} />
                          <button
                            type="submit"
                            className="text-xs text-forest underline-offset-2 hover:underline"
                          >
                            เปิดเคลมจากเรื่องนี้
                          </button>
                        </form>
                      );
                    }
                    return <span className="text-xs text-ink/45">—</span>;
                  })()}
                </td>
                <td className="px-2 py-2 text-ink/70">{formatThaiDateTime(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
