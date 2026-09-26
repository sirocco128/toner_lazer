# Sprint 2 intake files

Stakeholders fill **`sprint2-intake.json`** (copy from `sprint2-intake.template.json`).

| File | Committed | Purpose |
| --- | --- | --- |
| `sprint2-intake.template.json` | Yes | Blank template |
| `sprint2-intake.json` | **No** (gitignored) | Real values + secrets |

## Workflow

```bash
cp intake/sprint2-intake.template.json intake/sprint2-intake.json
# Edit intake/sprint2-intake.json — set value + status (RECEIVED / APPROVED)

# Staging rehearsal (demo values — committed reference file):
npm run sprint2:staging-demo

npm run sprint2:preflight          # report missing / demo markers
npm run sprint2:preflight -- --strict   # exit 1 if not ready for cutover

npm run sprint2:apply-intake -- --target .env.staging
# Generates env file from APPROVED fields only

npm run check:demo                 # report-only demo scan
STRICT_NO_DEMO=1 npm run check:demo   # fail if demo placeholders remain
```

Then follow [docs/SPRINT2-MIGRATION.md](../docs/SPRINT2-MIGRATION.md) for Strapi import order and indexing gates.

**Do not** set `allowIndexing=true` until `legalContentApproved` and `realAssetsApproved` are true with real approved copy/assets.
