"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, GitCompareArrows } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AddToQuoteButton } from "@/components/AddToQuoteButton";
import { CatalogImage } from "@/components/CatalogImage";
import { isP2QuoteToolsEnabled } from "@/lib/feature-flags";
import {
  catalogHrefForProduct,
  COMPARE_EVENT,
  loadCompareList,
  saveCompareList,
  stockStatusForProduct,
  toCompareItem,
  toggleCompareItem,
} from "@/lib/product-compare";
import { categoryTabLabel, productCoverImage } from "@/lib/product-media";
import { CUSTOM_QUOTE_NOTICE_SHORT, LOGO_SCREENING_BADGE, MOQ_NOTICE_SHORT } from "@/lib/ux-copy";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/data";

export type ProductCardModel = Pick<
  Product,
  | "name"
  | "slug"
  | "priceRange"
  | "minOrder"
  | "images"
  | "categorySlug"
  | "categoryName"
  | "productId"
  | "stockClass"
  | "isClearance"
  | "isBundle"
  | "colors"
  | "leadDays"
  | "components"
  | "capacity"
  | "dimensions"
  | "priceMin"
  | "priceMax"
  | "material"
>;

type ProductCardProps = {
  product: ProductCardModel;
  heading?: "h2" | "h3";
  className?: string;
};

function emitCompareChanged() {
  window.dispatchEvent(new Event(COMPARE_EVENT));
}

export function ProductCard({
  product,
  heading = "h3",
  className,
}: ProductCardProps) {
  const imageUrl = productCoverImage(product.images, product.categorySlug);
  const TitleTag = heading;
  const price = product.priceRange?.trim() || "สอบถามราคา";
  const category = categoryTabLabel(
    product.categorySlug || "",
    product.categoryName || product.categorySlug || "",
  );
  const sku = product.productId || product.slug;
  const stock = stockStatusForProduct(product);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    setSelected(loadCompareList().some((item) => item.slug === product.slug));
  }, [product.slug]);

  const onCompare = useCallback(() => {
    const current = loadCompareList();
    const result = toggleCompareItem(current, toCompareItem(product));
    saveCompareList(result.list);
    setSelected(result.list.some((item) => item.slug === product.slug));
    emitCompareChanged();
  }, [product]);

  return (
    <article
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl border border-forest/10 bg-paper/90 p-3 shadow-sm backdrop-blur-md transition-all duration-300 ease-cinematic",
        "hover:-translate-y-1 hover:border-brass/30 hover:shadow-xl",
        "dark:border-white/10 dark:bg-forest-light/40",
        className,
      )}
    >
      <Link
        href={`/products/${product.slug}`}
        className="media-frame media-frame--card group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
      >
        <CatalogImage
          src={imageUrl}
          alt={product.name}
          sizes="(max-width:768px) 100vw, 33vw"
          objectFit="contain"
          fallbackSrc={productCoverImage([], product.categorySlug)}
        />
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/40 bg-paper/90 px-3 py-1 text-xs font-medium text-forest shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-forest/80 dark:text-paper">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          {LOGO_SCREENING_BADGE}
        </span>
        {product.isClearance ? (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-brass px-3 py-1 text-xs font-medium text-[color:var(--accent-foreground)] shadow-sm">
            เคลียร์
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col justify-between gap-3 px-1 pb-1 pt-4">
        <div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink/55">
            {category ? <span>{category}</span> : null}
            <span className="font-mono">รหัส {sku}</span>
          </p>
          <TitleTag className="mt-1 line-clamp-2 text-lg font-semibold text-forest dark:text-paper">
            <Link
              href={`/products/${product.slug}`}
              className="hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {product.name}
            </Link>
          </TitleTag>
          <p className="mt-1 text-xs text-ink/60 dark:text-paper/60">{stock}</p>
          {product.colors && product.colors.length > 0 ? (
            <ul className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="สีที่มี">
              {product.colors.slice(0, 6).map((color) => (
                <li key={color.name} className="inline-flex items-center gap-1 text-[11px] text-ink/65">
                  <span
                    className="h-3 w-3 rounded-full border border-forest/20"
                    style={{ background: color.hex || "var(--color-forest-mist)" }}
                    aria-hidden
                  />
                  {color.name}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-xs font-medium text-forest">
            {MOQ_NOTICE_SHORT} {product.minOrder} ชุด
          </p>
        </div>

        <div className="border-t border-forest/10 pt-3 dark:border-white/10">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-ink/40">
            ราคาโดยประมาณ — ไม่ใช่ราคาชำระ
          </span>
          <span className="text-base font-bold text-forest dark:text-brass-soft">
            {price}
          </span>
          <p className="mt-1 text-[11px] leading-relaxed text-ink/55">
            {CUSTOM_QUOTE_NOTICE_SHORT}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link
              href={`/products/${product.slug}`}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-paper transition hover:bg-forest-light sm:min-h-9"
            >
              ขอราคา
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link
              href={catalogHrefForProduct(product.slug)}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full border border-forest/20 px-3 py-1.5 text-xs font-medium text-forest hover:border-brass/50 sm:min-h-9"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              <span className="sm:hidden">สมุดพลิก</span>
              <span className="hidden sm:inline">ดูในสมุดพลิก</span>
            </Link>
            <button
              type="button"
              onClick={onCompare}
              aria-pressed={selected}
              className={cn(
                "col-span-2 inline-flex min-h-11 items-center justify-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium sm:col-span-1 sm:min-h-9",
                selected
                  ? "border-brass bg-brass/15 text-forest"
                  : "border-forest/20 text-forest hover:border-brass/50",
              )}
            >
              <GitCompareArrows className="h-3.5 w-3.5" aria-hidden />
              {selected ? "กำลังเปรียบเทียบ" : "เปรียบเทียบ"}
            </button>
          </div>
          {isP2QuoteToolsEnabled() ? (
            <div className="-mt-2">
              <AddToQuoteButton
                productSlug={product.slug}
                productName={product.name}
                minOrder={product.minOrder}
                skuCode={product.productId || product.slug}
                priceMin={product.priceMin}
                priceMax={product.priceMax}
              />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
