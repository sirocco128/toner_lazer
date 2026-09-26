# UAT Auto Results

Generated: 2026-09-03T23:38:14.093Z  
Base URL: `http://127.0.0.1:3001`  
Mode: automated crawl (no human sign-off)

## Route crawl

| Path | HTTP | Pass |
| --- | --- | --- |
| `/` | 200 | ✓ |
| `/premium-giftset` | 200 | ✓ |
| `/products` | 200 | ✓ |
| `/products/tumbler-notebook-pen-set` | 200 | ✓ |
| `/giftset/eco-giftset` | 200 | ✓ |
| `/customize-gift-set` | 200 | ✓ |
| `/portfolio` | 200 | ✓ |
| `/blog` | 200 | ✓ |
| `/blog/premium-products-guide` | 200 | ✓ |
| `/contact` | 200 | ✓ |
| `/privacy` | 200 | ✓ |
| `/terms` | 200 | ✓ |
| `/quote-basket` | 200 | ✓ |
| `/robots.txt` | 200 | ✓ |
| `/sitemap.xml` | 200 | ✓ |
| `/api/health` | 200 | ✓ |
| `/api/health?deep=1` | 200 | ✓ |
| `/does-not-exist-404-check` | 404 | ✓ |

## Summary

- Routes checked: 18
- Failures: 0
- Status: **PASS (automation)**

## Human UAT still required

Complete role sign-off in [UAT-CHECKLIST.md](./UAT-CHECKLIST.md):

- RFQ submit success / validation / consent
- CMS publish/unpublish (when Strapi live)
- Legal review of privacy/terms templates
- Marketing copy & a11y spot checks

## Pre-UAT commands run with this session

```bash
npm run staging:smoke
npm run sprint2:preflight
npm run check:demo
```
