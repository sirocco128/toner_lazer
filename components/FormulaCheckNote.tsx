import { formulaBandLegend } from "@/lib/price-formula-note";
import type { ForcedMinQtyProfile } from "@/lib/alibaba/forced-min-qty";
import { cn } from "@/lib/utils";

export function FormulaBandLegend({
  profile,
  className,
}: {
  profile: ForcedMinQtyProfile;
  className?: string;
}) {
  return (
    <p className={cn("whitespace-pre-line text-xs leading-relaxed text-ink/55", className)}>
      {formulaBandLegend(profile)}
    </p>
  );
}

export function FormulaCheckNote({
  note,
  className,
}: {
  note?: string;
  className?: string;
}) {
  if (!note) return null;
  return (
    <p
      className={cn(
        "whitespace-pre-line font-mono text-[11px] leading-relaxed text-ink/65",
        className,
      )}
    >
      {note}
    </p>
  );
}
