import { OpsLoginForm } from "@/components/OpsLoginForm";
import { OPS_CONSOLE_TITLE } from "@/lib/ux-copy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{
  error?: string;
}>;

export default async function OpsLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
        {OPS_CONSOLE_TITLE}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-forest">
        เข้าสู่ระบบปฏิบัติการ
      </h1>
      <p className="mt-2 text-sm text-ink/70">
        จัดการคำขอจากเว็บ Smart Gift ใบเสนอราคา ราคา สินค้า และวงจรออเดอร์ —
        ลูกค้าใช้หน้าเว็บสาธารณะ ไม่ใช้หน้านี้
      </p>
      <OpsLoginForm googleError={params.error} />
      <p className="mt-6 text-xs text-ink/55">
        หลังเข้าสู่ระบบ เริ่มที่{" "}
        <span className="font-medium text-forest">ภาพรวมงานวันนี้</span> หรือเปิด{" "}
        <span className="font-medium text-forest">คู่มือการทำงาน</span> จากเมนูระบบ
      </p>
    </div>
  );
}
