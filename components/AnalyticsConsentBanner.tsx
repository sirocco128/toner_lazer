"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  isGaConfigured,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from "@/lib/analytics";

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isGaConfigured()) return;
    if (readAnalyticsConsent()) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function choose(value: "granted" | "denied") {
    writeAnalyticsConsent(value);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="analytics-consent-title"
      aria-describedby="analytics-consent-desc"
      className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-40 px-3 print:hidden lg:bottom-0 lg:px-4 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto mb-3 max-w-content rounded-2xl border border-forest/15 bg-paper/95 p-4 shadow-[0_-8px_24px_rgba(20,53,42,0.12)] backdrop-blur-md sm:p-5">
        <p
          id="analytics-consent-title"
          className="text-sm font-semibold text-forest"
        >
          สถิติการเข้าชมเว็บไซต์
        </p>
        <p
          id="analytics-consent-desc"
          className="mt-1 text-sm leading-relaxed text-ink/75"
        >
          เราใช้ Google Analytics เพื่อดูว่าหน้าใดมีผู้เข้าชม
          ไม่ส่งชื่อ อีเมล เบอร์โทร หรือเลขคำขอไปยัง Google
          อ่านรายละเอียดใน{" "}
          <Link
            href="/privacy"
            className="font-medium text-forest underline-offset-2 hover:underline"
          >
            นโยบายความเป็นส่วนตัว
          </Link>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => choose("granted")}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-4 text-sm font-semibold text-paper hover:bg-forest-light"
          >
            ยอมรับ
          </button>
          <button
            type="button"
            onClick={() => choose("denied")}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/25 px-4 text-sm font-semibold text-forest hover:bg-forest-mist"
          >
            ไม่ยอมรับ
          </button>
        </div>
      </div>
    </div>
  );
}
