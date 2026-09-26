# Strapi → Next.js revalidate webhook

`POST /api/revalidate` on the Next.js app expects a JSON body matching the contract below.
Authenticate with:

```http
Authorization: Bearer <REVALIDATE_SECRET>
Content-Type: application/json
```

`REVALIDATE_SECRET` must be at least 32 characters (same env on Next.js).

## Payload schema

```json
{
  "event": "entry.publish",
  "model": "product",
  "entry": {
    "slug": "tumbler-notebook-pen-set",
    "category": "eco-giftset"
  }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `event` | yes | Any non-empty string (e.g. `entry.publish`, `entry.unpublish`, `entry.update`) |
| `model` | yes | One of: `product`, `gift-set-category`, `article`, `faq`, `portfolio` |
| `entry` | no | Object with optional `slug` and/or `category` |
| `entry.slug` | no | Content slug; used for detail paths/tags |
| `entry.category` | no | Category slug (product model). If omitted, `entry.slug` is used as category fallback |

Max body size: **65 536** bytes.

## Example payloads

### Product published

```json
{
  "event": "entry.publish",
  "model": "product",
  "entry": {
    "slug": "tumbler-notebook-pen-set",
    "category": "eco-giftset"
  }
}
```

Revalidates paths: `/`, `/products`, `/sitemap.xml`, `/products/tumbler-notebook-pen-set`, `/giftset/eco-giftset`  
Tags: `products`, `product:tumbler-notebook-pen-set`, `category:eco-giftset`

### Gift-set category

```json
{
  "event": "entry.publish",
  "model": "gift-set-category",
  "entry": { "slug": "eco-giftset" }
}
```

### Article

```json
{
  "event": "entry.publish",
  "model": "article",
  "entry": { "slug": "how-to-choose-moq" }
}
```

### FAQ (list only)

```json
{
  "event": "entry.update",
  "model": "faq"
}
```

### Portfolio

```json
{
  "event": "entry.publish",
  "model": "portfolio"
}
```

## curl smoke test

```bash
curl -sS -X POST "https://www.example.com/api/revalidate" \
  -H "Authorization: Bearer $REVALIDATE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":"entry.publish","model":"product","entry":{"slug":"demo","category":"eco-giftset"}}'
```

Success response shape:

```json
{
  "revalidated": true,
  "paths": ["/", "/products", "/sitemap.xml", "/products/demo", "/giftset/eco-giftset"],
  "tags": ["products", "product:demo", "category:eco-giftset"],
  "now": 1710000000000
}
```

## Mapping Strapi’s default webhook

Strapi’s built-in webhook body uses different field names (`model` may be plural UID, entry nested under `entry`). Add a thin Strapi webhook customizer or middleware so the outbound body matches this document before pointing the webhook at Next.js.

Path/tag mapping is implemented in `lib/revalidate-targets.ts` (`mapRevalidateTargets`).
