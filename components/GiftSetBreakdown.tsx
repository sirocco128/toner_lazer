import { CUSTOM_QUOTE_NOTICE, MOQ_NOTICE } from "@/lib/ux-copy";
import type { Product } from "@/lib/data";

type GiftSetBreakdownProps = {
  product: Pick<Product, "components" | "isBundle" | "minOrder">;
};

export function GiftSetBreakdown({ product }: GiftSetBreakdownProps) {
  const items = product.components || [];
  if (items.length === 0 && !product.isBundle) {
    return (
      <aside className="mt-6 space-y-3 rounded-2xl border border-forest/10 bg-forest-mist/40 p-4">
        <p className="text-sm leading-relaxed text-ink/75">{CUSTOM_QUOTE_NOTICE}</p>
        <p className="text-sm leading-relaxed text-ink/75">
          {MOQ_NOTICE} ขั้นต่ำ {product.minOrder} ชุด
        </p>
      </aside>
    );
  }

  return (
    <aside className="mt-6 rounded-2xl border border-forest/10 bg-forest-mist/40 p-4">
      <h2 className="text-sm font-semibold text-forest">ชิ้นในชุดของขวัญ</h2>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm text-ink/80">
          {items.map((item, index) => (
            <li
              key={`${item.sku || item.name}-${index}`}
              className="flex justify-between gap-3 border-b border-forest/10 pb-2 last:border-0"
            >
              <span>
                {item.name}
                {item.sku ? (
                  <span className="ml-2 font-mono text-[11px] text-ink/45">{item.sku}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-ink/60">× {item.qty}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink/70">ชุดประกอบหลายชิ้น — ทีมขายยืนยันรายการในใบเสนอราคา</p>
      )}
      <p className="mt-4 text-sm leading-relaxed text-ink/75">{CUSTOM_QUOTE_NOTICE}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink/75">
        {MOQ_NOTICE} ขั้นต่ำ {product.minOrder} ชุด
      </p>
    </aside>
  );
}
