#!/bin/bash
# ============================================================================
# ARIS Academy — PostgreSQL Backup Script
# Automated backup designed to run via cron on VM-ACADEMY
#
# Usage:
#   ./infra/scripts/backup-postgres.sh              # Full compressed backup
#   ./infra/scripts/backup-postgres.sh --schema-only # Schema-only backup
#
# Retention policy:
#   - Daily backups: last 30
#   - Weekly backups (Sunday): last 12
#   - Monthly backups (1st of month): last 6
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
LOG_FILE="${LOG_FILE:-/var/log/academy-backup.log}"
CONTAINER_NAME="${CONTAINER_NAME:-academy-postgres}"
DB_NAME="${DB_NAME:-academy}"
DB_USER="${DB_USER:-academy}"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
DATE_ONLY="$(date +%Y-%m-%d)"
DAY_OF_WEEK="$(date +%u)"  # 1=Monday, 7=Sunday
DAY_OF_MONTH="$(date +%d)"

SCHEMA_ONLY=false
RETAIN_DAILY=30
RETAIN_WEEKLY=12
RETAIN_MONTHLY=6

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
for arg in "$@"; do
    case "$arg" in
        --schema-only)
            SCHEMA_ONLY=true
            ;;
        --help|-h)
            echo "Usage: $0 [--schema-only]"
            echo ""
            echo "Options:"
            echo "  --schema-only   Backup schema definitions only (no data)"
            echo ""
            echo "Environment variables:"
            echo "  BACKUP_DIR       Backup destination (default: /backups/postgres)"
            echo "  LOG_FILE         Log file path (default: /var/log/academy-backup.log)"
            echo "  CONTAINER_NAME   Docker container name (default: academy-postgres)"
            echo "  DB_NAME          Database name (default: academy)"
            echo "  DB_USER          Database user (default: academy)"
            exit 0
            ;;
        *)
            echo "ERROR: Unknown argument: $arg"
            echo "Run '$0 --help' for usage."
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    # Create log directory if it does not exist
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
log "=== ARIS Academy PostgreSQL Backup ==="

# Ensure backup directory exists
if ! mkdir -p "$BACKUP_DIR"; then
    log "ERROR: Cannot create backup directory: $BACKUP_DIR"
    exit 1
fi
log "Backup directory: $BACKUP_DIR"

# Check Docker is available
if ! command -v docker &>/dev/null; then
    log "ERROR: docker command not found"
    exit 1
fi

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "ERROR: Container '$CONTAINER_NAME' is not running"
    exit 1
fi

# ---------------------------------------------------------------------------
# Determine backup type label
# ---------------------------------------------------------------------------
if [ "$SCHEMA_ONLY" = true ]; then
    BACKUP_TYPE="schema"
    DUMP_FLAGS="--schema-only"
else
    BACKUP_TYPE="full"
    DUMP_FLAGS=""
fi

BACKUP_FILE="${DB_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

log "Backup type: $BACKUP_TYPE"
log "Output file: $BACKUP_PATH"

# ---------------------------------------------------------------------------
# Execute backup
# ---------------------------------------------------------------------------
START_TIME=$(date +%s)

log "Starting pg_dump..."
if docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-privileges \
    $DUMP_FLAGS \
    2>>"$LOG_FILE" \
    | gzip > "$BACKUP_PATH"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    BACKUP_SIZE_BYTES=$(stat -c%s "$BACKUP_PATH" 2>/dev/null || stat -f%z "$BACKUP_PATH" 2>/dev/null || echo "unknown")

    log "Backup completed successfully"
    log "  File: $BACKUP_FILE"
    log "  Size: $BACKUP_SIZE ($BACKUP_SIZE_BYTES bytes)"
    log "  Duration: ${DURATION}s"
else
    log "ERROR: pg_dump failed with exit code $?"
    # Clean up partial file
    rm -f "$BACKUP_PATH"
    exit 1
fi

# Verify backup is not empty
if [ ! -s "$BACKUP_PATH" ]; then
    log "ERROR: Backup file is empty, removing"
    rm -f "$BACKUP_PATH"
    exit 1
fi

# ---------------------------------------------------------------------------
# Symlink for weekly/monthly retention
# ---------------------------------------------------------------------------
# If today is Sunday (7), create a weekly symlink/copy
if [ "$DAY_OF_WEEK" = "7" ]; then
    WEEKLY_FILE="${DB_NAME}_weekly_${DATE_ONLY}.sql.gz"
    cp "$BACKUP_PATH" "${BACKUP_DIR}/${WEEKLY_FILE}"
    log "Weekly backup created: $WEEKLY_FILE"
fi

# If today is the 1st of the month, create a monthly copy
if [ "$DAY_OF_MONTH" = "01" ]; then
    MONTHLY_FILE="${DB_NAME}_monthly_${DATE_ONLY}.sql.gz"
    cp "$BACKUP_PATH" "${BACKUP_DIR}/${MONTHLY_FILE}"
    log "Monthly backup created: $MONTHLY_FILE"
fi

# ---------------------------------------------------------------------------
# Retention cleanup
# ---------------------------------------------------------------------------
log "Applying retention policy..."

# Daily backups: keep last N (files matching academy_YYYY-MM-DD_*.sql.gz, excluding weekly/monthly)
DAILY_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_[0-9]*_[0-9]*.sql.gz" -type f | wc -l)
if [ "$DAILY_COUNT" -gt "$RETAIN_DAILY" ]; then
    DELETE_COUNT=$((DAILY_COUNT - RETAIN_DAILY))
    find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_[0-9]*_[0-9]*.sql.gz" -type f \
        | sort | head -n "$DELETE_COUNT" \
        | while read -r old_file; do
            log "  Removing old daily: $(basename "$old_file")"
            rm -f "$old_file"
        done
fi

# Weekly backups: keep last N
WEEKLY_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_weekly_*.sql.gz" -type f | wc -l)
if [ "$WEEKLY_COUNT" -gt "$RETAIN_WEEKLY" ]; then
    DELETE_COUNT=$((WEEKLY_COUNT - RETAIN_WEEKLY))
    find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_weekly_*.sql.gz" -type f \
        | sort | head -n "$DELETE_COUNT" \
        | while read -r old_file; do
            log "  Removing old weekly: $(basename "$old_file")"
            rm -f "$old_file"
        done
fi

# Monthly backups: keep last N
MONTHLY_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_monthly_*.sql.gz" -type f | wc -l)
if [ "$MONTHLY_COUNT" -gt "$RETAIN_MONTHLY" ]; then
    DELETE_COUNT=$((MONTHLY_COUNT - RETAIN_MONTHLY))
    find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_monthly_*.sql.gz" -type f \
        | sort | head -n "$DELETE_COUNT" \
        | while read -r old_file; do
            log "  Removing old monthly: $(basename "$old_file")"
            rm -f "$old_file"
        done
fi

log "Retention cleanup complete"
log "=== Backup finished ==="
exit 0
