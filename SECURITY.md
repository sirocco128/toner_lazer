# Security — Premium Gift Set Starter v1.1

Summary of the security baseline (runbook §25). Full detail lives in `docs/LLMs.txt`.

## Headers

- Content-Security-Policy (self-first; `unsafe-inline` / `unsafe-eval` only where required for Next.js/dev)
- Referrer-Policy: `strict-origin-when-cross-origin`
- X-Content-Type-Options: `nosniff`
- X-Frame-Options: `DENY`
- X-DNS-Prefetch-Control: `off`
- X-Permitted-Cross-Domain-Policies: `none`
- Cross-Origin-Opener-Policy: `same-origin`
- Permissions-Policy disables camera, microphone, geolocation, payment, usb, browsing-topics
- Strict-Transport-Security when `NODE_ENV=production` and site URL is HTTPS
- `poweredByHeader=false`

## Input and content

- Zod validation at RFQ and CMS boundaries
- Control-character stripping and whitespace normalization
- CMS media origin allowlist (`STRAPI_URL` + `NEXT_IMAGE_REMOTE_URLS`)
- No raw CMS HTML injection (safe article block renderer)
- JSON-LD escaping
- Slug/canonical validation
- Bounded revalidation payloads
- Timing-safe bearer secret comparison
- Client IP stored as HMAC-SHA256 hash only

## Secrets (never commit)

- `STRAPI_API_TOKEN`
- `REVALIDATE_SECRET`
- `IP_HASH_SECRET`
- `QUOTE_WEBHOOK_SECRET`
- `CRON_SECRET`
- `PARTNER_API_KEY`
- `ALIBABA_APP_SECRET`
- `ALIBABA_ACCESS_TOKEN`
- `GOOGLE_CLIENT_SECRET`
- `GMAIL_APP_PASSWORD`

1688/Alibaba credentials and landed-cost flags are server-only (never `NEXT_PUBLIC_*`). Catalog images stay on `STRAPI_URL` + `NEXT_IMAGE_REMOTE_URLS`; alicdn URLs are not public unless both `ALIBABA_PUBLIC_IMAGES` and `ALIBABA_IMAGES_LICENSED` are true. Ops Gemini search stores copies under `.data/catalog-images/` and serves them only to authenticated `/ops` sessions via `/api/ops/catalog-images/*`.

## Lead / PII data

SQLite stores name, company, email, phone, project detail, and attribution. Production requirements:

- Encrypted persistent volume
- Restricted filesystem permissions
- Encrypted backups
- Retention schedule and deletion / DSR workflow
- Access logging and least privilege

## Abuse and threat controls

| Threat | Control |
| --- | --- |
| Spam/bot | Honeypot, minimum form time, rate limit |
| Prompt injection / AI overreach | Mockup + chat refuse jailbreaks; factory CNY / 1688 never in public answers |
| CMS XSS | Safe block model, plain-text conversion |
| Unauthorized revalidation | Bearer secret, allowlisted models/paths, payload limit |
| Partner API scrape | `/api/partner` skipped in scrape-guard; Bearer API key + scopes |
| Partner API key leak | Secrets hashed at rest (`partner_api_keys`); env bootstrap optional |
| Webhook duplicates | Idempotency-Key + transactional status |
| Lead loss | Persist before webhook + outbox retry |
| IP spoofing | Trusted reverse proxy must overwrite client IP headers |
| Demo indexing | noindex default + build/runtime guards |
| Secret in image layers | Builder-only Strapi token; not copied into runner |

## Production posture

Fail closed under `RUNTIME_STRICT=true` or when indexing is enabled. Do not open the container directly to the internet without a reverse proxy that sanitizes forwarding headers.
