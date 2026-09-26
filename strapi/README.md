# Strapi blueprints (not a runnable app)

This folder ships **content-type and component JSON schemas only** for Premium Gift Set Starter v1.1.

For the **local/dev runnable CMS**, use the committed `cms/` app and [docs/SPRINT1-LOCAL-CMS.md](../docs/SPRINT1-LOCAL-CMS.md).

## Status

- **NOT** a complete Strapi v5 project (schemas only)
- Runnable local CMS: `./cms` (bootstrapped via `npm run cms:bootstrap`)
- No production hosting, OBS media provider, or secrets here

## Layout

```text
strapi/
├── content-types/
│   ├── product/schema.json
│   ├── gift-set-category/schema.json
│   ├── article/schema.json
│   ├── faq/schema.json
│   └── portfolio/schema.json
├── components/
│   └── shared/seo.json
├── templates/
│   └── webhook-revalidate.md
└── README.md
```

## Local path (Sprint 1) — preferred

```bash
# from repo root
docker compose up -d postgres
npm run cms:bootstrap   # syncs these blueprints into cms/src/...
cd cms && npm install && npm run develop
```

Full steps (Next.js `CMS_MODE=strapi`, webhook, backups): **[docs/SPRINT1-LOCAL-CMS.md](../docs/SPRINT1-LOCAL-CMS.md)**.

## Bootstrap (manual copy-paste)

Run these on a machine that will host Strapi (or use `npm run cms:bootstrap` instead).

### 1. Create a Strapi v5 app

```bash
# Node 20+ recommended for Strapi v5
npx create-strapi-app@latest premium-giftset-cms \
  --non-interactive --typescript --no-run --skip-cloud --no-example --no-git-init \
  --dbclient=postgres --dbhost=127.0.0.1 --dbport=5432 \
  --dbname=giftset --dbusername=giftset --dbpassword=giftset --dbssl=false
cd premium-giftset-cms
```

For production, prefer PostgreSQL/MySQL when creating the app (do not use Quickstart SQLite).

### 2. Import shared SEO component

```bash
# From the Next.js starter repo root (this project):
STARTER="$(pwd)"
CMS="/absolute/path/to/premium-giftset-cms"

mkdir -p "$CMS/src/components/shared"
cp "$STARTER/strapi/components/shared/seo.json" \
  "$CMS/src/components/shared/seo.json"
```

### 3. Import content-type schemas

Strapi v5 API content-types live under `src/api/<uid>/content-types/<uid>/schema.json`.

```bash
for uid in product gift-set-category article faq portfolio; do
  mkdir -p "$CMS/src/api/$uid/content-types/$uid"
  cp "$STARTER/strapi/content-types/$uid/schema.json" \
    "$CMS/src/api/$uid/content-types/$uid/schema.json"
done
```

If `create-strapi-app` already generated empty APIs, overwrite only the `schema.json` files (keep any generated `controllers` / `routes` / `services` Strapi created).

### 4. First run + Admin

```bash
cd "$CMS"
npm run develop
# Open Admin URL, create the first admin user
```

Confirm content-types appear in Content-Type Builder / Content Manager.

### 5. RBAC + API token (production checklist)

1. Settings → Users & Permissions → Roles → **Public**: grant only `find` / `findOne` on published collections as required; deny create/update/delete.
2. Settings → API Tokens → create a **Read-only** token for Next.js (`STRAPI_API_TOKEN`).
3. Enable **Draft & Publish** on each collection (schemas already set `draftAndPublish: true` where applicable).

### 6. Webhook → Next.js revalidate

1. Settings → Webhooks → Create.
2. URL: `https://<your-next-host>/api/revalidate`
3. Headers: `Authorization: Bearer <REVALIDATE_SECRET>` (same value as Next.js `REVALIDATE_SECRET`, ≥32 chars).
4. Events: Entry publish / unpublish / update / delete for the models you care about.
5. Payload shape: see [`templates/webhook-revalidate.md`](./templates/webhook-revalidate.md).

Strapi’s default webhook body may need a small custom middleware or webhook template so `model` and `entry.slug` match what `/api/revalidate` expects. Use the documented JSON contract as the target.

### 7. Point Next.js at Strapi

```bash
# In Next.js .env.local / staging / production
CMS_MODE=strapi
STRAPI_URL=https://cms.example.com
STRAPI_API_TOKEN=...          # read-only
REVALIDATE_SECRET=...         # ≥32 chars, shared with Strapi webhook
```

See `docs/LLMs.txt` §17 and §33.1 for field contracts and production CMS requirements. Open issues: `docs/P1-ISSUES.md` (P1-CMS-001). Local prep: `docs/SPRINT1-LOCAL-CMS.md`.
