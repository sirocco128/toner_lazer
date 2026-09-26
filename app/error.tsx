"use client";

import { useEffect } from "react";
import Link from "next/link";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[app-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-content flex-col items-center justify-center px-page py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brass">
        เกิดข้อผิดพลาด
      </p>
      <h1 className="mt-3 text-3xl font-bold text-forest">โหลดหน้านี้ไม่สำเร็จ</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink/70">
        ลองใหม่อีกครั้ง หรือกลับไปหน้าแรกแล้วเลือกเมนูอื่น หากยังไม่หาย
        ติดต่อฝ่ายขายผ่านฟอร์มขอใบเสนอราคาได้เลย
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
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-6 text-sm font-semibold text-forest"
        >
          หน้าแรก
        </Link>
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest"
        >
          ขอใบเสนอราคา
        </Link>
      </div>
    </div>
  );
}
