"use client";

import { useMemo, useState } from "react";
import type { BundleComponentOption } from "@/lib/sku-master-types";

export function SkuSearchSelect({
  name,
  options,
  value,
  onChange,
  required,
}: {
  name: string;
  options: BundleComponentOption[];
  value: string;
  onChange: (productId: string) => void;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.productId === value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? options.filter((item) => {
          const hay = `${item.productId} ${item.nameTh} ${item.oriProductCode || ""}`.toLowerCase();
          return hay.includes(needle);
        })
      : options;
    return list.slice(0, 40);
  }, [options, query]);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <input
        value={open ? query : selected ? `${selected.productId} · ${selected.nameTh}` : query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        placeholder="ค้นรหัส / ชื่อ / ori — ไม่โชว์ราคาชิ้น"
        className="w-full rounded border border-forest/20 px-3 py-2 text-sm"
        autoComplete="off"
      />
      {open ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-forest/20 bg-paper shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink/55">ไม่พบชิ้น A/B ที่ตรงคำค้น</li>
          ) : (
            filtered.map((item) => (
              <li key={item.productId}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-forest-mist/70"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(item.productId);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className="font-mono">{item.productId}</span>
                  <span className="text-ink/70"> · {item.nameTh}</span>
                  {item.oriProductCode ? (
                    <span className="text-ink/45"> · {item.oriProductCode}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
