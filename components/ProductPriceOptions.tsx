"use client";

import { useState } from "react";
import { AddToQuoteButton } from "@/components/AddToQuoteButton";
import { PriceDisclaimer } from "@/components/PriceDisclaimer";
import { isP2QuoteToolsEnabled } from "@/lib/feature-flags";
import {
  applyProductPriceOptions,
  canToggleChinaFreight,
  type ProductPriceBand,
} from "@/lib/product-price-options";

type ProductPriceOptionsProps = ProductPriceBand & {
  productSlug: string;
  productName: string;
  minOrder?: number;
  skuCode?: string;
  enableP2QuoteTools?: boolean;
};

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-forest/10 py-3 last:border-b-0">
      <div
        className="min-w-0 cursor-pointer"
        onClick={() => {
          if (!disabled) onChange(!checked);
        }}
      >
        <p id={`${id}-label`} className="text-sm font-semibold text-forest">
          {label}
        </p>
        <p id={`${id}-hint`} className="mt-0.5 text-xs leading-relaxed text-ink/60">
          {hint}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? "bg-brass" : "bg-forest/20"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-paper shadow-sm transition ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function ProductPriceOptions({
  productSlug,
  productName,
  minOrder = 1,
  skuCode,
  priceMin,
  priceMax,
  priceExFreightMin,
  priceExFreightMax,
  packagingMin,
  packagingMax,
  enableP2QuoteTools = isP2QuoteToolsEnabled(),
}: ProductPriceOptionsProps) {
  const band: ProductPriceBand = {
    priceMin,
    priceMax,
    priceExFreightMin,
    priceExFreightMax,
    packagingMin,
    packagingMax,
  };
  const freightToggle = canToggleChinaFreight(band);
  const [includeFreight, setIncludeFreight] = useState(true);
  const [includePackaging, setIncludePackaging] = useState(false);

  const priced = applyProductPriceOptions(band, {
    includeFreight: freightToggle ? includeFreight : true,
    includePackaging,
  });

  const notes: string[] = [];
  if (freightToggle && includeFreight) notes.push("รวมค่าส่งจากจีน");
  if (freightToggle && !includeFreight) notes.push("ยังไม่รวมค่าส่งจากจีน");
  if (includePackaging) notes.push("รวมแพ็คในตัวสินค้า");
  else notes.push("ยังไม่รวมกล่องแพ็ค");

  return (
    <div className="mt-8">
      <div className="flex gap-3 border-b border-forest/10 pb-3 text-sm">
        <dt className="w-28 shrink-0 font-semibold text-forest">ราคาโดยประมาณ</dt>
        <dd className="text-ink/80">
          <span className="text-lg font-semibold text-forest">{priced.priceRange}</span>
          <span className="mt-1 block text-xs text-ink/55">{notes.join(" · ")}</span>
        </dd>
      </div>

      <div className="mt-2 rounded-2xl border border-forest/10 bg-forest-mist/40 px-4">
        {freightToggle ? (
          <SwitchRow
            id="toggle-china-freight"
            label="รวมค่าส่งจากจีน"
            hint="คิดค่าขนส่งจีนถึงไทยรวมในราคาต่อชุด"
            checked={includeFreight}
            onChange={setIncludeFreight}
          />
        ) : null}
        <SwitchRow
          id="toggle-include-packaging"
          label="รวมแพ็คในตัวสินค้า"
          hint="คิดค่ากล่องจั่วปังรวมในราคาต่อชุด ไม่แยกเป็นรายการแพ็ค"
          checked={includePackaging}
          onChange={setIncludePackaging}
        />
      </div>

      <PriceDisclaimer className="mt-4" variant="full" />
      {enableP2QuoteTools ? (
        <AddToQuoteButton
          productSlug={productSlug}
          productName={productName}
          minOrder={minOrder}
          skuCode={skuCode}
          priceMin={priced.priceMin}
          priceMax={priced.priceMax}
        />
      ) : null}
    </div>
  );
}
