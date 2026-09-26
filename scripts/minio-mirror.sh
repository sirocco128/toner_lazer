#!/bin/sh
# Watch-copy vault buckets to the replica MinIO. Never deletes on the replica.

set -eu

PUBLIC="${MINIO_BUCKET_PUBLIC:-terabis-public}"
PRIVATE="${MINIO_BUCKET_PRIVATE:-terabis-private}"
CONFIDENTIAL="${MINIO_BUCKET_CONFIDENTIAL:-terabis-confidential}"
RESTRICTED="${MINIO_BUCKET_RESTRICTED:-terabis-restricted}"

i=0
until mc alias set src http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  i=$((i + 1))
  if [ "$i" -gt 40 ]; then
    echo "source MinIO not ready"
    exit 1
  fi
  sleep 1
done

i=0
until mc alias set dst http://minio-replica:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  i=$((i + 1))
  if [ "$i" -gt 40 ]; then
    echo "replica MinIO not ready"
    exit 1
  fi
  sleep 1
done

ensure_dst() {
  name="$1"
  with_lock="$2"
  if [ "$with_lock" = "1" ]; then
    mc mb --with-lock -p "dst/${name}" || mc mb -p "dst/${name}" || true
  else
    mc mb -p "dst/${name}" || true
  fi
  mc version enable "dst/${name}" || true
}

ensure_dst "$PUBLIC" 0
ensure_dst "$PRIVATE" 0
ensure_dst "$CONFIDENTIAL" 1
ensure_dst "$RESTRICTED" 1

echo "Mirroring vault buckets to replica (watch, no delete)"
mc mirror --watch --preserve src/"$PUBLIC" dst/"$PUBLIC" &
mc mirror --watch --preserve src/"$PRIVATE" dst/"$PRIVATE" &
mc mirror --watch --preserve src/"$CONFIDENTIAL" dst/"$CONFIDENTIAL" &
mc mirror --watch --preserve src/"$RESTRICTED" dst/"$RESTRICTED" &
wait
