"use client";

import type { WmsSkuKeyOption } from "@/lib/wms-sku-options";

export function WmsSkuKeyField({
  name = "productKey",
  label = "รหัสสินค้า",
  defaultValue = "",
  options,
  required = true,
  hint,
  autoFocus = false,
  scanFriendly = false,
  nextFocusId,
}: {
  name?: string;
  label?: string;
  defaultValue?: string;
  options: WmsSkuKeyOption[];
  required?: boolean;
  hint?: string;
  autoFocus?: boolean;
  /** Larger mono field for barcode / scanner wedge */
  scanFriendly?: boolean;
  /** After Enter / scanner beep, move focus here (e.g. qtyReceived) */
  nextFocusId?: string;
}) {
  const listId = `wms-sku-${name}`;
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        list={listId}
        defaultValue={defaultValue}
        required={required}
        placeholder="สแกนหรือพิมพ์ เช่น B00001"
        autoComplete="off"
        autoFocus={autoFocus}
        inputMode="text"
        enterKeyHint={nextFocusId ? "next" : "done"}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !nextFocusId) return;
          event.preventDefault();
          const next = document.getElementById(nextFocusId);
          if (next instanceof HTMLInputElement) {
            next.focus();
            next.select();
          }
        }}
        className={
          scanFriendly
            ? "mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-3 font-mono text-lg tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
            : "mt-1 min-h-11 w-full rounded-lg border border-forest/20 px-3 py-2 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
        }
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt.productId} value={opt.productId}>
            {opt.label}
          </option>
        ))}
      </datalist>
      {hint ? (
        <span className="mt-1 block text-xs text-ink/55">{hint}</span>
      ) : null}
    </label>
  );
}
