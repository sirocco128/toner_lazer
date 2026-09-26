"use client";

import { Suspense, useEffect, useId, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { QuoteForm } from "@/components/QuoteForm";
import { Button } from "@/components/ui/button";

function QuoteLaunchModalInner() {
  const titleId = useId();
  const pathname = usePathname() || "/";
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const quote = search.get("quote") === "1" || search.get("rfq") === "1";
  const productSlug = search.get("productSlug") || search.get("slug") || "";
  const productInterest =
    search.get("productInterest") || search.get("product") || "";

  useEffect(() => {
    if (quote && pathname !== "/contact") {
      setOpen(true);
    }
  }, [quote, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-forest/45 p-3 sm:items-center"
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl border border-forest/10 bg-paper p-5 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-bold text-forest">
            ขอใบเสนอราคา
          </h2>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            ปิด
          </Button>
        </div>
        <p className="mt-2 text-sm text-ink/70">
          เปิดจากลิงก์สมุดพลิกหรือปุ่มบนเว็บ — ไม่มีการชำระเงินในหน้านี้
        </p>
        <div className="mt-6">
          <QuoteForm
            productSlug={productSlug || undefined}
            productInterest={productInterest || undefined}
            heading="รายละเอียดคำขอ"
          />
        </div>
      </div>
    </div>
  );
}

export function QuoteLaunchModal() {
  return (
    <Suspense fallback={null}>
      <QuoteLaunchModalInner />
    </Suspense>
  );
}
