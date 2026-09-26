"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ANALYTICS_CONSENT_EVENT,
  bootGoogleAnalytics,
  getGaMeasurementId,
  isAnalyticsSkippedPath,
  readAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics";

export function GoogleAnalytics() {
  const measurementId = getGaMeasurementId();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    setConsent(readAnalyticsConsent());
    function onConsent() {
      setConsent(readAnalyticsConsent());
    }
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
  }, []);

  const enabled =
    Boolean(measurementId) &&
    consent === "granted" &&
    !isAnalyticsSkippedPath(pathname);

  useEffect(() => {
    if (!enabled || !measurementId || !scriptReady) return;
    if (typeof window.gtag !== "function") return;
    const query = searchParams.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_title: document.title,
    });
  }, [enabled, measurementId, pathname, searchParams, scriptReady]);

  if (!measurementId || consent !== "granted" || isAnalyticsSkippedPath(pathname)) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        onLoad={() => {
          bootGoogleAnalytics(measurementId);
          setScriptReady(true);
        }}
      />
    </>
  );
}
