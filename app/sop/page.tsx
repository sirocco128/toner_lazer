import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SopGuideApp } from "@/components/sop/SopGuideApp";
import { SopUnlockForm } from "@/components/sop/SopUnlockForm";
import {
  hasSopGuideAccess,
  isSopGuideConfigured,
} from "@/lib/sop-guide-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<{ token?: string; w?: string; s?: string }>;

export default async function SopPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  if (!isSopGuideConfigured()) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">
          คู่มือปฏิบัติงาน
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-forest">
          ยังไม่เปิดใช้งานคู่มือ
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">
          ตั้งค่า <code className="text-forest">SOP_GUIDE_TOKEN</code> (อย่างน้อย
          16 ตัวอักษร) และ{" "}
          <code className="text-forest">ADMIN_SESSION_SECRET</code> ในสภาพแวดล้อม
          แล้วรีสตาร์ทเซิร์ฟเวอร์
        </p>
      </div>
    );
  }

  // Real tokens go through the API so the cookie is set in a Route Handler.
  if (params.token && params.token !== "invalid") {
    const qs = new URLSearchParams();
    qs.set("token", params.token);
    if (params.w) qs.set("w", params.w);
    if (params.s) qs.set("s", params.s);
    redirect(`/api/sop/unlock?${qs.toString()}`);
  }

  const unlocked = await hasSopGuideAccess();
  if (!unlocked) {
    return (
      <div className="relative min-h-dvh overflow-hidden bg-forest px-6 py-16 text-paper">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(230,83,18,0.28),transparent_45%)]"
        />
        <div className="relative mx-auto max-w-lg rounded-2xl border border-paper/15 bg-paper px-6 py-10 text-ink shadow-2xl sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass">
            เข้าอ่านด้วยโทเค็น
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-forest">
            คู่มือ SOP Ops
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/70">
            คู่มือขั้นตอนปฏิบัติงานทุกเมนู — สำหรับพนักงานที่มีโทเค็นเปิดอ่านเท่านั้น
          </p>
          {params.token === "invalid" ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              โทเค็นในลิงก์ไม่ถูกต้อง
            </p>
          ) : null}
          <SopUnlockForm />
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-ink/60">
          กำลังโหลดคู่มือ…
        </div>
      }
    >
      <SopGuideApp />
    </Suspense>
  );
}
