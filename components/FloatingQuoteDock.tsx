"use client";

import Link from "next/link";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  loadBasketFromStorage,
  QUOTE_BASKET_EVENT,
} from "@/lib/quote-basket";
import { quoteShortcutHref } from "@/lib/nav";
import { getPublicContact } from "@/lib/public-contact";
import { site } from "@/lib/site";
import { QUOTE_BASKET_FAB, QUOTE_FAB_LABEL } from "@/lib/ux-copy";
import { cn } from "@/lib/utils";

const HIDDEN_PREFIXES = ["/contact", "/privacy", "/terms", "/issues"];

export function FloatingQuoteDock({
  enableP2QuoteTools,
}: {
  enableP2QuoteTools: boolean;
}) {
  const pathname = usePathname() || "/";
  const hidden = HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const contact = getPublicContact(site);
  const showBasket = enableP2QuoteTools;
  const shortcutHref = quoteShortcutHref(enableP2QuoteTools);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!showBasket) return;
    const sync = () => {
      const basket = loadBasketFromStorage();
      setCount(basket.items.length);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener(QUOTE_BASKET_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener(QUOTE_BASKET_EVENT, sync);
    };
  }, [showBasket]);

  if (hidden) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-30 hidden flex-col items-end gap-2 lg:flex",
        "bottom-24 right-4",
      )}
      role="region"
      aria-label="ทางลัดติดต่อ"
    >
      <Link
        href={shortcutHref}
        className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-forest/90 px-4 py-2 text-sm font-semibold text-paper shadow-lg backdrop-blur-md transition hover:bg-forest-light"
      >
        <ShoppingBag className="h-4 w-4" aria-hidden />
        {showBasket ? `${QUOTE_BASKET_FAB} (${count})` : QUOTE_FAB_LABEL}
      </Link>
      {contact.showLine ? (
        <a
          href={site.lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-forest/15 bg-paper/90 px-4 py-2 text-sm font-semibold text-forest shadow-lg backdrop-blur-md transition hover:bg-forest-mist dark:border-white/10 dark:bg-forest-light/80 dark:text-paper"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          แชท LINE
        </a>
      ) : null}
    </div>
  );
}
