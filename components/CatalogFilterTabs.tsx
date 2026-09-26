import Link from "next/link";
import { categoryTabLabel } from "@/lib/product-media";
import { cn } from "@/lib/utils";

export type CatalogTab = {
  slug: string;
  name: string;
};

type CatalogFilterTabsProps = {
  categories: CatalogTab[];
  activeSlug?: string | null;
  hrefFor?: (slug: string) => string;
};

export function CatalogFilterTabs({
  categories,
  activeSlug,
  hrefFor,
}: CatalogFilterTabsProps) {
  const tabs: CatalogTab[] = [{ slug: "", name: "ทั้งหมด" }, ...categories];

  return (
    <nav
      aria-label="หมวดสินค้า"
      className="mt-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max min-w-full gap-2">
        {tabs.map((tab) => {
          const href = hrefFor
            ? hrefFor(tab.slug)
            : tab.slug
              ? `/products?category=${tab.slug}`
              : "/products";
          const active = tab.slug === "" ? !activeSlug : activeSlug === tab.slug;
          return (
            <li key={tab.slug || "all"}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "border-forest bg-forest text-paper shadow-sm dark:border-brass dark:bg-brass dark:text-forest"
                    : "border-forest/15 bg-paper/70 text-ink/75 backdrop-blur-md hover:border-brass/40 hover:text-forest dark:border-white/10 dark:bg-forest-light/40 dark:text-paper/80",
                )}
              >
                {tab.slug ? categoryTabLabel(tab.slug, tab.name) : tab.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
