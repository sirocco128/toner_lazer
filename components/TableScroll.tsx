import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Horizontal scroll wrapper for data tables on small screens. */
export function TableScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("table-scroll", className)}>{children}</div>;
}
