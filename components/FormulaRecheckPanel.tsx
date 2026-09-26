import type { OpsQuoteCost, OpsQuoteRow } from "@/lib/ops-pricing";
import { formatThb } from "@/lib/th-billing";
import { markupBandLabel, sofBandLabel } from "@/lib/price-formula-note";
import { cn } from "@/lib/utils";

function n(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function Line({
  label,
  eq,
}: {
  label: string;
  eq: string;
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">
        {label}
      </p>
      <p className="font-mono text-[12px] leading-relaxed text-forest">{eq}</p>
    </div>
  );
}

export function FormulaRecheckPanel({
  row,
  fx,
  className,
}: {
  row: OpsQuoteRow;
  fx?: number;
  className?: string;
}) {
  const cost = row.cost as OpsQuoteCost | undefined;
  if (!cost) {
    if (!row.formulaNote) return null;
    return (
      <div
        className={cn(
          "rounded-lg border border-forest/10 bg-forest-mist/30 px-3 py-2",
          className,
        )}
      >
        <pre className="whitespace-pre-wrap font-mono text-[11px] text-ink/70">
          {row.formulaNote}
        </pre>
      </div>
    );
  }

  const raw = cost.landedCostThb * cost.sof * cost.markup;
  const unitGp = Math.round(row.sellThb - cost.landedCostThb);
  const fxLabel = fx != null && Number.isFinite(fx) ? n(fx, 4) : "FX";

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-brass/30 bg-brass/[0.06] px-3 py-3",
        className,
      )}
    >
      <p className="text-xs font-semibold text-forest">
        รีเช็คละเอียด · {row.qty} ชุด
        {row.belowFloor ? (
          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
            ไม่ถึงพื้นกำไร
          </span>
        ) : (
          <span className="ml-2 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-medium text-forest">
            ผ่านพื้น
          </span>
        )}
      </p>
      <Line
        label="1 บาทโรงงาน"
        eq={`${n(cost.factoryCny)} ¥ × ${fxLabel} = ${n(cost.factoryThb)} ฿`}
      />
      <Line
        label="2 ลงเรือ"
        eq={`${n(cost.factoryThb)} + ขนส่งในจีน ${n(cost.inlandThb)} + จีน→ไทย ${n(cost.freightThb)} = ${n(cost.landedCostThb)} ฿`}
      />
      <Line
        label="3 ตัวคูณ"
        eq={`SOF ${n(cost.sof)} (${sofBandLabel(row.qty)}) × markup ${n(cost.markup)} (${markupBandLabel(cost.landedCostThb)})`}
      />
      <Line
        label="4 ขาย"
        eq={`${n(cost.landedCostThb)} × ${n(cost.sof)} × ${n(cost.markup)} = ${n(raw)} → ปัด ${formatThb(row.sellThb)} /ชุด`}
      />
      <Line
        label="5 กำไร"
        eq={`(${formatThb(row.sellThb)} − ${formatThb(cost.landedCostThb)}) × ${row.qty} = GP/ชุด ${formatThb(unitGp)} · ทั้งออเดอร์ ${formatThb(cost.gpThb)}`}
      />
    </div>
  );
}
