"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  COMPARE_EVENT,
  COMPARE_LIMIT,
  loadCompareList,
  quoteHrefForProduct,
  saveCompareList,
  type ProductCompareItem,
} from "@/lib/product-compare";

const ROWS: Array<{ key: keyof ProductCompareItem; label: string }> = [
  { key: "sku", label: "รหัสสินค้า" },
  { key: "category", label: "หมวด" },
  { key: "material", label: "วัสดุ" },
  { key: "capacity", label: "ความจุ" },
  { key: "dimensions", label: "ขนาด" },
  { key: "customization", label: "งานโลโก้" },
  { key: "components", label: "ชิ้นในชุด" },
  { key: "minOrder", label: "สั่งขั้นต่ำ" },
  { key: "leadDays", label: "เวลาผลิต" },
  { key: "stockStatus", label: "สถานะสต็อก" },
  { key: "priceRange", label: "ราคาโดยประมาณ" },
];

function cell(item: ProductCompareItem, key: keyof ProductCompareItem): string {
  if (key === "minOrder") return `${item.minOrder} ชุด`;
  if (key === "leadDays") {
    return item.leadDays != null ? `ประมาณ ${item.leadDays} วัน` : "สอบถามทีมขาย";
  }
  const value = item[key];
  return value == null || value === "" ? "—" : String(value);
}

export function ProductCompareTray() {
  const titleId = useId();
  const [items, setItems] = useState<ProductCompareItem[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => {
    setItems(loadCompareList());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(COMPARE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(COMPARE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-[6.5rem] z-40 print:hidden lg:bottom-4">
      <div className="mx-auto max-w-content px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:px-6">
        <div className="rounded-2xl border border-forest/15 bg-paper/95 p-3 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-forest">
              เปรียบเทียบ {items.length}/{COMPARE_LIMIT} รายการ
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
                ดูตารางสเปค
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  saveCompareList([]);
                  setItems([]);
                  window.dispatchEvent(new Event(COMPARE_EVENT));
                }}
              >
                ล้าง
              </Button>
            </div>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs text-ink/70">
            {items.map((item) => (
              <li key={item.slug} className="rounded-full bg-forest-mist px-2 py-1">
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-forest/40 p-3 sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl border border-forest/10 bg-paper p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-xl font-bold text-forest">
                เปรียบเทียบสินค้า
              </h2>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                ปิด
              </Button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-forest/15 p-2 text-left text-forest">สเปค</th>
                    {items.map((item) => (
                      <th key={item.slug} className="border-b border-forest/15 p-2 text-left">
                        <Link
                          href={`/products/${item.slug}`}
                          className="font-semibold text-forest underline-offset-2 hover:underline"
                        >
                          {item.name}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.key}>
                      <th className="border-b border-forest/10 p-2 text-left font-medium text-ink/70">
                        {row.label}
                      </th>
                      {items.map((item) => (
                        <td key={`${item.slug}-${row.key}`} className="border-b border-forest/10 p-2 text-ink/80">
                          {cell(item, row.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {items.map((item) => (
                <Button key={item.slug} asChild size="sm">
                  <Link href={quoteHrefForProduct(item.slug, item.name)}>ขอราคา {item.name}</Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
