import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  mesh?: boolean;
  size?: "content" | "wide" | "full";
};

/** Shared storefront width, safe-area padding, and mesh background. */
export function PageShell({
  children,
  className,
  innerClassName,
  mesh = false,
  size = "content",
}: PageShellProps) {
  return (
    <div className={cn("min-w-0", mesh && "bg-premium-mesh", className)}>
      <div
        className={cn(
          "mx-auto w-full min-w-0 px-page",
          size === "content" && "max-w-content",
          size === "wide" && "max-w-6xl",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
