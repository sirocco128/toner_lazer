#!/bin/sh
# Create vault buckets, versioning, SSE, retention, and a non-root app user.
# Run inside minio/mc. Root credentials stay in this job only.

set -eu

PUBLIC="${MINIO_BUCKET_PUBLIC:-terabis-public}"
PRIVATE="${MINIO_BUCKET_PRIVATE:-terabis-private}"
CONFIDENTIAL="${MINIO_BUCKET_CONFIDENTIAL:-terabis-confidential}"
RESTRICTED="${MINIO_BUCKET_RESTRICTED:-terabis-restricted}"
DAYS="${MINIO_RETENTION_DAYS:-7}"

i=0
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  i=$((i + 1))
  if [ "$i" -gt 40 ]; then
    echo "MinIO not ready"
    exit 1
  fi
  sleep 1
done

ensure_bucket() {
  name="$1"
  with_lock="$2"
  if [ "$with_lock" = "1" ]; then
    mc mb --with-lock -p "local/${name}" || mc mb -p "local/${name}" || true
  else
    mc mb -p "local/${name}" || true
  fi
  mc version enable "local/${name}" || true
  mc encrypt set sse-s3 "local/${name}" || true
}

ensure_bucket "$PUBLIC" 0
mc anonymous set download "local/${PUBLIC}" || true

ensure_bucket "$PRIVATE" 0
ensure_bucket "$CONFIDENTIAL" 1
ensure_bucket "$RESTRICTED" 1

if [ "$DAYS" -gt 0 ] 2>/dev/null; then
  mc retention set --default GOVERNANCE "${DAYS}d" "local/${CONFIDENTIAL}" || true
  mc retention set --default GOVERNANCE "${DAYS}d" "local/${RESTRICTED}" || true
fi

cat >/tmp/giftset-app.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketLocation", "s3:ListBucket", "s3:ListBucketVersions"],
      "Resource": [
        "arn:aws:s3:::${PUBLIC}",
        "arn:aws:s3:::${PRIVATE}",
        "arn:aws:s3:::${CONFIDENTIAL}",
        "arn:aws:s3:::${RESTRICTED}"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": [
        "arn:aws:s3:::${PUBLIC}/*",
        "arn:aws:s3:::${PRIVATE}/*",
        "arn:aws:s3:::${CONFIDENTIAL}/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:PutObject",
        "s3:AbortMultipartUpload",
        "s3:PutObjectRetention",
        "s3:GetObjectRetention",
        "s3:PutObjectLegalHold",
        "s3:GetObjectLegalHold"
      ],
      "Resource": ["arn:aws:s3:::${RESTRICTED}/*"]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObjectRetention",
        "s3:GetObjectRetention",
        "s3:PutObjectLegalHold",
        "s3:GetObjectLegalHold"
      ],
      "Resource": ["arn:aws:s3:::${CONFIDENTIAL}/*"]
    },
    {
      "Effect": "Deny",
      "Action": ["s3:DeleteObject", "s3:DeleteObjectVersion"],
      "Resource": ["arn:aws:s3:::${RESTRICTED}/*"]
    },
    {
      "Effect": "Deny",
      "Action": ["s3:PutObject"],
      "Resource": [
        "arn:aws:s3:::${PUBLIC}/slips/*",
        "arn:aws:s3:::${PUBLIC}/documents/*",
        "arn:aws:s3:::${PUBLIC}/mockups/*"
      ]
    }
  ]
}
EOF

if [ "${MINIO_ACCESS_KEY}" = "${MINIO_ROOT_USER}" ]; then
  echo "WARNING: MINIO_ACCESS_KEY matches root — create a dedicated app user for production"
else
  mc admin user add local "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" || true
  mc admin policy create local giftset-app /tmp/giftset-app.json \
    || mc admin policy add local giftset-app /tmp/giftset-app.json \
    || true
  mc admin policy attach local giftset-app --user "$MINIO_ACCESS_KEY" \
    || mc admin policy set local giftset-app "user=${MINIO_ACCESS_KEY}" \
    || true
fi

echo "MinIO vault ready: public=$PUBLIC private=$PRIVATE confidential=$CONFIDENTIAL restricted=$RESTRICTED"
