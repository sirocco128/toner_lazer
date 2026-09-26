/** Client- and server-safe feature flag helpers (NEXT_PUBLIC_* only).
 *  Keep `process.env.NEXT_PUBLIC_*` as a static member access so Next.js
 *  inlines the same compile-time value into the client bundle and SSR.
 */

const P2_QUOTE_TOOLS_RAW = (
  process.env.NEXT_PUBLIC_ENABLE_P2_QUOTE_TOOLS || "true"
)
  .trim()
  .toLowerCase();

const BUYER_ASSISTANT_RAW = (
  process.env.NEXT_PUBLIC_ENABLE_BUYER_ASSISTANT || "true"
)
  .trim()
  .toLowerCase();

const TAIP_WIDGET_RAW = (process.env.NEXT_PUBLIC_TAIP_WIDGET || "")
  .trim()
  .toLowerCase();

function isOn(raw: string): boolean {
  return raw !== "0" && raw !== "false" && raw !== "off";
}

export function isP2QuoteToolsEnabled(): boolean {
  return isOn(P2_QUOTE_TOOLS_RAW);
}

export function isBuyerAssistantEnabled(): boolean {
  return isOn(BUYER_ASSISTANT_RAW);
}

export function isTaipWidgetEnabled(): boolean {
  return (
    TAIP_WIDGET_RAW === "1" ||
    TAIP_WIDGET_RAW === "true" ||
    TAIP_WIDGET_RAW === "on"
  );
}
