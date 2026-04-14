#!/bin/bash
# ============================================================================
# ARIS Academy — Log Collection Script
# Collects recent logs from all Docker services into a compressed archive
#
# Usage:
#   ./infra/scripts/logs-collect.sh                  # Last 1000 lines per service
#   ./infra/scripts/logs-collect.sh --lines 5000     # Custom line count
#   ./infra/scripts/logs-collect.sh --since 1h       # Docker --since syntax
#
# Output:
#   logs_YYYY-MM-DD_HHMMSS.tar.gz in the current directory
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
LINES=1000
SINCE=""
OUTPUT_DIR="${OUTPUT_DIR:-.}"

# Docker Compose services to collect logs from
SERVICES=(
    "academy-postgres"
    "academy-redis"
    "academy-kafka"
    "academy-course"
    "academy-learning"
    "academy-assessment"
    "academy-live"
    "academy-frontend"
    "academy-traefik"
    "academy-minio"
)

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [ $# -gt 0 ]; do
    case "$1" in
        --lines)
            LINES="$2"
            shift 2
            ;;
        --since)
            SINCE="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [--lines N] [--since DURATION] [--output DIR]"
            echo ""
            echo "Options:"
            echo "  --lines N        Number of log lines per service (default: 1000)"
            echo "  --since DURATION Docker --since format, e.g., '1h', '30m', '24h'"
            echo "  --output DIR     Output directory (default: current directory)"
            echo ""
            echo "Creates: logs_YYYY-MM-DD_HHMMSS.tar.gz"
            exit 0
            ;;
        *)
            echo "ERROR: Unknown argument: $1"
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
echo "=============================================="
echo " ARIS Academy — Log Collection"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

if ! command -v docker &>/dev/null; then
    echo "ERROR: docker command not found"
    exit 1
fi

# Create temporary directory for log files
TEMP_DIR=$(mktemp -d -t "academy-logs-${TIMESTAMP}-XXXXXX")
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "Collecting logs from ${#SERVICES[@]} services..."
if [ -n "$SINCE" ]; then
    echo "Time range: --since $SINCE"
else
    echo "Lines per service: $LINES"
fi
echo ""

# ---------------------------------------------------------------------------
# Collect logs from each service
# ---------------------------------------------------------------------------
COLLECTED=0
SKIPPED=0

for svc in "${SERVICES[@]}"; do
    LOG_FILE="$TEMP_DIR/${svc}.log"

    # Check if container exists (running or stopped)
    if docker ps -a --format '{{.Names}}' | grep -q "^${svc}$" 2>/dev/null; then
        echo "  Collecting: $svc"

        # Build docker logs command
        LOG_CMD="docker logs"
        if [ -n "$SINCE" ]; then
            LOG_CMD="$LOG_CMD --since $SINCE"
        else
            LOG_CMD="$LOG_CMD --tail $LINES"
        fi
        LOG_CMD="$LOG_CMD --timestamps $svc"

        # Capture stdout and stderr
        eval "$LOG_CMD" > "$LOG_FILE" 2>&1 || true

        # Report file size
        if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
            LOG_LINES=$(wc -l < "$LOG_FILE")
            LOG_SIZE=$(du -h "$LOG_FILE" | cut -f1)
            echo "    -> $LOG_LINES lines ($LOG_SIZE)"
            COLLECTED=$((COLLECTED + 1))
        else
            echo "    -> (empty)"
            rm -f "$LOG_FILE"
            SKIPPED=$((SKIPPED + 1))
        fi
    else
        echo "  Skipping: $svc (container not found)"
        SKIPPED=$((SKIPPED + 1))
    fi
done

# ---------------------------------------------------------------------------
# Collect additional system info
# ---------------------------------------------------------------------------
echo ""
echo "  Collecting system info..."

# Docker compose status
docker compose ps > "$TEMP_DIR/docker-compose-ps.txt" 2>&1 || \
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" > "$TEMP_DIR/docker-ps.txt" 2>&1 || true

# Docker system resource usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" \
    > "$TEMP_DIR/docker-stats.txt" 2>&1 || true

# Disk usage summary
df -h > "$TEMP_DIR/disk-usage.txt" 2>&1 || true

# Docker volume sizes
docker system df -v > "$TEMP_DIR/docker-disk-usage.txt" 2>&1 || true

# System uptime and load
uptime > "$TEMP_DIR/uptime.txt" 2>&1 || true

# Memory info
free -h > "$TEMP_DIR/memory.txt" 2>&1 || true

# ---------------------------------------------------------------------------
# Create archive metadata
# ---------------------------------------------------------------------------
{
    echo "ARIS Academy — Log Collection Report"
    echo "====================================="
    echo ""
    echo "Collected at: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "Hostname:     $(hostname)"
    echo "Kernel:       $(uname -r)"
    echo "Docker:       $(docker --version 2>/dev/null || echo 'unknown')"
    echo ""
    echo "Services collected: $COLLECTED"
    echo "Services skipped:   $SKIPPED"
    echo ""
    if [ -n "$SINCE" ]; then
        echo "Time range: --since $SINCE"
    else
        echo "Lines per service: $LINES"
    fi
    echo ""
    echo "Files in archive:"
    ls -lh "$TEMP_DIR" | tail -n +2
} > "$TEMP_DIR/README.txt"

# ---------------------------------------------------------------------------
# Compress into archive
# ---------------------------------------------------------------------------
echo ""
ARCHIVE_NAME="logs_${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="${OUTPUT_DIR}/${ARCHIVE_NAME}"

mkdir -p "$OUTPUT_DIR"
tar -czf "$ARCHIVE_PATH" -C "$TEMP_DIR" . 2>/dev/null

ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)

echo "=============================================="
echo " Log collection complete"
echo "=============================================="
echo ""
echo "  Archive   : $ARCHIVE_PATH"
echo "  Size      : $ARCHIVE_SIZE"
echo "  Services  : $COLLECTED collected, $SKIPPED skipped"
echo ""
echo "  Extract with: tar -xzf $ARCHIVE_NAME"
echo ""

exit 0
