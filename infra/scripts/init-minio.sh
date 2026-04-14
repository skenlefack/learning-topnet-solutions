#!/bin/bash
# ============================================================================
# ARIS Academy — MinIO Bucket Initialization
# Creates required buckets with appropriate policies
# Runs once at startup (restart: "no")
# ============================================================================
set -e

MINIO_HOST="${MINIO_HOST:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER:-academy_minio}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD:-academy_minio_secret}"

echo "=== ARIS Academy — MinIO Initialization ==="
echo "Host: $MINIO_HOST"

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
until mc alias set academy "$MINIO_HOST" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" 2>/dev/null; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "ERROR: MinIO not ready after $MAX_ATTEMPTS attempts. Exiting."
    exit 1
  fi
  echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS — waiting 2s..."
  sleep 2
done
echo "MinIO is ready."

# ---------------------------------------------------------------------------
# Create buckets
# ---------------------------------------------------------------------------
BUCKETS=(
  "course-materials"     # Course thumbnails, module assets, lesson media
  "assessments"          # Assessment attachments, question images
  "certificates"         # Generated PDF certificates, QR codes
  "user-uploads"         # User avatars, profile documents
)

for BUCKET in "${BUCKETS[@]}"; do
  if mc ls "academy/$BUCKET" >/dev/null 2>&1; then
    echo "  Bucket '$BUCKET' already exists — skipping"
  else
    mc mb "academy/$BUCKET"
    echo "  Created bucket '$BUCKET'"
  fi
done

# ---------------------------------------------------------------------------
# Set bucket policies
# ---------------------------------------------------------------------------
# course-materials: public read (thumbnails/images served directly)
mc anonymous set download "academy/course-materials"
echo "  Set 'course-materials' to public download"

# certificates: public read (verification page needs access)
mc anonymous set download "academy/certificates"
echo "  Set 'certificates' to public download"

# assessments & user-uploads: private (accessed via signed URLs)
mc anonymous set none "academy/assessments"
mc anonymous set none "academy/user-uploads"
echo "  Set 'assessments' and 'user-uploads' to private"

echo ""
echo "=== MinIO initialization complete ==="
echo "  Buckets: ${BUCKETS[*]}"
echo "  Console: ${MINIO_HOST/9000/9001}"
