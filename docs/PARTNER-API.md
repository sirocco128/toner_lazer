# Partner REST API v1

Read-only machine API for CRM / n8n / ERP / external storefront BFF to **pull current state**.  
Webhook (`quote.requested`) still **pushes** new RFQs. This API does not replace it.

For **browser** smg-ui (CORS, no API key) use [`PUBLIC-SMG-BFF.md`](./PUBLIC-SMG-BFF.md) on `https://smartgift.next-dev.net` instead — `/api/public/brief` + `/api/public/catalog/*`.

**OpenAPI / Swagger:** [`docs/partner-api.openapi.yaml`](./partner-api.openapi.yaml)  
Import into [Swagger Editor](https://editor.swagger.io/) or any OpenAPI 3 viewer.

Auth is **API key**, not `/ops` session cookies.

## Enable

Pick one:

1. Env bootstrap (local / first partner)

```
PARTNER_API_KEY=<at-least-32-random-chars>
PARTNER_API_SCOPES=quotes:read,orders:read,catalog:read
PARTNER_API_RATE_LIMIT_MAX=120
```

2. Hashed key in SQLite (preferred after migrate)

```bash
npm run db:migrate
npm run partner:key -- --name n8n
```

The script prints `Authorization: Bearer sgp_<keyId>.<secret>` once.

## Endpoints

All require `Authorization: Bearer …`. No CORS — server-to-server / BFF only.

| Method | Path | Scope |
|--------|------|--------|
| GET | `/api/partner/v1` | any read scope (discovery) |
| GET | `/api/partner/v1/quotes?updated_since=&cursor=&limit=` | `quotes:read` |
| GET | `/api/partner/v1/quotes/{requestId}` | `quotes:read` |
| GET | `/api/partner/v1/orders?updated_since=&cursor=&limit=` | `orders:read` |
| GET | `/api/partner/v1/orders/{orderId}` | `orders:read` |
| GET | `/api/partner/v1/products?q=&category=&limit=` | `catalog:read` |
| GET | `/api/partner/v1/promotions?limit=` | `catalog:read` |
| GET | `/api/partner/v1/retail?q=&limit=` | `catalog:read` |

### Quotes / orders lists

List pages are oldest-first (`updated_at ASC`). Follow `nextCursor` until it is `null`.  
`limit` default 50, max 100.

### Catalog (`catalog:read`)

For another frontend BFF. Image paths are absolute (`NEXT_PUBLIC_SITE_URL`).

| Path | Purpose | `limit` |
|------|---------|---------|
| `/products` | All gift-set offers — **no** factory/ORI codes, MOQ, or prices | default 100, max 500 |
| `/promotions` | Clearance (`stock_class=C`) ∪ tag `promo`; `images[]` + `onHandQty` | default 100, max 500 |
| `/retail` | SKUs with `sell_price_thb > 0`; `images[]` + `onHandQty` | default 100, max 500 |

## Never returned

`accessToken`, `ipHash`, `userAgent`, `rawPayload`, `salesNotes`, `qrPayload`, factory CNY / 1688 cost, ORI factory product codes, MOQ / `forced_min_qty`, and (on `/products`) any sell ladder / price fields.

## Status

| HTTP | Meaning |
|------|---------|
| 401 | missing / bad key |
| 403 | key valid, scope missing |
| 404 | unknown id |
| 429 | rate limited |
| 503 | no `PARTNER_API_KEY` and no enabled DB keys, or catalog MySQL unavailable |
