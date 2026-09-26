"use client";

import { NavLink } from "@/components/NavLink";
import { UTILITY_NAV_LINKS } from "@/lib/nav";
import { cn } from "@/lib/utils";

type NavUtilityClusterProps = {
  onNavigate?: () => void;
  className?: string;
  /** Drawer: stretch. Header: keep compact on the right. */
  layout?: "header" | "drawer";
};

export function NavUtilityCluster({
  onNavigate,
  className,
  layout = "header",
}: NavUtilityClusterProps) {
  const account = UTILITY_NAV_LINKS[0];
  if (!account) return null;

  return (
    <nav
      aria-label="โซนลูกค้า"
      className={cn(
        "flex items-center gap-1",
        layout === "drawer" && "w-full",
        className,
      )}
    >
      <NavLink
        href={account.href}
        title={account.hint}
        onClick={onNavigate}
        className={cn(
          "inline-flex min-h-11 items-center rounded-full px-3 text-xs font-medium text-forest/85 transition hover:bg-paper/80 hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:text-sm dark:text-brass-soft/90 dark:hover:bg-paper/10",
          layout === "drawer" &&
            "w-full justify-center border border-forest/15 bg-paper text-sm dark:border-white/15",
        )}
        activeClassName="bg-paper/90 text-forest dark:bg-paper/15"
      >
        {account.label}
      </NavLink>
    </nav>
  );
}
