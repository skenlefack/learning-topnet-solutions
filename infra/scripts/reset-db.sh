#!/bin/bash
# ============================================================================
# Topnet Solutions Academy — Database Reset Script
# Drops all schemas, recreates from init.sql, runs migrations, optionally seeds
#
# Usage:
#   ./infra/scripts/reset-db.sh                     # Interactive confirmation
#   ./infra/scripts/reset-db.sh --confirm            # Skip confirmation
#   ./infra/scripts/reset-db.sh --confirm --seed     # Reset + seed demo data
#   ./infra/scripts/reset-db.sh --confirm --no-seed  # Reset without seed
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTAINER_NAME="${CONTAINER_NAME:-academy-postgres}"
DB_NAME="${DB_NAME:-academy}"
DB_USER="${DB_USER:-academy}"
CONFIRM=false
SEED_DATA=false
SEED_ASKED=false

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
for arg in "$@"; do
    case "$arg" in
        --confirm)
            CONFIRM=true
            ;;
        --seed)
            SEED_DATA=true
            SEED_ASKED=true
            ;;
        --no-seed)
            SEED_DATA=false
            SEED_ASKED=true
            ;;
        --help|-h)
            echo "Usage: $0 [--confirm] [--seed|--no-seed]"
            echo ""
            echo "Options:"
            echo "  --confirm    Skip interactive confirmation prompt"
            echo "  --seed       Seed demo data after reset"
            echo "  --no-seed    Skip demo data seeding"
            echo ""
            echo "Without --seed or --no-seed, you will be prompted."
            exit 0
            ;;
        *)
            echo "ERROR: Unknown argument: $arg"
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
echo "=============================================="
echo " Topnet Solutions Academy — Database Reset"
echo "=============================================="
echo ""

if ! command -v docker &>/dev/null; then
    echo "ERROR: docker command not found"
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running"
    echo "Start services with: docker compose up -d postgres"
    exit 1
fi

# Check that init.sql exists
INIT_SQL="$PROJECT_ROOT/infra/postgres/init.sql"
if [ ! -f "$INIT_SQL" ]; then
    echo "ERROR: init.sql not found at: $INIT_SQL"
    exit 1
fi

# ---------------------------------------------------------------------------
# Warning and confirmation
# ---------------------------------------------------------------------------
echo "  WARNING: This will DESTROY ALL DATA in the '$DB_NAME' database."
echo ""
echo "  The following operations will be performed:"
echo "    1. Drop all schemas (academy_core and any others)"
echo "    2. Recreate schemas from init.sql"
echo "    3. Run database migrations"
echo "    4. Optionally seed demo data"
echo ""

if [ "$CONFIRM" != true ]; then
    echo "  Type 'RESET' (uppercase) to confirm:"
    read -r CONFIRM_INPUT
    if [ "$CONFIRM_INPUT" != "RESET" ]; then
        echo ""
        echo "Reset cancelled."
        exit 0
    fi
fi

# Ask about seeding if not specified
if [ "$SEED_ASKED" != true ]; then
    read -r -p "  Seed demo data after reset? (y/n): " SEED_ANSWER
    if [ "$SEED_ANSWER" = "y" ] || [ "$SEED_ANSWER" = "Y" ]; then
        SEED_DATA=true
    fi
fi

echo ""
echo "[$(date '+%H:%M:%S')] Starting database reset..."

# ---------------------------------------------------------------------------
# Step 1: Terminate active connections
# ---------------------------------------------------------------------------
echo "[$(date '+%H:%M:%S')] Terminating active connections..."
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
# Step 3: Run init.sql
# ---------------------------------------------------------------------------
echo "[$(date '+%H:%M:%S')] Applying init.sql (schema + RLS policies)..."
docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$INIT_SQL" > /dev/null 2>&1

# Verify schemas were created
SCHEMA_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
    "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'academy_%';")
echo "  Schemas created: $SCHEMA_COUNT"

# ---------------------------------------------------------------------------
# Step 4: Run migrations
# ---------------------------------------------------------------------------
echo "[$(date '+%H:%M:%S')] Running migrations..."

# Check if migrations directory exists and has files
MIGRATIONS_DIR="$PROJECT_ROOT/backend/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
    MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -name "*.sql" -not -name ".pgmigraterc" | wc -l)
    echo "  Found $MIGRATION_COUNT migration file(s)"

    if [ "$MIGRATION_COUNT" -gt 0 ]; then
        # Run migrations via Docker (same approach as docker-compose.yml)
        docker run --rm \
            --network topnet-academy_academy-net \
            -v "$MIGRATIONS_DIR:/app/migrations:ro" \
            -v "$PROJECT_ROOT/backend/package.json:/app/package.json:ro" \
            -w /app \
            -e DATABASE_URL="postgres://${DB_USER}:${POSTGRES_PASSWORD:-academy_secret_2026}@${CONTAINER_NAME}:5432/${DB_NAME}" \
            node:20-alpine \
            npx node-pg-migrate up --migrations-dir migrations --migration-file-language sql 2>&1 || {
                echo "  WARNING: Migration runner failed. Attempting direct SQL application..."
                # Fallback: apply migration SQL files directly
                for migration_file in $(find "$MIGRATIONS_DIR" -name "*.sql" -not -name ".pgmigraterc" | sort); do
                    echo "  Applying: $(basename "$migration_file")"
                    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$migration_file" > /dev/null 2>&1 || true
                done
            }
    fi
else
    echo "  No migrations directory found, skipping"
fi

# ---------------------------------------------------------------------------
# Step 5: Seed data (optional)
# ---------------------------------------------------------------------------
if [ "$SEED_DATA" = true ]; then
    echo "[$(date '+%H:%M:%S')] Seeding demo data..."
    if [ -f "$SCRIPT_DIR/seed-demo-data.sh" ]; then
        bash "$SCRIPT_DIR/seed-demo-data.sh"
    elif [ -f "$PROJECT_ROOT/infra/postgres/seed.sql" ]; then
        echo "  Applying seed.sql directly..."
        docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$PROJECT_ROOT/infra/postgres/seed.sql"
    else
        echo "  WARNING: No seed script found"
    fi
else
    echo "[$(date '+%H:%M:%S')] Skipping demo data (--no-seed)"
fi

# ---------------------------------------------------------------------------
# Step 6: Verify
# ---------------------------------------------------------------------------
echo ""
echo "[$(date '+%H:%M:%S')] Verifying database state..."
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
ORDER BY table_name;
"

VERIFY_RESULT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -F '|' -c "$VERIFY_SQL" 2>&1)

printf "  %-25s %s\n" "TABLE" "ROWS"
echo "  -----------------------------------"
echo "$VERIFY_RESULT" | while IFS='|' read -r table count; do
    printf "  %-25s %s\n" "$table" "$count"
done

echo ""
echo "=============================================="
echo " Database reset complete"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  - Create admin: ./infra/scripts/init-admin.sh"
echo "  - Start services: docker compose up -d"
echo ""

exit 0
