#!/bin/sh
# NAS helper: copy to /volume1/docker/tarabiz-web-build.sh and set GIT_REPO_URL
# Example: GIT_REPO_URL='http://user:pass@192.168.1.30:3000/tong/mcp-alibaba.git'
set -eu
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
LOG="/volume1/docker/tarabiz-web-build.log"
LOCK="/volume1/docker/tarabiz-web-build.lock"
SRC="/tmp/tarabiz-web-build"
REPO_URL="${GIT_REPO_URL:-http://192.168.1.30:3000/tong/mcp-alibaba.git}"

if [ -f "$LOCK" ]; then
  echo "BUILD_LOCKED" | tee -a "$LOG"
  exit 1
fi
touch "$LOCK"
echo "START $(date -Iseconds)" > "$LOG"

rm -rf "$SRC"
git clone --depth 1 "$REPO_URL" "$SRC" >>"$LOG" 2>&1
cd "$SRC"
echo "HEAD=$(git rev-parse --short HEAD)" >>"$LOG"

docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://tarabiz.next-dev.net \
  --build-arg NEXT_PUBLIC_SITE_NAME=Terabis \
  --build-arg NEXT_PUBLIC_ALLOW_INDEXING=false \
  --build-arg CMS_MODE=mock \
  --build-arg STRAPI_URL=http://cms:1337 \
  --build-arg STRAPI_FALLBACK_TO_MOCK=true \
  --build-arg NEXT_IMAGE_REMOTE_URLS=http://192.168.1.30:33920,https://tarabiz.next-dev.net \
  -t tarabiz-web \
  . >>"$LOG" 2>&1
echo "BUILD_EXIT:$?" >>"$LOG"

docker inspect tarabiz-web-1 --format '{{range .Config.Env}}{{println .}}{{end}}' >/tmp/tarabiz-web.env
NET="$(docker inspect tarabiz-web-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
echo "NET=$NET" >>"$LOG"

docker stop tarabiz-web-1 >>"$LOG" 2>&1
docker rename tarabiz-web-1 "tarabiz-web-1-bak-$(date +%s)" >>"$LOG" 2>&1 || true

docker run -d --name tarabiz-web-1 \
  --restart unless-stopped \
  --network "$NET" \
  -p 33100:3000 \
  -v tarabiz_tarabiz_leads:/app/.data \
  --env-file /tmp/tarabiz-web.env \
  --health-cmd "wget -qO- http://127.0.0.1:3000/api/health || exit 1" \
  --health-interval 30s \
  --health-timeout 5s \
  --health-start-period 20s \
  --health-retries 3 \
  tarabiz-web >>"$LOG" 2>&1
echo "RUN_EXIT:$?" >>"$LOG"

sleep 12
docker ps --filter name=^tarabiz-web-1$ --format '{{.Names}} {{.Status}} {{.Image}}' >>"$LOG"
if curl -fsS "http://127.0.0.1:33100/api/health" >>"$LOG" 2>&1; then
  echo >>"$LOG"
  echo "HEALTH_OK" >>"$LOG"
else
  echo "HEALTH_FAIL" >>"$LOG"
fi

echo "END $(date -Iseconds)" >>"$LOG"
rm -f "$LOCK"
