# Staging deploy — P1-OPS-001 local path

Local **staging stack** for UAT and Sprint 2 cutover rehearsal. Production host/DNS/TLS still require IT — this doc covers what is automated in-repo.

Related: [P1-OPS-001](./P1-ISSUES.md#p1-ops-001--staging) · [SPRINT2-MIGRATION.md](./SPRINT2-MIGRATION.md) · [SPRINT1-LOCAL-CMS.md](./SPRINT1-LOCAL-CMS.md)

---

## What staging includes (local)

| Component | Port | Notes |
| --- | --- | --- |
| Next.js (`web`) | **3011** | Docker image from root `Dockerfile` (was 3001; remapped to avoid local port clashes) |
| Postgres | **5439** | `giftset_staging` DB — separate from other local Postgres (was 5433) |
| Strapi | 1337 (host) | Optional — run from `./cms` against staging Postgres or dev Postgres |

Rules enforced:

- `NEXT_PUBLIC_ALLOW_INDEXING=false` (always for staging)
- Demo/legal banners until intake gates pass
- Isolated SQLite lead volume (`giftset_staging_leads`)

---

## Quick start (demo staging)

```bash
cp .env.staging.example .env.staging
# Edit secrets: REVALIDATE_SECRET, IP_HASH_SECRET (≥32 chars each)

docker compose -f docker-compose.staging.yml up -d --build
npm run staging:smoke
```

Open [http://localhost:3011](http://localhost:3011)

Stop:

```bash
docker compose -f docker-compose.staging.yml down
```

---

## Sprint 2 cutover on staging

1. Stakeholders fill `intake/sprint2-intake.json` (copy from template).
2. Import/publish content in Strapi (order in [SPRINT2-MIGRATION.md](./SPRINT2-MIGRATION.md)).
3. Preflight:

```bash
npm run sprint2:preflight
npm run sprint2:preflight -- --strict
STRICT_NO_DEMO=1 npm run check:demo
```

4. Generate staging env from **APPROVED** intake only:

```bash
npm run sprint2:apply-intake -- --target .env.staging
```

5. Rebuild and smoke:

```bash
docker compose -f docker-compose.staging.yml up -d --build
npm run staging:smoke
```

6. Manual UAT checklist → [P1-UAT-001](./P1-ISSUES.md#p1-uat-001--uat)

**Do not** enable indexing on staging until legal + assets are approved.

---

## Strapi on staging

Option A — **same machine, host Strapi** (default):

```bash
docker compose -f docker-compose.staging.yml up -d postgres
# Point cms/.env DATABASE_* to localhost:5439 / giftset_staging
npm run cms:bootstrap
cd cms && npm run develop
```

Set in `.env.staging`:

```bash
CMS_MODE=strapi
STRAPI_URL=http://host.docker.internal:1337
STRAPI_API_TOKEN=<read-only token>
STRAPI_FALLBACK_TO_MOCK=false
```

Option B — **mock CMS** until Strapi staging exists (`CMS_MODE=mock`, default in `.env.staging.example`).

---

## Remote staging (IT / DevOps)

When IT provides domain + registry:

| Item | Action |
| --- | --- |
| DNS + TLS | e.g. `staging.example.com` → load balancer |
| Secrets | GitLab CI/CD variables or secret manager — never commit `.env.staging` |
| Registry | Push image from `container-image` job (configure `CI_REGISTRY_*`) |
| Access | VPN / basic auth / IP allowlist in front of staging |
| Monitoring | Health `GET /api/health?deep=1`, log shipping |
| noindex | Keep `NEXT_PUBLIC_ALLOW_INDEXING=false` |

GitLab: manual job **`staging-deploy`** (see `.gitlab-ci.yml`) — runs preflight + build artifact smoke instructions.

---

## Health checks

```bash
curl -fsS http://127.0.0.1:3011/api/health
curl -fsS 'http://127.0.0.1:3011/api/health?deep=1'
```

Expected: `status: ok`, `database: ok` on deep check after migrations.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Port 3011 in use | Change host port in `docker-compose.staging.yml` |
| Strapi 400 from web container | Use `populate=*` (fixed in v1.1.x); check token |
| Empty catalog on staging | Publish content in Strapi or set `STRAPI_FALLBACK_TO_MOCK=true` |
| `apply-intake` refuses | Fields must be `status: APPROVED` with non-empty values |
