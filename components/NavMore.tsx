"use client";

import { usePathname } from "next/navigation";
import { NavLink } from "@/components/NavLink";
import { isMoreNavActive, MORE_NAV_LINKS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function NavMore() {
  const pathname = usePathname() || "/";
  const moreActive = isMoreNavActive(pathname);

  return (
    <details className="relative">
      <summary
        className={cn(
          "cursor-pointer list-none text-sm font-medium text-ink/80 transition hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass dark:text-paper/80 dark:hover:text-brass-soft [&::-webkit-details-marker]:hidden",
          moreActive &&
            "text-forest underline decoration-brass decoration-2 underline-offset-8 dark:text-brass-soft",
        )}
      >
        ดูเพิ่ม
      </summary>
      <div className="absolute left-0 z-20 mt-2 min-w-[min(14rem,calc(100vw-2rem))] rounded-xl border border-white/20 bg-paper/95 py-1 shadow-lift backdrop-blur-md dark:border-white/10 dark:bg-forest/90">
        {MORE_NAV_LINKS.map((link) => (
          <NavLink
            key={link.href}
            href={link.href}
            title={link.hint}
            className="block px-3 py-2 text-sm font-medium text-ink/80 hover:bg-forest-mist hover:text-forest"
            activeClassName="bg-forest-mist text-forest"
          >
            <span className="block">{link.label}</span>
            {link.hint ? (
              <span className="mt-0.5 block text-xs font-normal text-ink/55">
                {link.hint}
              </span>
            ) : null}
          </NavLink>
        ))}
      </div>
    </details>
  );
}
