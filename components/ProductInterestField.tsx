"use client";

import Link from "next/link";
import type { QuoteInterestLine } from "@/lib/quote-basket";

type ProductInterestFieldProps = {
  lines: QuoteInterestLine[];
  value: string;
  error?: string;
  showBasketLink?: boolean;
  onChange: (value: string) => void;
};

export function ProductInterestField({
  lines,
  value,
  error,
  showBasketLink = false,
  onChange,
}: ProductInterestFieldProps) {
  const errorId = "productInterest-error";
  const hintId = "productInterest-hint";

  if (lines.length > 0) {
    return (
      <fieldset
        className="min-w-0"
        aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
      >
        <legend className="mb-1.5 text-sm font-medium text-ink">
          สินค้า / เซ็ตที่สนใจ
        </legend>
        <ul className="flex flex-wrap gap-2">
          {lines.map((line, index) => (
            <li
              key={`${line.productName}-${line.skuCode ?? ""}-${index}`}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-forest/20 bg-forest-mist/70 px-3 py-2 text-sm text-forest"
            >
              <span className="min-w-0 break-words leading-snug">
                {line.productName}
                {line.skuCode ? ` ${line.skuCode}` : ""}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                × {line.quantity}
              </span>
            </li>
          ))}
        </ul>
        <input type="hidden" name="productInterest" value={value} />
        <p id={hintId} className="mt-2 text-xs leading-relaxed text-ink/55">
          {lines.length > 1
            ? `รายการจากตะกร้า ${lines.length} สาย — แต่ละชิ้นมีจำนวนของตัวเอง`
            : "รายการจากตะกร้าใบเสนอราคา"}
          {showBasketLink ? (
            <>
              {" · "}
              <Link
                href="/quote-basket"
                className="cursor-pointer font-medium text-forest underline-offset-2 hover:underline"
              >
                แก้ไขตะกร้า
              </Link>
            </>
          ) : null}
        </p>
        {error ? (
          <p id={errorId} className="mt-1 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </fieldset>
    );
  }

  return (
    <div>
      <label
        htmlFor="productInterest"
        className="mb-1.5 block text-sm font-medium text-ink"
      >
        สินค้า / เซ็ตที่สนใจ
      </label>
      <textarea
        id="productInterest"
        name="productInterest"
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="เช่น กระบอกน้ำ, สมุดโน้ต หรือชื่อเซ็ตที่สนใจ — ใส่ได้หลายรายการ"
        className="min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
