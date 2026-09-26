import {
  PRICE_STRUCTURE_QTYS,
  stepForQty,
  type SkuPriceStructure,
} from "@/lib/sku-price-structure";
import { FormulaCheckNote } from "@/components/FormulaCheckNote";
import { formatThb, formatThbPlain } from "@/lib/th-billing";
import { cn } from "@/lib/utils";

export function SkuPriceStructureLegend({
  profile,
  className,
}: {
  profile: SkuPriceStructure["profile"];
  className?: string;
}) {
  return (
    <p className={cn("whitespace-pre-line text-xs text-ink/55", className)}>
      {profile === "corporate"
        ? "คอลัมน์ 100 / 300 / 500 / 1000 คือราคาขายตาม markup 1.47 — ช่องเข้มคือขั้นต่ำที่กำไรชุดถึง 20,000"
        : "คอลัมน์ 10–1000 คือราคาขายตามสูตรต้นทุนลงเรือ × SOF × markup — ช่องเข้มคือขั้นต่ำที่กำไรชุดถึงพื้น"}
    </p>
  );
}

export function SkuPriceLadderCompact({
  structure,
}: {
  structure: SkuPriceStructure;
}) {
  if (structure.kind === "empty") {
    return <p className="text-xs text-ink/45">{structure.note}</p>;
  }
  if (structure.kind === "fixed") {
    return (
      <p className="text-xs">
        <span className="font-semibold tabular-nums text-forest">
          {formatThbPlain(structure.sellPriceThb!)}
        </span>
        <span className="mt-0.5 block text-ink/45">{structure.note}</span>
      </p>
    );
  }
  return (
    <ol className="mt-1 flex flex-wrap gap-1">
      {structure.steps.map((step) => (
        <li
          key={step.qty}
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] tabular-nums",
            step.isForcedMin
              ? "bg-forest text-paper"
              : step.meetsFloor
                ? "bg-forest/10 text-forest"
                : "bg-ink/5 text-ink/40",
          )}
        >
          {step.qty} · {formatThbPlain(step.sellThb)}
        </li>
      ))}
    </ol>
  );
}

export function SkuPriceLadderHeaders({ className }: { className?: string }) {
  return (
    <>
      {PRICE_STRUCTURE_QTYS.map((qty) => (
        <th
          key={qty}
          className={cn("py-2 pr-3 text-right tabular-nums", className)}
        >
          {qty}
        </th>
      ))}
    </>
  );
}

export function SkuPriceLadderCells({
  structure,
}: {
  structure: SkuPriceStructure;
}) {
  return (
    <>
      {PRICE_STRUCTURE_QTYS.map((qty) => {
        const step = stepForQty(structure, qty);
        return (
          <td
            key={qty}
            className={cn(
              "py-2 pr-3 text-right tabular-nums",
              step?.isForcedMin
                ? "bg-forest/10 font-semibold text-forest"
                : step && !step.meetsFloor
                  ? "text-ink/35"
                  : "",
            )}
          >
            {step ? formatThbPlain(step.sellThb) : "—"}
          </td>
        );
      })}
    </>
  );
}

export function SkuPriceStructureTable({
  structure,
  showCost,
}: {
  structure: SkuPriceStructure;
  showCost?: boolean;
}) {
  if (structure.kind === "empty") {
    return <p className="mt-3 text-sm text-ink/60">{structure.note}</p>;
  }
  if (structure.kind === "fixed") {
    return (
      <p className="mt-3 text-sm">
        <span className="font-semibold tabular-nums text-forest">
          {formatThb(structure.sellPriceThb!)}
        </span>
        <span className="mt-1 block text-ink/55">{structure.note}</span>
      </p>
    );
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <p className="mb-2 whitespace-pre-line text-xs text-ink/55">{structure.note}</p>
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-forest/15 text-ink/60">
            <th className="py-2 pr-3">จำนวน</th>
            <th className="py-2 pr-3 text-right">ราคาขาย/ชุด</th>
            {showCost ? (
              <>
                <th className="py-2 pr-3 text-right">กำไร/ชุด</th>
                <th className="py-2 pr-3 text-right">กำไรทั้งล็อต</th>
                <th className="py-2 pr-3">พื้นกำไร</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {structure.steps.map((step) => (
            <tr
              key={step.qty}
              className={cn(
                "border-b border-forest/10",
                step.isForcedMin ? "bg-forest/10" : "",
              )}
            >
              <td className="py-2 pr-3 tabular-nums">
                {step.qty}
                {step.isForcedMin ? (
                  <span className="ml-2 rounded-full bg-forest px-2 py-0.5 text-[11px] text-paper">
                    ขั้นต่ำ
                  </span>
                ) : null}
                {showCost && step.formulaNote ? (
                  <details className="mt-1 font-normal">
                    <summary className="cursor-pointer text-[11px] text-forest">
                      ดูสูตรรีเช็ค
                    </summary>
                    <FormulaCheckNote note={step.formulaNote} className="mt-1" />
                  </details>
                ) : null}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums font-medium">
                {formatThbPlain(step.sellThb)}
              </td>
              {showCost ? (
                <>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatThbPlain(step.unitProfitThb)}
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-3 text-right tabular-nums",
                      step.meetsFloor ? "text-forest" : "text-ink/40",
                    )}
                  >
                    {formatThbPlain(step.packageProfitThb)}
                  </td>
                  <td className="py-2 pr-3 text-ink/60">
                    {step.meetsFloor ? "ถึงพื้น" : `ต้อง ${formatThbPlain(step.floor)}`}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
