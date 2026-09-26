"use client";

import { useEffect } from "react";
import Link from "next/link";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function OpsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[ops-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-3xl flex-col items-center justify-center px-page py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brass">
        โหลดไม่สำเร็จ
      </p>
      <h1 className="mt-3 text-2xl font-bold text-forest">หน้านี้เปิดไม่ได้ในขณะนี้</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink/70">
        ลองใหม่อีกครั้ง หรือกลับภาพรวมแล้วเปิดเมนูอื่น ไม่ใช่หน้าลูกค้า
        และไม่มีการชำระเงินที่นี่
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-6 text-sm font-semibold text-paper transition hover:bg-forest-light"
        >
          ลองอีกครั้ง
        </button>
        <Link
          href="/ops"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
        >
          กลับภาพรวม
        </Link>
      </div>
    </div>
  );
}
