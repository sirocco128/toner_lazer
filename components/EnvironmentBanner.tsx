"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";

const DISMISS_KEY = "terabis-hide-demo-banner";

export function EnvironmentBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* private mode */
    }
  }, []);

  if (site.allowIndexing || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode */
    }
  }

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 bg-brass px-4 py-1.5 text-center text-xs font-medium leading-snug text-forest sm:text-sm"
    >
      <p className="min-w-0 text-pretty">
        <span className="font-semibold">โหมดสาธิต</span>
        {" — "}
        ข้อมูลติดต่อและสินค้าเป็นตัวอย่าง ยังไม่เปิดให้ค้นจาก Search Engine
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold underline-offset-2 hover:underline"
      >
        ซ่อน
      </button>
    </div>
  );
}
