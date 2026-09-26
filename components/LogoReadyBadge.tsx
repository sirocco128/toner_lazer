import { CheckCircle2 } from "lucide-react";
import { LOGO_SCREENING_BADGE } from "@/lib/ux-copy";
import { cn } from "@/lib/utils";

type LogoReadyBadgeProps = {
  className?: string;
};

export function LogoReadyBadge({ className }: LogoReadyBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/40 bg-paper/90 px-3 py-1 text-xs font-medium text-forest shadow-sm backdrop-blur-md",
        className,
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
      {LOGO_SCREENING_BADGE}
    </span>
  );
}
