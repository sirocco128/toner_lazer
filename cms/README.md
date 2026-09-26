# Premium Gift Set — local Strapi CMS

Sprint 1 local/dev CMS for P1-CMS-001. Schemas are synced from `../strapi/`.

## Quick start

```bash
# from repo root
docker compose up -d postgres
npm run cms:bootstrap
cd cms
npm install
npm run develop
```

Open http://localhost:1337/admin and create the first admin user.

Media: \`npm run minio:up\` then \`npm run cms:media:minio\` so product photos live in MinIO instead of \`public/uploads\`.

Full guide: [docs/SPRINT1-LOCAL-CMS.md](../docs/SPRINT1-LOCAL-CMS.md)
