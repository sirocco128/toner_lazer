# Sprint 1 — Local CMS foundation (P1-CMS-001)

Dev/local path for Strapi v5 + Postgres. **No** Huawei OBS, production domains, or staging hosts required.

## Prerequisites

- Node 20–22 (Strapi 5; this monorepo uses Node ≥22 for Next.js)
- Docker + Docker Compose
- Repo root: Premium Gift Set Next.js app

## 1. Start Postgres

```bash
docker compose up -d postgres
# optional overlay (docs-only): docker compose -f docker-compose.yml -f docker-compose.cms.yml up -d postgres
docker compose ps
```

Credentials (local only): DB / user / password = `giftset` / `giftset` / `giftset` on port `5432`.

## 2. Bootstrap Strapi into `./cms`

A minimal Strapi v5 skeleton is committed under `cms/` (configs + schema wiring). Bootstrap syncs blueprints from `strapi/` and writes `cms/.env` if missing:

```bash
npm run cms:bootstrap
# equivalent: node scripts/bootstrap-strapi.mjs
```

What it does:

1. Starts Postgres via `docker compose up -d postgres` if port 5432 is closed
2. Ensures `./cms` exists (committed skeleton; or `create-strapi-app` if `cms/` is missing; skeleton fallback if the generator fails)
3. Copies `strapi/content-types/*/schema.json` → `cms/src/api/<uid>/content-types/<uid>/schema.json`
4. Copies `strapi/components/shared/seo.json` → `cms/src/components/shared/seo.json`
5. Ensures core controllers / routes / services factories exist
6. Prints admin / RBAC / webhook next steps

Re-run anytime after editing blueprints under `strapi/` to re-import schemas.

`SKIP_CREATE_STRAPI=1` forces the skeleton path (never calls `create-strapi-app`).

## 3. Run Strapi

```bash
cd cms
npm install
npm run develop
```

Open [http://localhost:1337/admin](http://localhost:1337/admin) and create the first admin user. Confirm Product, Gift-set-category, Article, FAQ, Portfolio, and the shared SEO component appear.

Strapi is **not** started by Docker in Sprint 1 (host Node is more reliable). See `docker-compose.cms.yml` comments.

## 4. Import schemas (if you skipped bootstrap)

```bash
# from repo root
STARTER="$(pwd)"
CMS="$STARTER/cms"

mkdir -p "$CMS/src/components/shared"
cp "$STARTER/strapi/components/shared/seo.json" "$CMS/src/components/shared/seo.json"

for uid in product gift-set-category article faq portfolio; do
  mkdir -p "$CMS/src/api/$uid/content-types/$uid"
  cp "$STARTER/strapi/content-types/$uid/schema.json" \
    "$CMS/src/api/$uid/content-types/$uid/schema.json"
done
```

Or simply: `npm run cms:bootstrap`.

## 5. Point Next.js at Strapi

In `.env.local` (see `.env.example`):

```bash
CMS_MODE=strapi
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=          # Settings → API Tokens → Read-only
STRAPI_FALLBACK_TO_MOCK=true   # optional while content is empty
REVALIDATE_SECRET=         # ≥32 random chars; shared with Strapi webhook
```

Restart `npm run dev` after changing env.

## 6. RBAC + API token

1. Settings → Users & Permissions → Roles → **Public**: grant `find` / `findOne` only as needed; deny create/update/delete.
2. Settings → API Tokens → create **Read-only** → paste into `STRAPI_API_TOKEN`.
3. Keep Draft & Publish enabled (schemas already set `draftAndPublish: true` where applicable).

## 7. Webhook → `/api/revalidate`

1. Settings → Webhooks → Create  
2. URL: `http://localhost:3000/api/revalidate` (or your Next.js origin)  
3. Header: `Authorization: Bearer <REVALIDATE_SECRET>`  
4. Events: publish / unpublish / update / delete for the models you care about  
5. Payload contract: [`strapi/templates/webhook-revalidate.md`](../strapi/templates/webhook-revalidate.md)

Strapi’s default webhook body may need a thin customizer so `model` + `entry.slug` match the Next.js route.

Smoke test:

```bash
curl -sS -X POST "http://localhost:3000/api/revalidate" \
  -H "Authorization: Bearer $REVALIDATE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":"entry.publish","model":"product","entry":{"slug":"demo","category":"eco-giftset"}}'
```

## 8. Backups

### Lead SQLite (Next.js RFQ store)

```bash
npm run backup:leads
# → .data/backups/leads-YYYYMMDD-HHMMSS.sqlite (+ .sha256)

npm run restore:leads -- .data/backups/leads-YYYYMMDD-HHMMSS.sqlite --force
```

`SQLITE_PATH` defaults to `.data/leads.sqlite`.

### Strapi Postgres

```bash
mkdir -p .data/backups
docker compose exec -T postgres pg_dump -U giftset giftset > .data/backups/strapi-$(date +%Y%m%d-%H%M%S).sql

# restore example (destructive):
# cat .data/backups/strapi-….sql | docker compose exec -T postgres psql -U giftset giftset
```

Media uploads are stored in MinIO (`terabis-public/cms/`) when `MINIO_ENDPOINT` is set. Run `npm run cms:media:minio` to copy existing `cms/public/uploads/` files. Huawei OBS/CDN remains **BLOCKED** for production — P1-MEDIA-001.

### Custom design / mockup (product flags)

In Strapi **Content Manager → Product**:

| Field | Meaning |
| --- | --- |
| `enableCustomDesign` | เปิดบล็อกออกแบบโลโก้บนหน้ารายละเอียดสินค้า |
| `customDesignPreset` | `tumbler_set` = แม่แบบกระบอกน้ำ/สมุด/ปากกา · `product_photo` = ใช้รูปสินค้าเป็นแม่แบบ |

Restart Strapi after schema sync if the fields do not appear. Seed sets `tumbler-notebook-pen-set` to enabled + `tumbler_set`.

## Status vs production

| Item | Local Sprint 1 | Production |
| --- | --- | --- |
| Postgres + Strapi app | DONE (local) | BLOCKED — hosting / secrets |
| Schema blueprints + sync | DONE | Import on real CMS |
| Webhook docs + revalidate route | DONE | Real URL + secret rotation |
| Lead SQLite backup/restore | DONE | Keep for single-instance |
| Huawei OBS / CDN | N/A locally | BLOCKED — P1-MEDIA-001 |
| Staging domain / UAT | N/A | BLOCKED — P1-OPS / P1-UAT |

See [P1-ISSUES.md](./P1-ISSUES.md).

## 9. Option A smoke — publish / revalidate (local)

Verified on 2026-09-03 with Strapi 5.52.3 + Postgres + Next.js:

1. `docker compose up -d postgres` → healthy  
2. `cd cms && npm run develop` → http://localhost:1337/admin  
3. Create first admin (or use `scripts/cms-local-setup.mjs` after admin exists)  
4. Enable Public `find` / `findOne` for product, gift-set-category, article, faq, portfolio  
5. Create API token → `.env.local` (`CMS_MODE=strapi`, `STRAPI_URL`, `STRAPI_API_TOKEN`, `REVALIDATE_SECRET` ≥32)  
6. Seed FAQs via Content Manager or API  
7. Restart Next (`npm run build && npm run start`)  

```bash
curl -sS http://127.0.0.1:1337/api/faqs
curl -sS -X POST http://127.0.0.1:3000/api/revalidate \
  -H "Authorization: Bearer $REVALIDATE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":"entry.publish","model":"faq"}'
# → {"revalidated":true,"paths":["/premium-giftset"],"tags":["faqs"],...}
```

Helper: `CMS_ADMIN_EMAIL=... CMS_ADMIN_PASSWORD=... npm run cms:setup`  
Local admin credentials (if used) belong in `.env.cms.local` only — never commit.

### Seed full demo catalog

```bash
npm run cms:seed
```

Creates/publishes: 4 categories · 5 products · 6 FAQs · 3 portfolios · 2 articles (+ media uploads).  
Idempotent by slug (FAQs replaced each run).

### SEO plugin (editor helper)

```bash
cd cms && npm install @strapi-community/plugin-seo
# enabled in cms/config/plugins.ts → seo.enabled
```

- Admin menu **SEO** → overview + SERP / social preview on Product / Category / Article
- Component `shared.seo` uses plugin field names (`metaTitle`, `canonicalURL`, …)
- Next.js still builds metadata + JSON-LD via adapter (`metaTitle` → `seoTitle`); do **not** put production structured data only in CMS `structuredData` JSON
