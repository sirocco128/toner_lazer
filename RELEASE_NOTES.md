# Release Notes — v1.1 Production Starter

## Closed P0

- Added Customize, Portfolio, and Portfolio schema
- Added authenticated Strapi revalidation endpoint
- Added Dockerfile, `.dockerignore`, PM2 config, and health endpoint
- Added conditional LocalBusiness structured data
- Added complete `.prose-custom` styles
- Updated Navbar, mobile navigation, Footer, Sitemap, and legal links
- Removed malformed brace-expansion directories
- Prepared release archive layout

## Production hardening included

- Strapi v4/v5 adapters and Zod validation
- Media URL mapping, relation mapping, pagination, timeout, tags, and controlled fallback
- Safe article block rendering without CMS HTML injection
- RFQ persistence, reference number, SQLite schema, atomic rate limiting, consent, UTM attribution, hashed IP, webhook outbox, exponential retry, and dead-letter status
- Security headers, bounded revalidation payloads, indexing build guard, strict runtime environment guard, and protected retry worker
- Quality gates for lint, typecheck, unit tests, build, Lighthouse, and container image

## External inputs still required

- Approved company identity and contact data
- Real product and portfolio assets
- Legal/PDPA approval
- Deployed Strapi and media storage
- Staging/UAT sign-off
- RDS adapter for multi-instance deployment
- NextERP/CRM and LINE OA integrations
