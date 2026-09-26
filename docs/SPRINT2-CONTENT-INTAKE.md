# Sprint 2 — Content intake (runbook §50)

Stakeholders have **not** supplied production values yet. Do **not** invent brand, contact, legal, or asset data and treat it as approved.

Fill the **Value** column only when stakeholders send real data. Keep **Status** as `PENDING` until received and verified. Link: [SPRINT2-MIGRATION.md](./SPRINT2-MIGRATION.md) · [P1-DATA-001](./P1-ISSUES.md#p1-data-001--real-content) · [P1-LEGAL-001](./P1-ISSUES.md#p1-legal-001--legal--pdpa)

Status legend: `PENDING` | `RECEIVED` | `APPROVED`

**Automation (in repo):**

1. Copy [intake/sprint2-intake.template.json](../intake/sprint2-intake.template.json) → `intake/sprint2-intake.json` (gitignored).
2. `npm run sprint2:preflight` / `npm run sprint2:preflight -- --strict`
3. `npm run sprint2:apply-intake -- --target .env.staging` (APPROVED fields only)
4. Follow [SPRINT2-MIGRATION.md](./SPRINT2-MIGRATION.md) · staging: [STAGING-DEPLOY.md](./STAGING-DEPLOY.md)

---

## Business

| Field | Value | Owner | Status |
| --- | --- | --- | --- |
| ชื่อแบรนด์จริง | | Business / PO | PENDING |
| ชื่อนิติบุคคล | | Business / PO | PENDING |
| Tax ID | | Business / Finance | PENDING |
| Address (street, locality, region, postal, country) | | Business / PO | PENDING |
| Phone (display + tel href) | | Business / Sales | PENDING |
| Email | | Business / Sales | PENDING |
| LINE OA (ID + URL) | | Business / Marketing | PENDING |
| Business Hours | | Business / Sales | PENDING |
| Sales SLA | | Business / Sales | PENDING |
| MOQ Policy | | Business / Sales | PENDING |
| Price Disclaimer | | Business / Legal | PENDING |
| Payment/Delivery Terms | | Business / Legal | PENDING |

---

## Content

| Field | Value | Owner | Status |
| --- | --- | --- | --- |
| Product Catalog | | Marketing / Editor | PENDING |
| Product Images (licensed) | | Marketing / Creative | PENDING |
| Category Images (licensed) | | Marketing / Creative | PENDING |
| Material/Decoration Detail | | Marketing / Product | PENDING |
| Portfolio Permission | | Marketing / Legal | PENDING |
| Client Logo Permission | | Marketing / Legal | PENDING |
| FAQ Approved | | Marketing / Sales | PENDING |
| Blog Plan | | Marketing / Editor | PENDING |
| Logo / OG images (licensed) | | Marketing / Creative | PENDING |

---

## Legal

| Field | Value | Owner | Status |
| --- | --- | --- | --- |
| Privacy Notice | | Legal / DPO | PENDING |
| Terms | | Legal / DPO | PENDING |
| Consent Text | | Legal / DPO | PENDING |
| Retention | | Legal / DPO | PENDING |
| Data Subject Request Contact | | Legal / DPO | PENDING |
| Processor Agreements | | Legal / DPO | PENDING |
| Cookie Notice (if non-essential cookies) | | Legal / DPO | PENDING |

---

## Technical

| Field | Value | Owner | Status |
| --- | --- | --- | --- |
| Production Domain | | IT / DevOps | PENDING |
| Huawei Cloud Environment | | IT / Cloud | PENDING |
| RDS Decision | | IT / Architecture | PENDING |
| OBS Bucket/CDN | | IT / Cloud | PENDING |
| GitLab Project/Runner | | IT / DevOps | PENDING |
| Secret Manager | | IT / Security | PENDING |
| Monitoring Stack | | IT / DevOps | PENDING |
| NextERP API | | IT / Integrations | PENDING |
| CRM API | | IT / Integrations | PENDING |
| LINE OA Credentials | | IT / Marketing Ops | PENDING |

---

## Gate flags (do not flip until approvals)

| Flag | Required before | Current |
| --- | --- | --- |
| `LEGAL_CONTENT_APPROVED` | Indexing / public legal pages as final | `false` (PENDING) |
| `REAL_ASSETS_APPROVED` | Indexing / public product & brand assets | `false` (PENDING) |
| `NEXT_PUBLIC_ALLOW_INDEXING` | Production SEO | `false` until LEGAL + REAL_ASSETS + intake complete |

When this form is fully **RECEIVED** / **APPROVED**, follow [SPRINT2-MIGRATION.md](./SPRINT2-MIGRATION.md). Until then, keep demo placeholders and `noindex`.
