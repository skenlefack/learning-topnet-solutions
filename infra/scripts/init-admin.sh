#!/bin/bash
# ============================================================================
# ARIS Academy — Initial Super-Admin User Creation
# Creates the first admin_continental user for AU-IBAR
#
# Usage:
#   ./infra/scripts/init-admin.sh
#
# Prerequisites:
#   - PostgreSQL container running (academy-postgres)
#   - Node.js available on the host (for bcrypt hashing)
#   - Database initialized with init.sql (tenants table populated)
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CONTAINER_NAME="${CONTAINER_NAME:-academy-postgres}"
DB_NAME="${DB_NAME:-academy}"
DB_USER="${DB_USER:-academy}"
CONTINENTAL_TENANT_ID="00000000-0000-0000-0000-000000000001"

echo "=============================================="
echo " ARIS Academy — Super-Admin Initialization"
echo "=============================================="
echo ""

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
    echo "ERROR: docker command not found"
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running"
    echo "Start services with: docker compose up -d postgres"
    exit 1
fi

if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js not found. Required for password hashing."
    echo "Install Node.js 18+ or run: apt install nodejs"
    exit 1
fi

# Verify the continental tenant exists
TENANT_EXISTS=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
    "SELECT COUNT(*) FROM academy_core.tenants WHERE id = '$CONTINENTAL_TENANT_ID';" 2>/dev/null)

if [ "$TENANT_EXISTS" != "1" ]; then
    echo "ERROR: AU-IBAR continental tenant not found (ID: $CONTINENTAL_TENANT_ID)"
    echo "Run the database initialization first (init.sql / seed.sql)"
    exit 1
fi

echo "AU-IBAR continental tenant found."
echo ""

# ---------------------------------------------------------------------------
# Collect user information
# ---------------------------------------------------------------------------
read -r -p "Email address: " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then
    echo "ERROR: Email is required"
    exit 1
fi

# Check if user already exists
EXISTING=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
    "SELECT COUNT(*) FROM academy_core.users WHERE email = '$ADMIN_EMAIL';" 2>/dev/null)

if [ "$EXISTING" != "0" ]; then
    echo ""
    echo "WARNING: A user with email '$ADMIN_EMAIL' already exists."
    read -r -p "Continue and update their role to admin_continental? (yes/no): " UPDATE_CONFIRM
    if [ "$UPDATE_CONFIRM" = "yes" ]; then
        docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c \
            "UPDATE academy_core.users SET role = 'admin_continental', tenant_id = '$CONTINENTAL_TENANT_ID' WHERE email = '$ADMIN_EMAIL';"
        echo "User '$ADMIN_EMAIL' updated to admin_continental."
        exit 0
    else
        echo "Cancelled."
        exit 0
    fi
fi

read -r -p "First name: " ADMIN_FIRST_NAME
if [ -z "$ADMIN_FIRST_NAME" ]; then
    echo "ERROR: First name is required"
    exit 1
fi

read -r -p "Last name: " ADMIN_LAST_NAME
if [ -z "$ADMIN_LAST_NAME" ]; then
    echo "ERROR: Last name is required"
    exit 1
fi

# Password input (hidden)
read -r -s -p "Password (min 8 characters): " ADMIN_PASSWORD
echo ""

if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
    echo "ERROR: Password must be at least 8 characters"
    exit 1
fi

read -r -s -p "Confirm password: " ADMIN_PASSWORD_CONFIRM
echo ""

if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; then
    echo "ERROR: Passwords do not match"
    exit 1
fi

# Preferred language
echo ""
echo "Preferred language:"
echo "  1) fr - Francais"
echo "  2) en - English"
echo "  3) ar - Arabic"
echo "  4) pt - Portugues"
read -r -p "Select (1-4, default: 1): " LANG_CHOICE

case "${LANG_CHOICE:-1}" in
    1) PREFERRED_LANG="fr" ;;
    2) PREFERRED_LANG="en" ;;
    3) PREFERRED_LANG="ar" ;;
    4) PREFERRED_LANG="pt" ;;
    *) PREFERRED_LANG="fr" ;;
esac

# ---------------------------------------------------------------------------
# Hash password with bcrypt using Node.js
# ---------------------------------------------------------------------------
echo ""
echo "Hashing password..."

# Use Node.js with the built-in crypto module to produce a bcrypt-compatible hash
# We use the pgcrypto-compatible approach: generate hash via Node
PASSWORD_HASH=$(node -e "
const crypto = require('crypto');

// Generate a bcrypt-compatible hash using Node.js crypto
// We use scrypt for the actual hashing, stored in a recognizable format
const password = process.argv[1];
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
// Store as: \$scrypt\$<salt_hex>\$<hash_hex>
console.log('\$scrypt\$' + salt.toString('hex') + '\$' + hash.toString('hex'));
" "$ADMIN_PASSWORD" 2>/dev/null)

# Alternative: If bcryptjs is available via npx, prefer it
if npx --yes bcryptjs --version &>/dev/null 2>&1; then
    PASSWORD_HASH=$(node -e "
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync(process.argv[1], 12);
        console.log(hash);
    " "$ADMIN_PASSWORD" 2>/dev/null) || true
fi

# Fallback: Use PostgreSQL's pgcrypto extension directly
if [ -z "$PASSWORD_HASH" ] || [ "$PASSWORD_HASH" = "" ]; then
    echo "Using PostgreSQL pgcrypto for password hashing..."
    # Escape single quotes in password
    ESCAPED_PASSWORD=$(echo "$ADMIN_PASSWORD" | sed "s/'/''/g")
    PASSWORD_HASH=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
        "SELECT crypt('$ESCAPED_PASSWORD', gen_salt('bf', 12));" 2>/dev/null)
fi

if [ -z "$PASSWORD_HASH" ]; then
    echo "ERROR: Failed to hash password"
    exit 1
fi

echo "Password hashed successfully."

# ---------------------------------------------------------------------------
# Insert admin user
# ---------------------------------------------------------------------------
echo ""
echo "Creating admin user..."

# Escape single quotes for SQL
ESCAPED_EMAIL=$(echo "$ADMIN_EMAIL" | sed "s/'/''/g")
ESCAPED_FIRST=$(echo "$ADMIN_FIRST_NAME" | sed "s/'/''/g")
ESCAPED_LAST=$(echo "$ADMIN_LAST_NAME" | sed "s/'/''/g")
ESCAPED_HASH=$(echo "$PASSWORD_HASH" | sed "s/'/''/g")

INSERT_SQL="
INSERT INTO academy_core.users (
    email, first_name, last_name, role, tenant_id, preferred_language, password_hash, is_active
) VALUES (
    '${ESCAPED_EMAIL}',
    '${ESCAPED_FIRST}',
    '${ESCAPED_LAST}',
    'admin_continental',
    '${CONTINENTAL_TENANT_ID}',
    '${PREFERRED_LANG}',
    '${ESCAPED_HASH}',
    true
) RETURNING id, email, role;
"

RESULT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$INSERT_SQL" 2>&1)

if [ $? -eq 0 ]; then
    echo ""
    echo "=============================================="
    echo " Super-admin created successfully"
    echo "=============================================="
    echo ""
    echo "  Result: $RESULT"
    echo "  Email : $ADMIN_EMAIL"
    echo "  Name  : $ADMIN_FIRST_NAME $ADMIN_LAST_NAME"
    echo "  Role  : admin_continental"
    echo "  Tenant: AU-IBAR Continental ($CONTINENTAL_TENANT_ID)"
    echo "  Lang  : $PREFERRED_LANG"
    echo ""

    # Verify user exists
    VERIFY=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
        "SELECT id, email, role, is_active FROM academy_core.users WHERE email = '${ESCAPED_EMAIL}';" 2>/dev/null)
    echo "  Verification: $VERIFY"
    echo ""
    echo "You can now log in at https://learning.au-ibar.org"
else
    echo "ERROR: Failed to create user"
    echo "$RESULT"
    exit 1
fi

exit 0
