import {
  PRICE_DISCLAIMER_FULL,
  PRICE_DISCLAIMER_HEADING,
  PRICE_DISCLAIMER_POINTS,
  PRICE_DISCLAIMER_SHORT,
} from "@/lib/ux-copy";

type PriceDisclaimerProps = {
  variant?: "short" | "full";
  className?: string;
};

export function PriceDisclaimer({
  variant = "short",
  className = "",
}: PriceDisclaimerProps) {
  if (variant === "full") {
    return (
      <aside
        role="note"
        className={`rounded-2xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm leading-relaxed text-ink/80 ${className}`.trim()}
      >
        <p className="font-semibold text-forest">{PRICE_DISCLAIMER_HEADING}</p>
        <p className="mt-1">{PRICE_DISCLAIMER_FULL}</p>
      </aside>
    );
  }

  return (
    <aside
      role="note"
      className={`rounded-2xl border border-brass/30 bg-brass/10 px-4 py-3 ${className}`.trim()}
    >
      <p className="text-sm font-semibold text-forest">{PRICE_DISCLAIMER_HEADING}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink/75">
        {PRICE_DISCLAIMER_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <p className="sr-only">{PRICE_DISCLAIMER_SHORT}</p>
    </aside>
  );
}
