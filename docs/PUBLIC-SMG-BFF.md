# Public SMG BFF — smg-ui ↔ smartgift.next-dev.net

Browser-facing adapters for the SmartGift Vite SPA (`smg-ui`).  
Ops console stays at `/ops/*` on this same host — unchanged.

**Fixed backend base:** `https://smartgift.next-dev.net`

OpenAPI: [`public-smg-bff.openapi.yaml`](./public-smg-bff.openapi.yaml)

Partner machine API (API key, **no CORS**) remains [`PARTNER-API.md`](./PARTNER-API.md).

## Enable CORS

Comma-separated browser origins allowed to call `/api/public/*`:

```
PUBLIC_SMG_ORIGINS=https://smartgift.next-dev.net,http://localhost:8080
```

In non-production, localhost Vite/Nginx ports `8080` / `5173` / `4173` are allowed automatically.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/public` | Discovery |
| POST | `/api/public/brief` | `smartgift-brief/1` → quote intake → `/ops/quotes` |
| GET | `/api/public/catalog/products` | Public-safe gift-set browse (no prices) |
| GET | `/api/public/catalog/promotions` | Clearance / promo carousel |
| GET | `/api/public/catalog/retail` | SKUs with `sellPriceThb` |

Rate limit: same bucket machinery as public lookups (`LOOKUP_RATE_LIMIT_MAX`).

Successful brief response includes `requestId`, `messageTh`, and `nextSteps` for the SPA success screen. Ops lists those leads under `/ops/quotes` with a **SmartGift เว็บ** badge.
## smg-ui env

```
VITE_BRIEF_ENDPOINT=https://smartgift.next-dev.net/api/public/brief
```

Catalog (optional; static JSON can stay until cutover):

```
VITE_CATALOG_BFF=https://smartgift.next-dev.net/api/public/catalog
```

## Brief contract (`smartgift-brief/1`)

Required: `schema`, `contact.name`, `contact.email`, `contact.phone`, `consent: true`, and quantity via `brief.qty` or sum of `lines[].qty`.

| smg-ui | Quote field | Rule |
|--------|-------------|------|
| `contact.name` | `name` | ≥2 |
| `contact.company` | `company` | empty → `ไม่ระบุ` |
| `contact.email` | `email` | required |
| `contact.phone` | `phone` | Thai digits |
| `brief.qty` / lines | `quantity` | int ≥1 |
| `consent` | `consent` | must be true |
| lines / notes / brief | `detail` + `productInterest` | capped |
| first slug-like `lines[].code` | `productSlug` | optional |
| — | `decorationMethod` | `not-sure` |
| `page_url` | `landingPath` | path+hash |
| `source` | `utmSource` | default `smg-ui` |

Success:

```json
{ "ok": true, "requestId": "RFQ-…", "opsPath": "/ops/quotes/RFQ-…" }
```

## Catalog field mapping

Same serializers as Partner `catalog:read` (see Partner OpenAPI), without Bearer auth:

| Endpoint | Key fields for smg-ui |
|----------|------------------------|
| `/products` | `offerCode`, `slug`, `name`, `description`, `material`, `categorySlug`, `images[]`, `leadDays`, `components[]` |
| `/promotions` | `productId`, `slug`, `nameTh`, `images[]`, `tags`, `clearanceReason` |
| `/retail` | `productId`, `slug`, `nameTh`, `sellPriceThb`, `currency`, `images[]` |

## Verify

```bash
curl -sS https://smartgift.next-dev.net/api/public
curl -sS -X POST https://smartgift.next-dev.net/api/public/brief \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:8080' \
  -d '{"schema":"smartgift-brief/1","consent":true,"brief":{"qty":10},"contact":{"name":"ทดสอบ ระบบ","email":"test@example.com","phone":"0812345678"}}'
```

Then open `https://smartgift.next-dev.net/ops/quotes`.
