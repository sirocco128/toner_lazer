"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isTaipWidgetEnabled } from "@/lib/feature-flags";

const HIDDEN_PREFIXES = ["/privacy", "/terms"];

type TaipHost = Window & {
  TrantechAI?: {
    mount: (opts: { endpoint?: string; appId?: string; title?: string; locale?: string }) => HTMLElement;
  };
};

function askUrl(): string {
  return (process.env.NEXT_PUBLIC_TAIP_ASK_URL || "http://127.0.0.1:18080/v1/ask").trim();
}

function widgetSrc(): string {
  return (
    process.env.NEXT_PUBLIC_TAIP_WIDGET_SRC ||
    "http://127.0.0.1:18080/widget/trantech-ai-chat.js"
  ).trim();
}

function mountChat(): void {
  const host = window as TaipHost;
  host.TrantechAI?.mount({
    endpoint: askUrl(),
    appId: "terabis",
    locale: navigator.language,
  });
}

export function TerabisAiWidget() {
  const pathname = usePathname() || "/";
  const enabled = isTaipWidgetEnabled();
  const hidden =
    pathname === "/ops" ||
    pathname.startsWith("/ops/") ||
    HIDDEN_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  useEffect(() => {
    if (!enabled || hidden) {
      document.querySelector("trantech-ai-chat")?.remove();
      return;
    }
    const existing = document.querySelector('script[data-terabis-taip="1"]');
    if (existing) {
      mountChat();
      return;
    }
    const script = document.createElement("script");
    script.src = widgetSrc();
    script.async = true;
    script.dataset.terabisTaip = "1";
    script.onload = () => mountChat();
    document.body.appendChild(script);
    return () => {
      document.querySelector("trantech-ai-chat")?.remove();
    };
  }, [enabled, hidden]);

  return null;
}
