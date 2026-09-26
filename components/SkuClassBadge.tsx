import { cn } from "@/lib/utils";
import {
  STOCK_CLASS_SHORT,
  type StockClass,
} from "@/lib/sku-master-types";

const TONE: Record<StockClass, string> = {
  A: "bg-emerald-100 text-emerald-900",
  B: "bg-sky-100 text-sky-900",
  C: "bg-amber-100 text-amber-950",
  D: "bg-violet-100 text-violet-900",
};

export function SkuClassBadge({
  stockClass,
  bundle,
}: {
  stockClass: StockClass;
  bundle?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
          TONE[stockClass],
        )}
        title={STOCK_CLASS_SHORT[stockClass]}
      >
        {stockClass} · {STOCK_CLASS_SHORT[stockClass]}
      </span>
      {bundle ? (
        <span className="rounded-full bg-forest-mist px-2 py-0.5 text-xs text-forest">
          บันเดิล
        </span>
      ) : null}
    </span>
  );
}
