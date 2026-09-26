"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { QuoteBasket } from "@/lib/quote-basket-types";
import {
  PRICE_ESTIMATE_DISCLAIMER,
  approximatePriceSum,
  buildContactHrefFromBasket,
  createEmptyBasket,
  formatBahtRange,
  loadBasketFromStorage,
  removeItem,
  saveBasketToStorage,
  updateItemFields,
  updateQuantity,
} from "@/lib/quote-basket";
import { quoteBasketLockNote } from "@/lib/ux-copy";
import { minNeededDateYmd } from "@/lib/bangkok-date";

const DECORATION_OPTIONS = [
  { value: "", label: "ยังไม่เลือก" },
  { value: "not-sure", label: "ยังไม่แน่ใจ" },
  { value: "screen-print", label: "สกรีน" },
  { value: "emboss", label: "ปั๊มนูน" },
  { value: "laser", label: "เลเซอร์" },
  { value: "full-color", label: "พิมพ์สี" },
  { value: "uv-print", label: "พิมพ์ UV" },
  { value: "embroidery", label: "ปัก" },
  { value: "foil", label: "ปั๊มฟอยล์" },
] as const;

export function QuoteBasketPanel() {
  const [basket, setBasket] = useState<QuoteBasket>(() => createEmptyBasket());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setBasket(loadBasketFromStorage());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: QuoteBasket) => {
    setBasket(next);
    saveBasketToStorage(next);
  }, []);

  const totals = useMemo(() => approximatePriceSum(basket), [basket]);
  const contactHref = useMemo(
    () => buildContactHrefFromBasket(basket),
    [basket],
  );
  const minNeededDate = minNeededDateYmd();
  const neededDate =
    basket.neededDate && basket.neededDate >= minNeededDate
      ? basket.neededDate
      : "";

  if (!hydrated) {
    return (
      <div className="rounded-3xl border border-forest/10 bg-paper p-6 sm:p-8">
        <p className="text-ink/60">กำลังโหลดตะกร้าใบเสนอราคา…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-brass">
          รวบรวมก่อนขอราคา
        </p>
        <h1 className="mt-2 text-3xl font-bold text-forest sm:text-4xl">
          ตะกร้าใบเสนอราคา
        </h1>
        <p className="mt-3 text-ink/75 leading-relaxed">
          เลือกสินค้าหลายรายการก่อนส่งคำขอใบเสนอราคา — ไม่ใช่ตะกร้าชำระเงิน
          ข้อมูลถูกเก็บชั่วคราวในเบราว์เซอร์นี้เท่านั้น
        </p>
        <p className="mt-2 font-mono text-xs text-ink/50">รหัสตะกร้า: {basket.id}</p>
      </header>

      {basket.items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-forest/20 bg-forest-mist/40 px-6 py-12 text-center">
          <p className="text-ink/70">ยังไม่มีสินค้าในตะกร้า</p>
          <Link
            href="/products"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brass px-6 text-sm font-semibold text-forest"
          >
            เลือกสินค้าพรีเมียม
          </Link>
        </div>
      ) : (
        <ul className="space-y-5">
          {basket.items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-forest/10 bg-paper p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/products/${item.productSlug}`}
                    className="text-lg font-semibold text-forest hover:text-brass"
                  >
                    {item.productName}
                  </Link>
                  <p className="mt-1 text-xs text-ink/50">/{item.productSlug}</p>
                  {item.skuCode ? (
                    <p className="mt-0.5 font-mono text-xs text-ink/45">รหัส {item.skuCode}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => persist(removeItem(basket, item.id))}
                  className="text-sm font-medium text-ink/60 underline-offset-2 hover:text-forest hover:underline"
                >
                  ลบรายการ
                </button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-semibold text-forest">จำนวน (ชุด)</span>
                  <input
                    type="number"
                    min={item.lockedMinQty || 1}
                    step={1}
                    value={item.quantity}
                    aria-describedby={`lock-${item.id}`}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isFinite(value)) return;
                      persist(updateQuantity(basket, item.id, value));
                    }}
                    className="mt-1 min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                  />
                  <span id={`lock-${item.id}`} className="mt-1 block text-xs text-ink/55">
                    {quoteBasketLockNote(item.lockedMinQty || 1)}
                  </span>
                </label>

                <label className="block text-sm">
                  <span className="font-semibold text-forest">วิธีตกแต่ง</span>
                  <select
                    value={item.decorationMethod ?? ""}
                    onChange={(event) =>
                      persist(
                        updateItemFields(basket, item.id, {
                          decorationMethod: event.target.value || undefined,
                        }),
                      )
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                  >
                    {DECORATION_OPTIONS.map((opt) => (
                      <option key={opt.value || "empty"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
              </label>
            </div>

              <label className="mt-4 block text-sm">
                <span className="font-semibold text-forest">จำนวนสีโลโก้</span>
                <select
                  value={item.logoColorCount ?? ""}
                  onChange={(event) =>
                    persist(
                      updateItemFields(basket, item.id, {
                        logoColorCount: event.target.value || undefined,
                      }),
                    )
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-forest/20 bg-paper px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                >
                  <option value="">ยังไม่ระบุ</option>
                  <option value="1">1 สี</option>
                  <option value="2">2 สี</option>
                  <option value="3">3 สี</option>
                  <option value="full">สีเต็ม / เต็มสี</option>
                </select>
              </label>

              <label className="mt-4 block text-sm">
                <span className="font-semibold text-forest">โน้ตต่อรายการ</span>
                <textarea
                  rows={2}
                  value={item.note ?? ""}
                  onChange={(event) =>
                    persist(
                      updateItemFields(basket, item.id, {
                        note: event.target.value || undefined,
                      }),
                    )
                  }
                  placeholder="เช่น สีโลโก้ ตำแหน่งสกรีน หรือข้อกำหนดพิเศษ"
                  className="mt-1 w-full rounded-xl border border-forest/20 bg-paper px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                />
              </label>

              {typeof item.estimatedUnitMin === "number" &&
              typeof item.estimatedUnitMax === "number" ? (
                <p className="mt-3 text-xs text-ink/60">
                  ราคาที่ล็อกต่อชุด:{" "}
                  {formatBahtRange(item.estimatedUnitMin, item.estimatedUnitMax)}
                  <span className="mt-1 block">
                    ประมาณการรายการ:{" "}
                    {formatBahtRange(
                      item.estimatedUnitMin * item.quantity,
                      item.estimatedUnitMax * item.quantity,
                    )}
                  </span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <aside className="rounded-3xl border border-brass/30 bg-brass/10 px-6 py-6">
        <h2 className="text-lg font-semibold text-forest">สรุปโดยประมาณ</h2>
        {totals.hasEstimates ? (
          <p className="mt-2 text-2xl font-bold text-forest">
            {formatBahtRange(totals.min, totals.max)}
          </p>
        ) : (
          <p className="mt-2 text-ink/70">สอบถามราคา — ยังไม่มีช่วงราคาโดยประมาณ</p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-ink/65">
          {PRICE_ESTIMATE_DISCLAIMER}
        </p>
        <label className="mt-4 block text-sm">
          <span className="font-semibold text-forest">วันส่งมอบที่ต้องการ</span>
          <input
            type="date"
            min={minNeededDate}
            value={neededDate}
            onChange={(event) => {
              const next = event.target.value;
              persist({
                ...basket,
                neededDate:
                  next && next < minNeededDate ? minNeededDate : next || undefined,
                updatedAt: new Date().toISOString(),
              });
            }}
            className="mt-1 min-h-11 w-full max-w-xs rounded-xl border border-forest/20 bg-paper px-3 text-ink"
          />
          <span className="mt-1 block text-xs text-ink/55">
            เลือกได้ตั้งแต่วันนี้บวก 10 วัน เป็นต้นไป
          </span>
        </label>
        <Link
          href={basket.items.length ? contactHref : "/contact"}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-6 text-sm font-semibold text-paper transition hover:bg-forest-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          ส่งคำขอใบเสนอราคา
        </Link>
        <p className="mt-3 text-xs text-ink/55">
          จะพาไปหน้าติดต่อพร้อมสรุปรายการในฟอร์ม — ตรวจสอบก่อนกดส่ง
        </p>
      </aside>
    </div>
  );
}
