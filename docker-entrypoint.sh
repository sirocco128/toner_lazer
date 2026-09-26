#!/bin/sh
set -eu

node scripts/validate-runtime.mjs

if [ ! -f docs/manual/02-USER-MANUAL.md ]; then
  echo "warn: docs/manual/02-USER-MANUAL.md missing — /ops/manual will show ไฟล์เอกสารหายจากดิสก์" >&2
fi

if [ "${RUN_DB_MIGRATIONS:-false}" = "true" ]; then
  node scripts/migrate.mjs
fi

exec node server.js
