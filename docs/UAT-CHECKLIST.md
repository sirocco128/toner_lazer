# UAT Checklist — Premium Gift Set v1.1

Runbook §33.7 (P1-UAT-001). Use on **staging** (`http://localhost:3001` local or remote staging URL).

Sign-off legend: ☐ not tested · ✓ pass · ✗ fail · N/A

---

## Session info

| Field | Value |
| --- | --- |
| Environment URL | |
| Build / commit | |
| CMS mode | mock / strapi |
| Date | |
| Facilitator | |

### Participants

| Role | Name | Sign-off |
| --- | --- | --- |
| Marketing | | |
| Sales | | |
| Editor / CMS | | |
| Legal / DPO | | |
| IT / DevOps | | |

---

## 1. Public routes & navigation

| # | Test | Marketing | Sales | Editor | Legal | IT |
| --- | --- | --- | --- | --- | --- | --- |
| 1.1 | Home loads; hero CTA ขอใบเสนอราคา | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1.2 | Premium Gift Set page + FAQ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1.3 | Products list + product detail | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1.4 | Gift set category pages | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1.5 | Customize gift set + form | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1.6 | Portfolio (demo banner if mock) | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1.7 | Blog list + article | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1.8 | Contact page + RFQ form | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1.9 | Active nav + mobile sticky CTA | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1.10 | Breadcrumbs on key pages | ☐ | ☐ | ☐ | ☐ | ☐ |
| 1.11 | 404 page | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## 2. RFQ (quote request)

| # | Test | Sales | IT | Legal |
| --- | --- | --- | --- | --- |
| 2.1 | Submit valid form → success + request ID | ☐ | ☐ | ☐ |
| 2.2 | Validation errors echo field values | ☐ | ☐ | N/A |
| 2.3 | Draft survives refresh (localStorage) | ☐ | ☐ | N/A |
| 2.4 | Consent checkbox required | ☐ | ☐ | ☐ |
| 2.5 | Success copy states no payment | ☐ | ☐ | ☐ |
| 2.6 | Lead persisted (`/api/health?deep=1` database ok) | ☐ | ☐ | N/A |
| 2.7 | Rate limit after repeated submits | ☐ | ☐ | N/A |

---

## 3. CMS & revalidate (if `CMS_MODE=strapi`)

| # | Test | Editor | IT |
| --- | --- | --- | --- |
| 3.1 | Strapi admin login | ☐ | ☐ |
| 3.2 | Draft → publish product | ☐ | ☐ |
| 3.3 | Unpublish removes from public list | ☐ | ☐ |
| 3.4 | `POST /api/revalidate` returns 200 | ☐ | ☐ |
| 3.5 | Published change visible on site within revalidate window | ☐ | ☐ |

---

## 4. SEO & legal (staging = noindex)

| # | Test | Marketing | Legal | IT |
| --- | --- | --- | --- | --- |
| 4.1 | `robots.txt` disallows when indexing off | ☐ | N/A | ☐ |
| 4.2 | Meta noindex on pages | ☐ | N/A | ☐ |
| 4.3 | Demo / legal template banner visible until approved | N/A | ☐ | ☐ |
| 4.4 | Privacy + Terms readable | N/A | ☐ | ☐ |
| 4.5 | Unique title/description per product (spot check) | ☐ | N/A | ☐ |

---

## 5. Accessibility & mobile

| # | Test | Marketing | Sales |
| --- | --- | --- | --- |
| 5.1 | Skip link to main content | ☐ | ☐ |
| 5.2 | Form labels + error announcements | ☐ | ☐ |
| 5.3 | Mobile sticky CTA (not on contact/legal) | ☐ | ☐ |
| 5.4 | Touch targets ≥ 44px on primary CTAs | ☐ | ☐ |

---

## 6. Ops & security

| # | Test | IT |
| --- | --- | --- |
| 6.1 | `GET /api/health` → 200 | ☐ |
| 6.2 | `GET /api/health?deep=1` → database ok | ☐ |
| 6.3 | Retry job endpoint requires `CRON_SECRET` | ☐ |
| 6.4 | Revalidate rejects bad token | ☐ |
| 6.5 | No secrets in client bundle / public env | ☐ |

---

## 7. P2 tools (if `NEXT_PUBLIC_ENABLE_P2_QUOTE_TOOLS=true`)

| # | Test | Sales | IT |
| --- | --- | --- | --- |
| 7.1 | Add to quote basket | ☐ | ☐ |
| 7.2 | Basket → contact prefill | ☐ | ☐ |
| 7.3 | Configurator stub → contact note | ☐ | ☐ |

---

## Exit criteria

UAT **PASS** when:

- [ ] All P0 items marked ✓ by responsible role
- [ ] No open ✗ without documented workaround + owner
- [ ] Legal confirms template banners acceptable for staging OR approved copy live
- [ ] IT confirms staging isolated (noindex, separate secrets/DB)

UAT **FAIL** → log issues in GitLab with label `uat-blocker`.

---

## Automated pre-UAT (run in CI / locally)

```bash
npm run check
npm run staging:smoke
npm run uat:auto
npm run sprint2:preflight
npm run check:demo
```

Before production cutover add:

```bash
npm run sprint2:preflight -- --strict
STRICT_NO_DEMO=1 npm run check:demo
```

Related: [STAGING-DEPLOY.md](./STAGING-DEPLOY.md) · [SPRINT2-MIGRATION.md](./SPRINT2-MIGRATION.md) · [P1-UAT-001](./P1-ISSUES.md#p1-uat-001--uat)
