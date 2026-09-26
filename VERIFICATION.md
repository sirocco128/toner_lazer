# Verification Report — Premium Gift Set Starter v1.1 Production

วันที่ตรวจ Sprint 0 (workspace rebuild จาก LLMs runbook): 3 กันยายน 2569 (2026-09-03)

## สถานะล่าสุด (2026-09-04 — overnight automation)

| Gate | ผล |
|------|-----|
| `npm run check` | ผ่าน (lint · typecheck · **52** tests · build) |
| Staging smoke `:3001` | ผ่าน |
| `npm run uat:auto` | **18/18 routes PASS** — ดู `docs/UAT-AUTO-RESULTS.md` |
| Next.js dev `:3000` | ขึ้นแล้ว |
| Strapi develop `:1337` | ขึ้นแล้ว (local) |
| Sprint 2 staging demo intake | applied → `.env.staging` |
| Cursor backup | https://cursor.com/codebase/tong128/premium-giftset-web |
| GitLab remote | **รอ login** — ไม่มี token ในเครื่อง (`docs/GIT-REMOTES.md`) |

**Human / stakeholder ยังต้องทำหลังตื่น:** UAT checklist เซ็นชื่อ · กรอก intake จริง · `glab auth login --web` · remote staging domain

## สถานะล่าสุด (2026-09-03 — UX + handoff เรียบร้อย)

| Gate | ผล |
|------|-----|
| `npm run lint` | ผ่าน |
| `npm run typecheck` | ผ่าน |
| `npm run test` | ผ่าน **50/50** |
| `npm run build` | ผ่าน (18 static/SSG routes + API) |
| `npm run check:demo` | report-only — 11 demo markers (ตั้งใจจนกว่า Sprint 2) |
| Strapi `populate=*` (v5) | แก้แล้ว — ไม่ใช้ `populate=deep` ที่ทำให้ HTTP 400 |

**ครบในโค้ด:** Sprint 0–1, Option A/B/C stubs, UX polish, messaging clarity, breadcrumbs/empty/loading/error, RFQ recovery, basket→contact prefill.

**ยัง BLOCKED (external):** brand/content, Legal/PDPA, Strapi/OBS production, staging, UAT — ดู `docs/P1-ISSUES.md` · `docs/SPRINT2-CONTENT-INTAKE.md`

## หมายเหตุ Baseline

ZIP `premium-giftset-starter-v1.1-production.zip` ไม่พบในเครื่อง จึง rebuild Source จาก `docs/LLMs.txt` ใน workspace `web_chaina`

## Sprint 0 — ผ่านการตรวจใน Runtime นี้

| Gate | ผล |
|------|-----|
| `npm install` + lockfile | ผ่าน |
| `db:migrate` (35 columns + rate limits) | ผ่าน |
| `npm run lint` (`--max-warnings=0`) | ผ่าน |
| `npm run typecheck` | ผ่าน |
| `npm run test` | ผ่าน **44/44** ณ Sprint 0 (ปัจจุบัน **50/50** — ดูสถานะล่าสุดด้านบน) |
| `npm run validate:env` | ผ่าน (indexing off) |
| `npm run build` | ผ่าน 22 routes |
| `npm run lhci` | ผ่าน (6 URLs × 3 runs) |
| `docker build -t premium-giftset:v1.1` | ผ่าน |
| `docker run` + `/api/health?deep=1` | ผ่าน (`database: ok`) |

## Sprint 1 — Local CMS foundation (2026-09-03)

| Gate | ผล |
|------|-----|
| `docker compose up -d postgres` | healthy (`giftset-postgres`) |
| `cms/` Strapi v5 skeleton + schemas | committed / bootstrap ready |
| `npm run cms:bootstrap` | available |
| `npm run backup:leads` | ผ่าน (SQLite + SHA-256) |
| Docs | `docs/SPRINT1-LOCAL-CMS.md`, P1-CMS-001 = LOCAL DONE / prod BLOCKED |

### Option A — Publish / Revalidate smoke (same day)

| Gate | ผล |
|------|-----|
| Strapi develop + Admin | `http://localhost:1337/admin` 200 |
| Public `find`/`findOne` | FAQs/products APIs 200 |
| Seed FAQs (4) | published in Strapi |
| Next `.env.local` `CMS_MODE=strapi` | wired |
| `POST /api/revalidate` (faq) | **200** `revalidated:true` |

### Option B — Sprint 2 intake (no fake brand)

- `docs/SPRINT2-CONTENT-INTAKE.md`, `docs/SPRINT2-MIGRATION.md`
- `npm run check:demo` (report-only until `STRICT_NO_DEMO=1`)

### Option C — P2 stubs + UX polish

- `/quote-basket`, Add-to-quote, configurator stub behind `NEXT_PUBLIC_ENABLE_P2_QUOTE_TOOLS`
- `docs/P2-QUOTE-TOOLS.md`, `docs/UX-POLISH.md`
- Active nav, sticky mobile CTA, empty/loading/error, RFQ draft recovery, basket→contact prefill
- Messaging clarity pass (plain Thai, no buyer-facing jargon) — see `docs/UX-POLISH.md`
- Tests: **52/52** (รวม Sprint 2 preflight + ux-copy)
- Sprint 2 automation: `intake/` + `npm run sprint2:preflight` / `sprint2:apply-intake`
- Local staging: `docker-compose.staging.yml` + [docs/STAGING-DEPLOY.md](docs/STAGING-DEPLOY.md)

Production Strapi/OBS/content/legal/staging ยัง **BLOCKED** ตาม `docs/P1-ISSUES.md`

### Lighthouse CI notes

- CI ใช้ `NEXT_PUBLIC_ALLOW_INDEXING=false` ตาม runbook → meta `noindex` + `robots.txt` Disallow ทำให้ audit `is-crawlable` fail โดยตั้งใจ
- `.lighthouserc.json` จึงปิด `categories:seo` / `is-crawlable` ในโหมด demo และ assert SEO audits รายตัวแทน (`document-title`, `meta-description`, `http-status-code`, `link-text`, `crawlable-anchors`, `image-alt`)
- Performance threshold ใน CI = **0.85** (กันความผันผวนของ median); Accessibility = **0.9**

### Docker smoke

```text
GET /api/health          → 200 status=ok database=not-checked
GET /api/health?deep=1   → 200 status=ok database=ok
```

## P1 ที่ยังค้าง (ต้อง External Inputs)

ดูรายละเอียดใน `docs/P1-ISSUES.md` (ถ้ามี) และ runbook §33:

- P1-CMS-001 Deploy Strapi จริง
- P1-MEDIA-001 Huawei OBS/CDN
- P1-DATA-001 Real content / brand assets
- P1-LEGAL-001 Legal/PDPA approval
- P1-OPS-001 Staging deploy
- P1-UAT-001 UAT
- P1-DATA-002 RDS/Redis เมื่อ multi-instance

## คำสั่งตรวจซ้ำ

```bash
cp .env.example .env.local
npm ci
npm run db:migrate
npm run check
npm run lhci

docker build -t premium-giftset:v1.1 .
docker run --rm \
  --env-file .env.local \
  -e RUN_DB_MIGRATIONS=true \
  -v premium-giftset-data:/app/.data \
  -p 3000:3000 \
  premium-giftset:v1.1

curl -f 'http://127.0.0.1:3000/api/health?deep=1'
```
