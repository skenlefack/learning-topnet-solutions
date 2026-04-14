#!/bin/bash
# ============================================================================
# ARIS Academy — Health Check Script
# Checks all services, endpoints, disk space, DB connections, Redis memory
#
# Usage:
#   ./infra/scripts/health-check.sh
#
# Exit codes:
#   0 — All services OK
#   1 — One or more warnings (WARN)
#   2 — One or more critical issues (CRITICAL)
# ============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CONTAINER_NAME_PG="${CONTAINER_NAME_PG:-academy-postgres}"
CONTAINER_NAME_REDIS="${CONTAINER_NAME_REDIS:-academy-redis}"
DB_NAME="${DB_NAME:-academy}"
DB_USER="${DB_USER:-academy}"

DISK_WARN_PERCENT=80
DISK_CRIT_PERCENT=95
PG_CONN_WARN_PERCENT=80
PG_CONN_CRIT_PERCENT=95
REDIS_MEM_WARN_PERCENT=80
REDIS_MEM_CRIT_PERCENT=95

# Service health endpoints (host:port/path)
declare -A SERVICE_ENDPOINTS=(
    ["academy-course"]="localhost:4001/health"
    ["academy-learning"]="localhost:4002/health"
    ["academy-assessment"]="localhost:4003/health"
    ["academy-live"]="localhost:4004/health"
    ["frontend"]="localhost:3000"
)

# Counters
OK_COUNT=0
WARN_COUNT=0
CRIT_COUNT=0

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
print_ok() {
    echo "  [  OK  ] $1"
    OK_COUNT=$((OK_COUNT + 1))
}

print_warn() {
    echo "  [ WARN ] $1"
    WARN_COUNT=$((WARN_COUNT + 1))
}

print_crit() {
    echo "  [ CRIT ] $1"
    CRIT_COUNT=$((CRIT_COUNT + 1))
}

# ============================================================================
echo "=============================================="
echo " ARIS Academy — Health Check"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

# ============================================================================
# 1. Docker Service Status
# ============================================================================
echo "--- Docker Containers ---"

if ! command -v docker &>/dev/null; then
    print_crit "Docker is not installed or not in PATH"
else
    EXPECTED_SERVICES=(
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

    for svc in "${EXPECTED_SERVICES[@]}"; do
        STATUS=$(docker ps --filter "name=^${svc}$" --format '{{.Status}}' 2>/dev/null)
        if [ -z "$STATUS" ]; then
            print_crit "$svc — not running"
        elif echo "$STATUS" | grep -qi "unhealthy"; then
            print_warn "$svc — unhealthy ($STATUS)"
        elif echo "$STATUS" | grep -qi "health: starting"; then
            print_warn "$svc — starting ($STATUS)"
        else
            print_ok "$svc — $STATUS"
        fi
    done
fi

echo ""

# ============================================================================
# 2. Health Endpoint Checks
# ============================================================================
echo "--- HTTP Health Endpoints ---"

for svc in "${!SERVICE_ENDPOINTS[@]}"; do
    ENDPOINT="${SERVICE_ENDPOINTS[$svc]}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "http://$ENDPOINT" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        print_ok "$svc — HTTP $HTTP_CODE ($ENDPOINT)"
    elif [ "$HTTP_CODE" = "000" ]; then
        print_crit "$svc — connection failed ($ENDPOINT)"
    elif [ "$HTTP_CODE" -ge 500 ]; then
        print_crit "$svc — HTTP $HTTP_CODE ($ENDPOINT)"
    else
        print_warn "$svc — HTTP $HTTP_CODE ($ENDPOINT)"
    fi
done

echo ""

# ============================================================================
# 3. Disk Space
# ============================================================================
echo "--- Disk Space ---"

while read -r filesystem size used avail percent mountpoint; do
    # Skip header
    [ "$filesystem" = "Filesystem" ] && continue

    # Extract numeric percentage
    pct="${percent%\%}"

    if [ "$pct" -ge "$DISK_CRIT_PERCENT" ]; then
        print_crit "$mountpoint — ${percent} used ($used / $size)"
    elif [ "$pct" -ge "$DISK_WARN_PERCENT" ]; then
        print_warn "$mountpoint — ${percent} used ($used / $size)"
    else
        print_ok "$mountpoint — ${percent} used ($avail available)"
    fi
done < <(df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs -x overlay 2>/dev/null || df -h 2>/dev/null | tail -n +2)

echo ""

# ============================================================================
# 4. PostgreSQL Connections
# ============================================================================
echo "--- PostgreSQL Connections ---"

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME_PG}$" 2>/dev/null; then
    PG_RESULT=$(docker exec "$CONTAINER_NAME_PG" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "
        SELECT
            numbackends AS active,
            (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn
        FROM pg_stat_database
        WHERE datname = '$DB_NAME';
    " 2>/dev/null)

    if [ -n "$PG_RESULT" ]; then
        ACTIVE_CONN=$(echo "$PG_RESULT" | cut -d'|' -f1)
        MAX_CONN=$(echo "$PG_RESULT" | cut -d'|' -f2)

        if [ "$MAX_CONN" -gt 0 ]; then
            CONN_PCT=$((ACTIVE_CONN * 100 / MAX_CONN))
        else
            CONN_PCT=0
        fi

        if [ "$CONN_PCT" -ge "$PG_CONN_CRIT_PERCENT" ]; then
            print_crit "PostgreSQL connections: $ACTIVE_CONN / $MAX_CONN (${CONN_PCT}%)"
        elif [ "$CONN_PCT" -ge "$PG_CONN_WARN_PERCENT" ]; then
            print_warn "PostgreSQL connections: $ACTIVE_CONN / $MAX_CONN (${CONN_PCT}%)"
        else
            print_ok "PostgreSQL connections: $ACTIVE_CONN / $MAX_CONN (${CONN_PCT}%)"
        fi
    else
        print_warn "PostgreSQL — could not query connection stats"
    fi

    # Check database size
    DB_SIZE=$(docker exec "$CONTAINER_NAME_PG" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
        "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null)
    if [ -n "$DB_SIZE" ]; then
        print_ok "PostgreSQL database size: $DB_SIZE"
    fi
else
    print_crit "PostgreSQL container not running — cannot check connections"
fi

echo ""

# ============================================================================
# 5. Redis Memory
# ============================================================================
echo "--- Redis Memory ---"

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME_REDIS}$" 2>/dev/null; then
    REDIS_INFO=$(docker exec "$CONTAINER_NAME_REDIS" redis-cli INFO memory 2>/dev/null)

    if [ -n "$REDIS_INFO" ]; then
        USED_MEM=$(echo "$REDIS_INFO" | grep "^used_memory_human:" | cut -d: -f2 | tr -d '[:space:]')
        MAX_MEM=$(echo "$REDIS_INFO" | grep "^maxmemory_human:" | cut -d: -f2 | tr -d '[:space:]')
        USED_BYTES=$(echo "$REDIS_INFO" | grep "^used_memory:" | cut -d: -f2 | tr -d '[:space:]')
        MAX_BYTES=$(echo "$REDIS_INFO" | grep "^maxmemory:" | cut -d: -f2 | tr -d '[:space:]')

        if [ -n "$MAX_BYTES" ] && [ "$MAX_BYTES" -gt 0 ] 2>/dev/null; then
            MEM_PCT=$((USED_BYTES * 100 / MAX_BYTES))

            if [ "$MEM_PCT" -ge "$REDIS_MEM_CRIT_PERCENT" ]; then
                print_crit "Redis memory: $USED_MEM / $MAX_MEM (${MEM_PCT}%)"
            elif [ "$MEM_PCT" -ge "$REDIS_MEM_WARN_PERCENT" ]; then
                print_warn "Redis memory: $USED_MEM / $MAX_MEM (${MEM_PCT}%)"
            else
                print_ok "Redis memory: $USED_MEM / $MAX_MEM (${MEM_PCT}%)"
            fi
        else
            print_ok "Redis memory: $USED_MEM (no maxmemory limit)"
        fi

        # Key count
        KEY_COUNT=$(docker exec "$CONTAINER_NAME_REDIS" redis-cli DBSIZE 2>/dev/null | grep -o '[0-9]*')
        if [ -n "$KEY_COUNT" ]; then
            print_ok "Redis keys: $KEY_COUNT"
        fi
    else
        print_warn "Redis — could not query memory info"
    fi
else
    print_crit "Redis container not running — cannot check memory"
fi

echo ""

# ============================================================================
# 6. Docker Volume Disk Usage
# ============================================================================
echo "--- Docker Volumes ---"

VOLUME_USAGE=$(docker system df -v 2>/dev/null | grep "aris-academy" || true)
if [ -n "$VOLUME_USAGE" ]; then
    echo "$VOLUME_USAGE" | while read -r line; do
        print_ok "$line"
    done
else
    print_ok "Docker volume stats: use 'docker system df -v' for details"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=============================================="
echo " Summary"
echo "=============================================="
echo ""
echo "  OK       : $OK_COUNT"
echo "  WARNINGS : $WARN_COUNT"
echo "  CRITICAL : $CRIT_COUNT"
echo ""

if [ "$CRIT_COUNT" -gt 0 ]; then
    echo "  Status: CRITICAL"
    echo ""
    exit 2
elif [ "$WARN_COUNT" -gt 0 ]; then
    echo "  Status: WARNING"
    echo ""
    exit 1
else
    echo "  Status: ALL OK"
    echo ""
    exit 0
fi
