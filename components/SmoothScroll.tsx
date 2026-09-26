"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Agency-grade smooth scroll. Skipped on ops, print, and reduced-motion.
 */
export function SmoothScroll() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    const isOps = pathname === "/ops" || pathname.startsWith("/ops/");
    const isCatalog = pathname === "/catalog" || pathname.startsWith("/catalog/");
    if (isOps || isCatalog) return;
    if (typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("print").matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      autoRaf: true,
    });

    return () => {
      lenis.destroy();
    };
  }, [pathname]);

  return null;
}
