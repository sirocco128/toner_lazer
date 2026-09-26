import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "@/components/MobileMenu";
import { NavLink } from "@/components/NavLink";
import { NavMore } from "@/components/NavMore";
import { NavUtilityCluster } from "@/components/NavUtilityCluster";
import { ThemeToggle } from "@/components/ThemeToggle";
import { withOptionalBasketLink } from "@/lib/nav";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Navbar({
  enableP2QuoteTools,
}: {
  enableP2QuoteTools: boolean;
}) {
  const links = withOptionalBasketLink(enableP2QuoteTools);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-forest/10 bg-paper/75 pt-[env(safe-area-inset-top)] backdrop-blur-md",
        "dark:border-white/10 dark:bg-forest/70",
      )}
    >
      <div
        className={cn(
          "hidden border-b border-forest/10 bg-forest-mist/80 lg:block",
          "dark:border-white/10 dark:bg-forest/40",
        )}
      >
        <div className="mx-auto flex max-w-content items-center justify-end px-page py-1.5">
          <NavUtilityCluster />
        </div>
      </div>
      <div className="mx-auto flex max-w-content items-center justify-between gap-2 px-page py-2.5 sm:gap-4 sm:py-3">
        <Link
          href="/"
          aria-label={site.name}
          className="shrink-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <BrandLogo />
        </Link>

        <nav className="hidden min-w-0 items-center gap-3 lg:flex xl:gap-6" aria-label="เมนูหลัก">
          {links.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              title={link.hint}
              className="whitespace-nowrap text-sm font-medium text-ink/80 transition hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass dark:text-paper/80 dark:hover:text-brass-soft"
              activeClassName="text-forest underline decoration-brass decoration-2 underline-offset-8 dark:text-brass-soft"
            >
              {link.label}
            </NavLink>
          ))}
          <NavMore />
          <ThemeToggle />
          <Button asChild className="shrink-0">
            <Link href="/contact">ขอใบเสนอราคา</Link>
          </Button>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <ThemeToggle />
          <MobileMenu enableP2QuoteTools={enableP2QuoteTools} />
        </div>
      </div>
    </header>
  );
}
