# P2 Quote Tools — Target Design Stubs

Feature-flagged **Option C** stubs for runbook §34 (Quote Basket) and §35 (Product Configurator). These are **TARGET designs**, not production checkout.

## Feature flag

```bash
# Optional — when unset, code defaults to enabled (see lib/feature-flags.ts).
NEXT_PUBLIC_ENABLE_P2_QUOTE_TOOLS=true
```

| Value | Behavior |
| --- | --- |
| unset / `true` (**code default**) | Interactive stubs: localStorage basket, Add to Quote, Configurator form. Nav shows “ตะกร้าใบเสนอราคา”. |
| `false` / `0` / `off` | `/quote-basket` shows Thai “ยังไม่พร้อม” + link to `/contact`. Nav link hidden. Product / customize pages stay as v1.1. |

Set in `.env.local` (or deploy env). Staging often sets `false` explicitly — see `.env.staging.example`. Restart Next.js after changing `NEXT_PUBLIC_*`.

These remain **localStorage-only stubs**, not a server basket.

## What exists (stubs)

### Quote Basket (§34)

- Types: `lib/quote-basket-types.ts`
- Client helpers: `lib/quote-basket.ts` — create / add / remove / qty, basket id, approximate sum from `priceMin`/`priceMax`, persist to `localStorage` only
- UI: `components/QuoteBasketPanel.tsx`, `components/AddToQuoteButton.tsx`
- Route: `/quote-basket`
- CTA “ส่งคำขอใบเสนอราคา” → `/contact` with query/note (manual RFQ). **Basket merge into RFQ is still P2.**

### Product Configurator (§35)

- Types: `lib/product-configurator-types.ts` (optional dimension fields)
- UI: `components/ProductConfiguratorStub.tsx` — decoration, packaging, quantity, needed date (+ light extras)
- Mounted under `/customize-gift-set` when the flag is on
- **Does not invent prices or final lead times**

## Non-goals (explicit)

- No payment / shopping cart checkout
- No ERP / NextERP pricing or stock truth
- No server-side basket API, shareable token links, or PII storage before RFQ submit
- No formal quote PDF or tier pricing engine (§36)
- No logo upload / mockup (§37)
- Approximate ranges always carry a Thai disclaimer that they are estimates only

## Security note (future production)

Production basket design requires random tokens (hash at rest), expiry, rate limits, and no PII before submit. This stub keeps drafts in the browser only.
