#!/bin/bash
# ============================================================================
# ARIS Academy — PostgreSQL Restore Script
# Restores a database from a backup file created by backup-postgres.sh
#
# Usage:
#   ./infra/scripts/restore-postgres.sh <backup_file.sql.gz>
#   ./infra/scripts/restore-postgres.sh --force <backup_file.sql.gz>
#
# Options:
#   --force    Skip interactive confirmation prompt
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CONTAINER_NAME="${CONTAINER_NAME:-academy-postgres}"
DB_NAME="${DB_NAME:-academy}"
DB_USER="${DB_USER:-academy}"
FORCE=false
BACKUP_FILE=""

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
for arg in "$@"; do
    case "$arg" in
        --force)
            FORCE=true
            ;;
        --help|-h)
            echo "Usage: $0 [--force] <backup_file.sql.gz>"
            echo ""
            echo "Restores the ARIS Academy PostgreSQL database from a backup."
            echo ""
            echo "Options:"
            echo "  --force   Skip confirmation prompt (for non-interactive use)"
            echo ""
            echo "Environment variables:"
            echo "  CONTAINER_NAME   Docker container name (default: academy-postgres)"
            echo "  DB_NAME          Database name (default: academy)"
            echo "  DB_USER          Database user (default: academy)"
            exit 0
            ;;
        -*)
            echo "ERROR: Unknown option: $arg"
            echo "Run '$0 --help' for usage."
            exit 1
            ;;
        *)
            BACKUP_FILE="$arg"
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Validate input
# ---------------------------------------------------------------------------
if [ -z "$BACKUP_FILE" ]; then
    echo "ERROR: No backup file specified."
    echo "Usage: $0 [--force] <backup_file.sql.gz>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

if [ ! -s "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file is empty: $BACKUP_FILE"
    exit 1
fi

# Check Docker is available
if ! command -v docker &>/dev/null; then
    echo "ERROR: docker command not found"
    exit 1
fi

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running"
    exit 1
fi

# ---------------------------------------------------------------------------
# Display backup info
# ---------------------------------------------------------------------------
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "=============================================="
echo " ARIS Academy — PostgreSQL Restore"
echo "=============================================="
echo ""
echo "  Backup file : $BACKUP_FILE"
echo "  File size   : $BACKUP_SIZE"
echo "  Container   : $CONTAINER_NAME"
echo "  Database    : $DB_NAME"
echo "  User        : $DB_USER"
echo ""
echo "  WARNING: This will DROP and RECREATE the database '$DB_NAME'."
echo "  ALL EXISTING DATA WILL BE PERMANENTLY LOST."
echo ""

# ---------------------------------------------------------------------------
# Confirmation
# ---------------------------------------------------------------------------
if [ "$FORCE" != true ]; then
    read -r -p "Are you sure you want to proceed? Type 'yes' to confirm: " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo ""
        echo "Restore cancelled."
        exit 0
    fi
    echo ""
fi

echo "[$(date '+%H:%M:%S')] Starting restore..."

# ---------------------------------------------------------------------------
# Step 1: Terminate active connections
# ---------------------------------------------------------------------------
echo "[$(date '+%H:%M:%S')] Terminating active connections to '$DB_NAME'..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '$DB_NAME'
      AND pid <> pg_backend_pid();
" > /dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# Step 2: Drop and recreate database
# ---------------------------------------------------------------------------
echo "[$(date '+%H:%M:%S')] Dropping database '$DB_NAME'..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"

echo "[$(date '+%H:%M:%S')] Creating database '$DB_NAME'..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\" ENCODING 'UTF8';"

# ---------------------------------------------------------------------------
# Step 3: Restore from backup
# ---------------------------------------------------------------------------
echo "[$(date '+%H:%M:%S')] Restoring from backup..."
START_TIME=$(date +%s)

if echo "$BACKUP_FILE" | grep -q '\.gz$'; then
    # Compressed backup
    gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" --quiet 2>&1 | tail -5
else
    # Uncompressed backup
    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" --quiet < "$BACKUP_FILE" 2>&1 | tail -5
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo "[$(date '+%H:%M:%S')] Restore completed in ${DURATION}s"

# ---------------------------------------------------------------------------
# Step 4: Verify restore
# ---------------------------------------------------------------------------
echo ""
echo "[$(date '+%H:%M:%S')] Verifying restore..."
echo ""

VERIFY_SQL="
SELECT 'tenants' AS table_name, COUNT(*) AS row_count FROM academy_core.tenants
UNION ALL
SELECT 'users', COUNT(*) FROM academy_core.users
UNION ALL
SELECT 'courses', COUNT(*) FROM academy_core.courses
UNION ALL
SELECT 'modules', COUNT(*) FROM academy_core.modules
UNION ALL
SELECT 'enrollments', COUNT(*) FROM academy_core.enrollments
UNION ALL
SELECT 'certifications', COUNT(*) FROM academy_core.certifications
UNION ALL
SELECT 'live_sessions', COUNT(*) FROM academy_core.live_sessions
UNION ALL
SELECT 'assessments', COUNT(*) FROM academy_core.assessments
ORDER BY table_name;
"

VERIFY_RESULT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -F '|' -c "$VERIFY_SQL" 2>&1)

if [ $? -eq 0 ]; then
    echo "  Table Verification:"
    echo "  -----------------------------------"
    printf "  %-25s %s\n" "TABLE" "ROWS"
    echo "  -----------------------------------"
    echo "$VERIFY_RESULT" | while IFS='|' read -r table count; do
        printf "  %-25s %s\n" "$table" "$count"
    done
    echo "  -----------------------------------"
    echo ""
    echo "[$(date '+%H:%M:%S')] Restore verified successfully."
else
    echo "  WARNING: Verification query failed. The restore may be incomplete."
    echo "  Error: $VERIFY_RESULT"
    echo ""
    echo "  Please manually verify the database:"
    echo "    docker exec -it $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
    exit 1
fi

echo ""
echo "=============================================="
echo " Restore complete"
echo "=============================================="
exit 0
