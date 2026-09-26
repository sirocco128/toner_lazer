# P1 Open Issues — Premium Gift Set Starter v1.1

Issue-style checklist for runbook §33 items that are **BLOCKED** on external business inputs.
Code prep that does not need those inputs can proceed in parallel (see [Can do in code now](#can-do-in-code-now)).

Status legend:

- `BLOCKED` = waiting on stakeholders / infra credentials / approvals
- `LOCAL DONE` = local/dev prep complete; production still blocked

---

## P1-CMS-001 — Strapi deploy

| Field | Value |
| --- | --- |
| Status | **BLOCKED** (production) / **LOCAL DONE** (dev path) |
| Runbook | §33.1 |
| Local guide | [SPRINT1-LOCAL-CMS.md](./SPRINT1-LOCAL-CMS.md) |

**Local prep DONE (Sprint 1)**

- `docker-compose.yml` Postgres 16 (`giftset`/`giftset`/`giftset`)
- `cms/` Strapi v5 skeleton + schema sync via `npm run cms:bootstrap`
- Blueprint import from `strapi/content-types/*` + `shared/seo`
- Lead SQLite `npm run backup:leads` / `restore:leads`
- Docs for `CMS_MODE=strapi`, tokens, webhook → `/api/revalidate`, `pg_dump`

**Still BLOCKED for production**

- Approved Strapi v5 hosting (dev / staging / production)
- Managed PostgreSQL credentials per environment (not local Docker)
- Admin / SSO or access-gateway policy
- Confirmation of Draft & Publish + webhook target URL on real Next.js host
- Backup/restore drill on production volumes + secret rotation

**Acceptance (short)**

- Editors can draft → preview → publish; Next.js updates via revalidate
- Unpublish removes public URLs; API token is read-only
- Backup + restore tested; secrets rotatable

**Code-ready without deploy:** schema blueprints under `strapi/`, local `cms/`, adapter + unit tests, revalidate route + webhook docs.

---

## P1-MEDIA-001 — Huawei OBS/CDN

| Field | Value |
| --- | --- |
| Status | **BLOCKED** |
| Runbook | §33.2 |

**Needed from stakeholders**

- OBS (or approved S3-compatible) bucket + IAM / AKSK
- CDN domain and TLS
- Public vs signed delivery policy; allowed origins

**Acceptance (short)**

- Strapi uploads land on OBS; public assets served via CDN
- Origins allowlisted; retention/backup strategy documented

**Code-ready without OBS:** media URL allowlist in adapter; demo `/public/images` assets; local Strapi uses `cms/public/uploads/`.

---

## P1-DATA-001 — Real content

| Field | Value |
| --- | --- |
| Status | **BLOCKED** (pending stakeholder values) |
| Runbook | §33.3 / §50 |
| Intake | [SPRINT2-CONTENT-INTAKE.md](./SPRINT2-CONTENT-INTAKE.md) |
| Migration | [SPRINT2-MIGRATION.md](./SPRINT2-MIGRATION.md) |

**Needed from stakeholders**

- Final brand name, legal name, phone, email, LINE, address, tax ID
- Licensed product / portfolio / OG / logo images
- Approved product copy, MOQ, price ranges, FAQ, blog

**Acceptance (short)**

- No demo placeholders (`GiftPro Asia`, `example.com`, `000-0000`, “ตัวอย่าง”) in production content
- Unique SEO titles/descriptions; correct canonicals; image licenses on file
- `npm run check:demo` with `STRICT_NO_DEMO=1` exits 0 after migration

**Code-ready without real content:** demo data + Strapi field contracts; env-driven site config; Sprint 2 intake/migration scaffolding (no invented production brand).

---

## P1-LEGAL-001 — Legal / PDPA

| Field | Value |
| --- | --- |
| Status | **BLOCKED** (pending stakeholder values) |
| Runbook | §33.4 / §50 |
| Intake | [SPRINT2-CONTENT-INTAKE.md](./SPRINT2-CONTENT-INTAKE.md) (Legal section) |
| Migration | [SPRINT2-MIGRATION.md](./SPRINT2-MIGRATION.md) |

**Needed from stakeholders**

- Approved Privacy Notice, Terms, cookie notice (if needed)
- Consent copy, retention schedule, DSR procedure
- Portfolio permission + incident contact

**Acceptance (short)**

- Live `/privacy` and `/terms` match approved text
- RFQ consent wording and retention align with schedule
- Template banner removed only when `LEGAL_CONTENT_APPROVED=true`

**Code-ready without legal copy:** consent checkbox + placeholder legal routes with “รออนุมัติ Legal/PDPA” banner; no non-essential cookies by default.

---

## P1-DATA-002 — RDS / Redis (multi-instance only)

| Field | Value |
| --- | --- |
| Status | **BLOCKED** (only required when scaling beyond single instance) |
| Runbook | §33.5 |

**Needed from stakeholders**

- Decision that multi-instance / HA is required
- RDS (Postgres/MySQL) + Redis endpoints and credentials
- Ops approval for migration window

**Acceptance (short)**

- Two instances accept RFQs without duplicate `request_id`
- Shared rate limit; outbox claim with `SKIP LOCKED` (or equivalent)
- SQLite → RDS migration tested

**Code-ready without RDS:** `QuoteRepository` interface + SQLite adapter (`getQuoteRepository()`); lead backup/restore scripts; Postgres impl deferred.

---

## P1-OPS-001 — Staging

| Field | Value |
| --- | --- |
| Status | **BLOCKED** (remote host) / **LOCAL DONE** (docker staging path) |
| Runbook | §33.6 |
| Guide | [STAGING-DEPLOY.md](./STAGING-DEPLOY.md) |

**Local prep DONE**

- `docker-compose.staging.yml` — web `:3001` + Postgres `:5433`
- `.env.staging.example` + `npm run sprint2:apply-intake`
- `npm run staging:up` / `staging:down` / `staging:smoke`
- GitLab manual job `staging-deploy` (preflight + deploy instructions)

**Still BLOCKED for remote staging**

- Staging domain, DNS, TLS
- Separate secrets, DB, Strapi, monitoring, backups
- Access protection (VPN / basic auth / IP allowlist)

**Acceptance (short)**

- Staging is `noindex`; webhook and health checks work against staging Next.js
- Secrets and data isolated from production

**Code-ready without staging host:** `NEXT_PUBLIC_ALLOW_INDEXING=false` default; Docker / health / env validation scripts; local CMS compose path.

---

## P1-UAT-001 — UAT

| Field | Value |
| --- | --- |
| Status | **BLOCKED** (live sign-off) / **LOCAL DONE** (checklist + automation) |
| Runbook | §33.7 |
| Checklist | [UAT-CHECKLIST.md](./UAT-CHECKLIST.md) |

**Local prep DONE**

- Role-based UAT checklist (routes, RFQ, CMS, SEO, a11y, ops)
- Pre-UAT commands: `npm run check`, `staging:smoke`, `sprint2:preflight`
- Staging demo intake: `npm run sprint2:staging-demo`

**Still BLOCKED for formal UAT**

- Named UAT participants (Marketing, Sales, Editor, Legal/DPO, IT)
- Schedule and sign-off criteria
- Access to staging + CMS

**Acceptance (short)**

- Routes, RFQ, SEO, a11y, publish/unpublish, and retry flows signed off by roles above

**Code-ready without UAT schedule:** unit / integration tests from §31; verification checklist in `VERIFICATION.md`.

---

## Can do in code now

Work that does **not** need brand, Strapi production deploy, OBS, legal text, staging hosts, or UAT calendars:

| Area | Status / notes |
| --- | --- |
| Local Strapi + Postgres (`cms/`, `docker compose`, bootstrap) | **DONE** — [SPRINT1-LOCAL-CMS.md](./SPRINT1-LOCAL-CMS.md) |
| Lead SQLite backup / restore scripts | **DONE** — `backup:leads` / `restore:leads` |
| `QuoteRepository` interface + SQLite factory | Prep for P1-DATA-002 — no RDS yet |
| Unit tests (backoff, revalidate mapping, LocalBusiness, noindex) | §31 REQUIRED TESTS (unit) |
| Strapi schema blueprints + webhook payload docs | Sync into local `cms/` via bootstrap |
| Env validation, health, Dockerfiles, migrate scripts | Sprint 0 quality gates |
| Demo content + sanitize / Strapi adapter | Safe until real CMS |
| Metadata / robots gated by `allowIndexing` | Staging-ready defaults |

Do **not** start: live Strapi **production** deploy, OBS provider wiring with real credentials, production content swap, legal page finalization, multi-instance Postgres/Redis, staging DNS cutover, or formal UAT.
