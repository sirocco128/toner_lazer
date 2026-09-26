"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { captureFirstPartyAttribution } from "@/lib/attribution";

/** Capture first-touch UTM / landing / referrer on public pages (sessionStorage). */
export function CaptureAttribution() {
  const pathname = usePathname();

  useEffect(() => {
    captureFirstPartyAttribution({
      href: window.location.href,
      referrer: document.referrer,
      pageOrigin: window.location.origin,
    });
  }, [pathname]);

  return null;
}
