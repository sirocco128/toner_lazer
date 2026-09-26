# syntax=docker/dockerfile:1
# Strapi v5 for the NAS / Portainer stack (production start, not develop).

FROM node:22-alpine
WORKDIR /opt/app

RUN apk add --no-cache libc6-compat wget

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337

RUN npm run build

EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=8 \
  CMD wget -qO- http://127.0.0.1:1337/_health || exit 1

CMD ["npm", "run", "start"]
