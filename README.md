# toner_lazer — ระบบขายหมึกเลเซอร์เทียบเท่าสำหรับองค์กรและหน่วยงานรัฐ

B2B Portal + backoffice สำหรับธุรกิจตลับหมึกเลเซอร์เทียบเท่า (private label, ซัพพลายเออร์ Color Fly แบบ dropship)
ต่อยอดจาก `premium-giftset-web` ([sirocco128/mcp-alibaba](https://github.com/sirocco128/mcp-alibaba)) และส่งข้อมูลเข้า **NEXTERP** เป็นศูนย์กลางข้อมูลของกลุ่ม

## สถานะ

| ส่วน | สถานะ |
|------|--------|
| Baseline จาก premium-giftset-web (quote, order, ลูกค้า, เอกสารภาษีไทย, PromptPay, LINE OA, ops console) | ✅ นำเข้าแล้ว |
| แคตตาล็อกโทนเนอร์ 11 รุ่น (HP / Brother / Samsung) + ราคา 3 ระดับ | ✅ `lib/toner-catalog.ts` |
| ค้นหาตลับจากรุ่นเครื่องพิมพ์ / รหัสตลับ | ✅ `findToner()` |
| ส่งหมวดและสินค้าเข้า NEXTERP (MySQL) | ✅ `npm run toner:nexterp` |
| แสดงสินค้าโทนเนอร์จาก NEXTERP บนเว็บ (ราคาเดียว, สั่งขั้นต่ำ 1 ตลับ) | ✅ `lib/nexterp-products.ts` |
| หน้าเว็บเปลี่ยนเป็น Toner Lazer + หน้าค้นหาหมึกตามรุ่นเครื่อง `/toner` | ✅ หน้าของขวัญเดิม redirect ไป `/toner` |
| ใบสั่งส่งตรง (dropship) ไป Color Fly `/ops/dropship` + CSV | ✅ |
| ขายเชื่อ/เครดิตภาครัฐ (ไม่เก็บมัดจำ, วางบิลและออกใบกำกับภาษีเมื่อส่งของ) | ✅ วิธีชำระ "credit" ในหน้าเปิดออเดอร์ |
| รายงานลูกหนี้ตามอายุหนี้ `/ops/receivables` | ✅ |
| โมดูลของขวัญในหลังบ้าน (mockup, 1688, ผู้ช่วย AI, ฉลาก Smart Gift ใน ops) | ⏳ ยังอยู่ ซ่อนจากหน้าเว็บแล้ว |
| Tender Tracker (e-GP), SNMP monitoring, Cost-per-Page | ⏳ เฟสถัดไป |
| ย้ายฐานข้อมูลหลักจาก SQLite ไป MySQL | ⏳ ก่อนขึ้น production |

## ก่อนขึ้น production

- ตั้ง `COMPANY_LEGAL_NAME`, `COMPANY_TAX_ID`, `COMPANY_STREET_ADDRESS` ฯลฯ เป็นนิติบุคคลที่ขายหมึกจริง — ถ้าไม่ตั้ง ใบกำกับภาษีจะออกในนามบริษัท เทราบิส จำกัด (ค่าเดิมของโปรเจกต์ต้นทาง)
- ปิดบัญชีเดโมใน `/ops/login`: โค้ดต้นทางสร้างผู้ใช้ superadmin/admin/sales ฯลฯ ด้วยรหัส `Admin1234` อัตโนมัติ เมื่อ `DEMO_ADMIN_PASSWORD` ว่าง ให้ตั้ง `DEMO_ADMIN_PASSWORD` และ `SUPERADMIN_PASSWORD` เป็นรหัสที่แข็งแรง หรือจัดการผู้ใช้ผ่านเมนูผู้ใช้/สิทธิ์
- `npm run db:migrate` เพื่อเพิ่มตาราง dropship (031) และคอลัมน์เครดิต (032)

## ต้นทุนและราคา

ต้นทุน = ราคาออนไลน์ Advice × (1 − ส่วนลดซัพพลายเออร์) + ค่ากล่อง แล้วตั้งราคาตามกำไรขั้นต้น (ปัดขึ้นทีละ 10 บาท)

| ระดับ | กำไรขั้นต้น | ใช้กับ |
|------|------|------|
| direct | 60% | ภาครัฐ / องค์กร (ค่าที่ส่งเข้า NEXTERP `sell_price`) |
| economy | 50% | SME / โรงเรียน |
| dealer | 12% | ตัวแทน — ถูกบังคับให้ต่ำกว่าราคา Advice เสมอ |

ค่าเริ่มต้น: ส่วนลด 20%, กล่อง 10 บาท — เปลี่ยนได้ด้วย `TONER_SUPPLIER_DISCOUNT`, `TONER_BOX_COST_THB`, `TONER_*_MARGIN` (ดู `.env.example`)
ราคา Advice อ้างอิงวันที่ 2026-09-26

## ส่งข้อมูลเข้า NEXTERP

ตั้งค่า `NEXTERP_MYSQL_*` (หรือ `NEXTERP_MYSQL_URL`) ใน `.env.local` แล้ว:

```bash
npm run toner:nexterp               # dry run — แสดงแผน ไม่เขียนอะไร
npm run toner:nexterp -- --apply    # เขียนใน transaction เดียว
npm run toner:nexterp -- --json     # แผนแบบ JSON
```

- สร้างหมวด `TONER_HP`, `TONER_BROTHER`, `TONER_SAMSUNG` ในตาราง `categories`
- upsert สินค้าในตาราง `products` โดยจับคู่ด้วย `sku` (`TL-HP-CE285A` ฯลฯ) — รันซ้ำได้ ไม่สร้างซ้ำ ไม่ลบข้อมูลเดิม
- ตรวจก่อนเขียน: ถ้า NEXTERP มีคอลัมน์ NOT NULL ที่ไม่มีค่า default ซึ่งสคริปต์ไม่ได้ใส่ (เช่น `tenant_id`) จะหยุดทันทีโดยไม่เขียน

ทดสอบกับ MariaDB แล้ว: insert → รันซ้ำไม่เปลี่ยน → เปลี่ยนส่วนลดแล้วอัปเดตเฉพาะ `sell_price` → หยุดเมื่อมีคอลัมน์บังคับที่ไม่รู้จัก

---

# Baseline: premium-giftset-web

# Premium Gift Set Starter — v1.1 Production

B2B website for corporate gift-set manufacturing (Next.js 15 App Router, Node.js 22+).

## สถานะโปรเจกต์ (2026-09-03)

| ช่วง | สถานะ |
|------|--------|
| Sprint 0 — baseline (Next.js, RFQ, SEO, Docker, CI) | ✅ ครบ |
| Sprint 1 — local CMS (Postgres + Strapi skeleton) | ✅ ครบ |
| Option A — publish / revalidate smoke | ✅ ครบ (local) |
| Option B — Sprint 2 intake docs + `check:demo` | ✅ ครบ (รอข้อมูลจริง) |
| Option C — P2 quote tools (feature flag) | ✅ stub ครบ |
| UX polish + messaging clarity | ✅ ครบ |
| Production deploy / brand / Legal / OBS | ⏸ รอ stakeholder — ดู `docs/P1-ISSUES.md` |
| Local staging stack | ✅ `docker-compose.staging.yml` — ดู `docs/STAGING-DEPLOY.md` |
| Sprint 2 intake automation | ✅ `intake/` + `npm run sprint2:preflight` / `sprint2:apply-intake` |

Quality gates ล่าสุด: `lint` · `typecheck` · **52** tests · `build` — ดูรายละเอียดใน [VERIFICATION.md](VERIFICATION.md)

## Quick start

```bash
cp .env.example .env.local
npm ci
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run lhci
```

All-in-one:

```bash
npm run check
```

Demo placeholder scan (report-only until Sprint 2 migration):

```bash
npm run check:demo
# STRICT_NO_DEMO=1 npm run check:demo   # fail CI when demo markers remain
```

## Docker

```bash
docker build -t premium-giftset:v1.1 .
docker run --rm \
  --env-file .env.local \
  -e RUN_DB_MIGRATIONS=true \
  -v premium-giftset-data:/app/.data \
  -p 3000:3000 \
  premium-giftset:v1.1

curl -f 'http://127.0.0.1:3000/api/health?deep=1'
```

### NAS / Portainer (`https://smartgift.next-dev.net`)

Full stack (Next.js + Strapi + Postgres + MinIO) on the NAS:

```bash
docker compose -f docker-compose.portainer.yml config
```

Deploy from Gitea via Portainer. LAN web: http://192.168.1.30:33100  
See [docs/NAS-PORTAINER.md](docs/NAS-PORTAINER.md).

## PM2 (VM)

```bash
npm ci
npm run build:standalone
npm install -g pm2
export RUNTIME_STRICT=true
npm run validate:runtime
npm run db:migrate
pm2 start ecosystem.config.cjs
```

Start with `WEB_CONCURRENCY=1` when using SQLite. Do not share SQLite across hosts.

## Environment

Copy `.env.example` to `.env.local`. Defaults keep `NEXT_PUBLIC_ALLOW_INDEXING=false` and `CMS_MODE=mock`.

- `npm run validate:env` — build-time indexing guard (§14.2)
- `npm run validate:runtime` — runtime guard when `RUNTIME_STRICT=true` or indexing is on (§14.3)

Never enable search indexing with demo/placeholder content.

### Local CMS (optional)

```bash
docker compose up -d postgres
npm run cms:bootstrap
npm run cms:setup          # guided local Strapi + env hints
cd cms && npm install && npm run develop
```

Set in `.env.local`: `CMS_MODE=strapi`, `STRAPI_API_TOKEN=…`, `REVALIDATE_SECRET=…`  
If Strapi is partially configured, set `STRAPI_FALLBACK_TO_MOCK=true` to avoid build failures.

### Local MinIO (images, PDFs, documents)

```bash
npm run minio:up
```

Console: http://127.0.0.1:9021 (root user `terabis` / password from `.env.example`). API is `http://127.0.0.1:9020` so it does not collide with genesis-minio on 9000. Copy the `MINIO_*` block from `.env.example` into `.env.local` so the app uses `giftset-app`, not root. Catalog photos go to `terabis-public`. Payment slips go to `terabis-restricted`, PDFs to `terabis-confidential`, mockups to `terabis-private`. Strapi product photos use `terabis-public/cms/` — run `npm run cms:media:minio` after `minio:up`, then restart Strapi. If `MINIO_ENDPOINT` is empty, Next.js files stay under `.data/objects/` and Strapi stays on `cms/public/uploads`.

## P2 quote tools (optional)

```bash
NEXT_PUBLIC_ENABLE_P2_QUOTE_TOOLS=true
```

See [docs/P2-QUOTE-TOOLS.md](docs/P2-QUOTE-TOOLS.md).

## 1688 factory cost → Strapi (optional)

Copy `data/1688-offers.example.json` to `data/1688-offers.json`, fill real offer IDs / factory CNY / weight / dimensions. Restart Strapi after schema sync so `sourcePlatform` / `sourceOfferId` exist.

```bash
npm run alibaba:sync -- --dry-run
npm run alibaba:sync                 # writes priceMin / priceMax / priceRange to Strapi
npm run alibaba:sync -- --fetch      # also pull live 1688 prices (App Key required)
```

Requires local Strapi admin in `.env.cms.local`. Estimates include China→Thailand freight (SmartGift rate cards). Not a quote.

## Gemini → real 1688 / Alibaba photos (ops)

At `/ops/catalog-images`, staff search with Gemini (OpenRouter web search, domains limited to 1688.com / alibaba.com / alicdn). Only listing URLs and alicdn images that pass the allowlist are shown. Saving downloads the file into `.data/catalog-images/` and a SQLite row (`catalog_source_images`). Photos stay **ops-internal** until `ALIBABA_PUBLIC_IMAGES` and `ALIBABA_IMAGES_LICENSED` are both true.

```bash
npm run db:migrate
# then open http://localhost:3000/ops/catalog-images
```

## Docs

| เอกสาร | 用途 |
|--------|------|
| [docs/LLMs.txt](docs/LLMs.txt) | Full implementation handoff / runbook |
| [VERIFICATION.md](VERIFICATION.md) | Quality gates & smoke results |
| [docs/UX-POLISH.md](docs/UX-POLISH.md) | UX polish checklist |
| [docs/SPRINT1-LOCAL-CMS.md](docs/SPRINT1-LOCAL-CMS.md) | Local Strapi + lead backup |
| [docs/SPRINT2-CONTENT-INTAKE.md](docs/SPRINT2-CONTENT-INTAKE.md) | Stakeholder intake (PENDING) |
| [docs/SPRINT2-MIGRATION.md](docs/SPRINT2-MIGRATION.md) | Go-live migration steps |
| [docs/P1-ISSUES.md](docs/P1-ISSUES.md) | P1 blockers vs local-ready work |
| [docs/STAGING-DEPLOY.md](docs/STAGING-DEPLOY.md) | Local + remote staging deploy |
| [docs/UAT-CHECKLIST.md](docs/UAT-CHECKLIST.md) | UAT sign-off template |
| [docs/UAT-AUTO-RESULTS.md](docs/UAT-AUTO-RESULTS.md) | Automated route crawl results |
| [docs/OPS-CONSOLE.md](docs/OPS-CONSOLE.md) | ลูกค้า + ใบเสนอราคา (local ops) |
| [docs/PARTNER-API.md](docs/PARTNER-API.md) | REST คู่ค้า (API key, quotes/orders) |
| [docs/PUBLIC-SMG-BFF.md](docs/PUBLIC-SMG-BFF.md) | smg-ui brief + catalog BFF (CORS → tarabiz) |
| [docs/GIT-REMOTES.md](docs/GIT-REMOTES.md) | Cursor origin + Gitea NAS + GitLab |
| [docs/NAS-PORTAINER.md](docs/NAS-PORTAINER.md) | NAS Docker Compose + Cloudflare `smartgift.next-dev.net` |
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | P0/P1 baseline |
| [SECURITY.md](SECURITY.md) | Security baseline summary |

## Partner REST API

Read-only quotes/orders for CRM, n8n, or ERP. API key auth, not `/ops` cookies. See [docs/PARTNER-API.md](docs/PARTNER-API.md).

```bash
npm run db:migrate
npm run partner:key -- --name n8n
curl -H "Authorization: Bearer sgp_…" http://localhost:3000/api/partner/v1/quotes
```

## Public SMG BFF (smg-ui)

Browser CORS adapters on `https://smartgift.next-dev.net` — brief → `/ops/quotes`, catalog read without Partner API key. Ops UI unchanged. See [docs/PUBLIC-SMG-BFF.md](docs/PUBLIC-SMG-BFF.md).

```bash
# smg-ui
VITE_BRIEF_ENDPOINT=https://smartgift.next-dev.net/api/public/brief
# this host
PUBLIC_SMG_ORIGINS=https://your-smg-ui.example,http://localhost:8080
```

## Retry worker

```bash
curl -X POST https://www.example.com/api/jobs/retry-quotes \
  -H 'Authorization: Bearer <CRON_SECRET>'
```
