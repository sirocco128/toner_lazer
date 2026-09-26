# Sprint 2 — Demo → real content migration

Run **only after** [SPRINT2-CONTENT-INTAKE.md](./SPRINT2-CONTENT-INTAKE.md) has real stakeholder values (not invented). Demo catalog and `GiftPro Asia` placeholders stay until then.

Related: [P1-DATA-001](./P1-ISSUES.md#p1-data-001--real-content) · [P1-LEGAL-001](./P1-ISSUES.md#p1-legal-001--legal--pdpa) · runbook §33.3 / §50

---

## Preconditions

1. Intake rows for Business + Content (+ Legal text for `/privacy` `/terms`) are **RECEIVED** and signed off.
2. Image licenses / portfolio permissions on file.
3. Staging (or local) Strapi reachable; `CMS_MODE` plan agreed.
4. Keep `NEXT_PUBLIC_ALLOW_INDEXING=false` until both `LEGAL_CONTENT_APPROVED=true` **and** `REAL_ASSETS_APPROVED=true`.

---

## 1. Environment variables to change

Update `.env.local` / deployment secrets from intake — **do not** copy demo defaults from `.env.example` into production.

| Variable | Source (intake) |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production Domain |
| `NEXT_PUBLIC_SITE_NAME` | ชื่อแบรนด์จริง |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | Approved tagline |
| `NEXT_PUBLIC_SITE_PHONE_DISPLAY` / `NEXT_PUBLIC_SITE_PHONE_HREF` | Phone |
| `NEXT_PUBLIC_SITE_EMAIL` | Email |
| `NEXT_PUBLIC_LINE_ID` / `NEXT_PUBLIC_LINE_URL` | LINE OA |
| `SITE_LEGAL_NAME` | ชื่อนิติบุคคล |
| `SITE_TAX_ID` | Tax ID |
| `SITE_STREET_ADDRESS`, `SITE_ADDRESS_LOCALITY`, `SITE_ADDRESS_REGION`, `SITE_POSTAL_CODE`, `SITE_COUNTRY_CODE` | Address |
| `SITE_LATITUDE` / `SITE_LONGITUDE` | Address (optional) |
| `SITE_OPENING_HOURS` | Business Hours |
| `SITE_ENABLE_LOCAL_BUSINESS_SCHEMA` | Only after address fields complete + approved |
| `SITE_BUSINESS_TYPE` | Approved schema.org type |
| `CMS_MODE` | `strapi` when live CMS is ready |
| `STRAPI_URL` / `STRAPI_API_TOKEN` | Technical intake |
| `NEXT_IMAGE_REMOTE_URLS` | OBS/CDN host allowlist |
| `LEGAL_CONTENT_APPROVED` | Set `true` **only** after Legal/DPO sign-off |
| `REAL_ASSETS_APPROVED` | Set `true` **only** after licensed assets verified |
| `NEXT_PUBLIC_ALLOW_INDEXING` | Set `true` **last**, after both approval flags |

Also replace privacy/terms body copy with approved Legal text (remove template banner when `LEGAL_CONTENT_APPROVED=true`).

---

## 2. Strapi import order

Import (or create + publish) in this order so relations resolve:

1. **Categories** (`gift-set-category`)
2. **Products** (link category; SEO component; media)
3. **FAQs**
4. **Portfolios** (permissions documented)
5. **Articles** (blog; after FAQ/product hub if they cross-link)

Draft → review → publish. Confirm revalidate webhook hits Next.js after each publish batch.

If still on `CMS_MODE=mock`, replace `lib/data.ts` only with **approved** catalog — never invent production SKUs.

---

## 3. SEO uniqueness checks

Before indexing:

- Every public page has unique `seoTitle` and `metaDescription` (no duplicates across products/categories/articles).
- Canonical paths match live routes; `NEXT_PUBLIC_SITE_URL` is the real HTTPS origin.
- OG images use licensed URLs (CDN/OBS), not demo SVGs.
- Run `npm run check:demo` with `STRICT_NO_DEMO=1` — must exit 0 (no `GiftPro Asia`, `example.com`, `000-0000`, `ตัวอย่าง` in scanned sources).
- Spot-check metadata on key URLs (home, category, product, FAQ, portfolio, article).

---

## 4. noindex until LEGAL + REAL_ASSETS approved

| Gate | Rule |
| --- | --- |
| Default | `NEXT_PUBLIC_ALLOW_INDEXING=false` → site-wide noindex / demo banner |
| Legal | `/privacy` `/terms` show template banner while `LEGAL_CONTENT_APPROVED` ≠ true |
| Assets | Do not flip `REAL_ASSETS_APPROVED` until logos, product, portfolio, OG assets are licensed |
| Indexing | `validate:env` requires both approval flags **and** non-placeholder env when indexing is enabled |

**Do not** enable indexing with demo brand or unapproved legal copy.

---

## 5. Suggested cutover checklist

- [ ] Intake complete (Business, Content, Legal, Technical as needed)
- [ ] Env updated; LocalBusiness only if address complete
- [ ] Strapi import order completed; mock fallback off if production uses Strapi
- [ ] `npm run check:demo` (`STRICT_NO_DEMO=1`) passes
- [ ] Legal pages match approved text; banner gone when approved
- [ ] SEO uniqueness verified
- [ ] `LEGAL_CONTENT_APPROVED=true` and `REAL_ASSETS_APPROVED=true`
- [ ] Then — and only then — `NEXT_PUBLIC_ALLOW_INDEXING=true` on production
