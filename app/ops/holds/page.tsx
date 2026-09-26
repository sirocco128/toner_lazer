import { actorMay, requireOpsPage } from "@/lib/ops-auth";
import { listLegalHolds } from "@/lib/object-legal-hold";
import { LegalHoldForms } from "@/components/LegalHoldForms";

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

export default async function OpsHoldsPage() {
  const actor = await requireOpsPage("documents.hold");
  const holds = listLegalHolds({ activeOnly: true, limit: 200 });

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest">พักลบเอกสาร</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/70">
        Legal hold ตาม ISO 15489 / PDPA — เอกสารที่พักไว้ลบไม่ได้จนกว่าผู้ดูแลคนอื่นจะปลด
        ถังบัญชี/สลิปยังมี Object Lock อายุเก็บตาม MINIO_RETENTION_DAYS
      </p>

      <LegalHoldForms canRelease={actorMay(actor, "documents.hold.release")} />

      <h2 className="mt-10 font-semibold text-forest">ที่ยังพักอยู่</h2>
      {holds.length === 0 ? (
        <p className="mt-2 text-sm text-ink/60">ยังไม่มีรายการ</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-forest/15 text-forest">
                <th className="px-2 py-2">เมื่อ</th>
                <th className="px-2 py-2">ไฟล์</th>
                <th className="px-2 py-2">เหตุผล</th>
                <th className="px-2 py-2">ผู้พัก</th>
              </tr>
            </thead>
            <tbody>
              {holds.map((row) => (
                <tr key={row.id} className="border-b border-forest/10">
                  <td className="px-2 py-2 text-xs text-ink/70">{formatWhen(row.heldAt)}</td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {row.objectKey}
                    {row.caseRef ? (
                      <div className="text-ink/55">{row.caseRef}</div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">{row.reason}</td>
                  <td className="px-2 py-2 text-xs">{row.heldByName || row.heldByEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
