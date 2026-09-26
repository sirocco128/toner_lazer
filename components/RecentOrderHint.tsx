"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  parseRecentOrderHint,
  recentOrderHref,
  RECENT_ORDER_STORAGE_KEY,
  type RecentOrderHint as Hint,
} from "@/lib/customer-session";
import { RECENT_ORDER_HINT } from "@/lib/ux-copy";
import { cn } from "@/lib/utils";

type Variant = "hub" | "menu" | "footer";

export function RecentOrderHint({
  variant = "hub",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const [hint, setHint] = useState<Hint | null>(null);

  useEffect(() => {
    try {
      setHint(parseRecentOrderHint(sessionStorage.getItem(RECENT_ORDER_STORAGE_KEY)));
    } catch {
      setHint(null);
    }
  }, []);

  if (!hint) return null;

  const href = recentOrderHref(hint);

  if (variant === "hub") {
    return (
      <p
        className={cn(
          "rounded-2xl border border-brass/35 bg-brass/10 px-4 py-3 text-sm text-forest",
          className,
        )}
      >
        <Link href={href} className="font-semibold underline-offset-2 hover:underline">
          {RECENT_ORDER_HINT}
        </Link>
        <span className="mt-0.5 block font-mono text-xs text-ink/60">{hint.orderId}</span>
      </p>
    );
  }

  if (variant === "footer") {
    return (
      <li>
        <Link
          href={href}
          className={cn("text-paper/85 hover:text-brass-soft", className)}
        >
          {RECENT_ORDER_HINT}
          <span className="block font-mono text-xs text-paper/55">{hint.orderId}</span>
        </Link>
      </li>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg px-3 py-3 text-base font-medium text-ink hover:bg-forest-mist",
        className,
      )}
    >
      {RECENT_ORDER_HINT}
      <span className="block font-mono text-xs font-normal text-ink/55">
        {hint.orderId}
      </span>
    </Link>
  );
}
