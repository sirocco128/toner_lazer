# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_SITE_NAME=GiftPro Asia
ARG NEXT_PUBLIC_SITE_DESCRIPTION="รับผลิต Gift Set ของขวัญพรีเมียม สกรีนโลโก้ สำหรับลูกค้าองค์กร"
ARG NEXT_PUBLIC_SITE_PHONE_DISPLAY=02-000-0000
ARG NEXT_PUBLIC_SITE_PHONE_HREF=tel:+6620000000
ARG NEXT_PUBLIC_SITE_EMAIL=sales@example.com
ARG NEXT_PUBLIC_LINE_ID=@giftproasia
ARG NEXT_PUBLIC_LINE_URL=https://line.me/R/ti/p/@giftproasia
ARG NEXT_PUBLIC_ALLOW_INDEXING=false
ARG NEXT_PUBLIC_ENABLE_BUYER_ASSISTANT=true
ARG NEXT_PUBLIC_TAIP_WIDGET=false
ARG CMS_MODE=mock
ARG STRAPI_URL=http://localhost:1337
ARG STRAPI_PUBLIC_READ=false
ARG STRAPI_FALLBACK_TO_MOCK=false
ARG STRAPI_FETCH_TIMEOUT_MS=8000
ARG NEXT_IMAGE_REMOTE_URLS=
ARG STRAPI_BUILD_API_TOKEN=

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    NEXT_PUBLIC_SITE_DESCRIPTION=$NEXT_PUBLIC_SITE_DESCRIPTION \
    NEXT_PUBLIC_SITE_PHONE_DISPLAY=$NEXT_PUBLIC_SITE_PHONE_DISPLAY \
    NEXT_PUBLIC_SITE_PHONE_HREF=$NEXT_PUBLIC_SITE_PHONE_HREF \
    NEXT_PUBLIC_SITE_EMAIL=$NEXT_PUBLIC_SITE_EMAIL \
    NEXT_PUBLIC_LINE_ID=$NEXT_PUBLIC_LINE_ID \
    NEXT_PUBLIC_LINE_URL=$NEXT_PUBLIC_LINE_URL \
    NEXT_PUBLIC_ALLOW_INDEXING=$NEXT_PUBLIC_ALLOW_INDEXING \
    NEXT_PUBLIC_ENABLE_BUYER_ASSISTANT=$NEXT_PUBLIC_ENABLE_BUYER_ASSISTANT \
    NEXT_PUBLIC_TAIP_WIDGET=$NEXT_PUBLIC_TAIP_WIDGET \
    CMS_MODE=$CMS_MODE \
    STRAPI_URL=$STRAPI_URL \
    STRAPI_PUBLIC_READ=$STRAPI_PUBLIC_READ \
    STRAPI_FALLBACK_TO_MOCK=$STRAPI_FALLBACK_TO_MOCK \
    STRAPI_FETCH_TIMEOUT_MS=$STRAPI_FETCH_TIMEOUT_MS \
    NEXT_IMAGE_REMOTE_URLS=$NEXT_IMAGE_REMOTE_URLS \
    NEXT_TELEMETRY_DISABLED=1

# Builder-only token; not copied into the runner image layers below.
ENV STRAPI_API_TOKEN=$STRAPI_BUILD_API_TOKEN

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    SQLITE_PATH=/app/.data/leads.sqlite

RUN addgroup -g 1001 -S nodejs \
  && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/db ./db
# Work-manual markdown for /ops/manual (loader reads process.cwd()/docs)
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder /app/scripts/apply-wms-mysql.mjs ./scripts/apply-wms-mysql.mjs
COPY --from=builder /app/scripts/migrate-all.mjs ./scripts/migrate-all.mjs
COPY --from=builder /app/scripts/validate-runtime.mjs ./scripts/validate-runtime.mjs
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/.data \
  && sed -i 's/\r$//' /app/docker-entrypoint.sh \
  && chmod +x /app/docker-entrypoint.sh \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
