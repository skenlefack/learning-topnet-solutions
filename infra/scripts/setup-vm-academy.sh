#!/bin/bash
###############################################################################
# ARIS Academy — VM-ACADEMY Initial Setup Script
# Target: nbo-lms02 (10.202.101.144) — Ubuntu 22.04
# User: lms
# Run this script ONCE on the VM to set up the environment
###############################################################################

set -euo pipefail

echo "=============================================="
echo " ARIS Academy — VM Setup"
echo " Server: nbo-lms02 (10.202.101.144)"
echo "=============================================="

# ---------------------------------------------------------------------------
# 1. Install Docker & Docker Compose (if not present)
# ---------------------------------------------------------------------------
if ! command -v docker &> /dev/null; then
  echo "[1/7] Installing Docker..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
  echo "Docker installed. You may need to log out and back in for group changes."
else
  echo "[1/7] Docker already installed: $(docker --version)"
fi

# ---------------------------------------------------------------------------
# 2. Install Git (if not present)
# ---------------------------------------------------------------------------
if ! command -v git &> /dev/null; then
  echo "[2/7] Installing Git..."
  sudo apt-get install -y -qq git
else
  echo "[2/7] Git already installed: $(git --version)"
fi

# ---------------------------------------------------------------------------
# 3. Clone the repository
# ---------------------------------------------------------------------------
echo "[3/7] Cloning repository..."
DEPLOY_DIR="/opt/aris-academy"

if [ -d "$DEPLOY_DIR" ]; then
  echo "  Directory exists, pulling latest..."
  cd "$DEPLOY_DIR"
  git pull origin main
else
  sudo mkdir -p "$DEPLOY_DIR"
  sudo chown "$USER":"$USER" "$DEPLOY_DIR"
  git clone http://10.202.101.167/ict-au-ibar-development/e-learning-au-ibar.git "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# ---------------------------------------------------------------------------
# 4. Generate production .env with secure secrets
# ---------------------------------------------------------------------------
echo "[4/7] Generating production .env..."
ENV_FILE="$DEPLOY_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  echo "  .env already exists — skipping (backup at .env.bak)"
  cp "$ENV_FILE" "$ENV_FILE.bak"
else
  PG_PASSWORD=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
  JWT_SECRET=$(openssl rand -base64 64 | tr -d '=/+' | head -c 64)
  MINIO_SECRET=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
  GRAFANA_PASSWORD=$(openssl rand -base64 16 | tr -d '=/+' | head -c 16)

  cat > "$ENV_FILE" << ENVEOF
# ============================================================================
# ARIS Academy — Production Environment
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Server: nbo-lms02 (10.202.101.144)
# ============================================================================

NODE_ENV=production

# --- PostgreSQL ---
POSTGRES_USER=academy
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=academy

# --- JWT ---
JWT_SECRET=${JWT_SECRET}

# --- MinIO ---
MINIO_ACCESS_KEY=academy_minio
MINIO_SECRET_KEY=${MINIO_SECRET}

# --- BigBlueButton (VM-BBB: 10.202.101.145) ---
BBB_URL=http://10.202.101.145/bigbluebutton/
BBB_SECRET=CHANGE_ME_WITH_BBB_SECRET

# --- Application URLs ---
APP_URL=https://learning.au-ibar.org
NEXT_PUBLIC_API_URL=https://learning.au-ibar.org/api
NEXT_PUBLIC_APP_URL=https://learning.au-ibar.org

# --- ARIS SSO ---
ARIS_SSO_URL=https://au-ibar.org/api/auth
ARIS_SSO_CLIENT_ID=academy-client
ARIS_SSO_CLIENT_SECRET=CHANGE_ME

# --- Grafana ---
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=${GRAFANA_PASSWORD}

# --- SMTP (for Alertmanager notifications) ---
SMTP_HOST=mail.au-ibar.org
SMTP_PORT=587
SMTP_USER=lms-alerts@au-ibar.org
SMTP_PASSWORD=CHANGE_ME_SMTP_PASSWORD
ENVEOF

  chmod 600 "$ENV_FILE"
  echo "  .env created with generated secrets"
  echo ""
  echo "  ╔══════════════════════════════════════════════════════╗"
  echo "  ║  IMPORTANT: Update BBB_SECRET in .env               ║"
  echo "  ║  Get it from VM-BBB: 10.202.101.145                 ║"
  echo "  ║  Command: cat /etc/bigbluebutton/bbb-web.properties ║"
  echo "  ║  Look for: securitySalt=...                         ║"
  echo "  ╚══════════════════════════════════════════════════════╝"
  echo ""
fi

# ---------------------------------------------------------------------------
# 4b. Configure Alertmanager SMTP from .env
# ---------------------------------------------------------------------------
echo "[4b/7] Configuring Alertmanager SMTP..."
ALERTMANAGER_CFG="$DEPLOY_DIR/infra/monitoring/alertmanager.yml"
if [ -f "$ALERTMANAGER_CFG" ] && [ -f "$ENV_FILE" ]; then
  SMTP_PASS=$(grep '^SMTP_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2-)
  if [ -n "$SMTP_PASS" ] && [ "$SMTP_PASS" != "CHANGE_ME_SMTP_PASSWORD" ]; then
    sed -i "s|SMTP_PASSWORD_SET_BY_SETUP|${SMTP_PASS}|g" "$ALERTMANAGER_CFG"
    echo "  Alertmanager SMTP password configured"
  else
    echo "  ⚠ SMTP_PASSWORD not set in .env — update it and re-run, or edit alertmanager.yml manually"
  fi
fi

# ---------------------------------------------------------------------------
# 5. Configure DNS resolution (learning.au-ibar.org → localhost)
# ---------------------------------------------------------------------------
echo "[5/7] Configuring DNS..."
if ! grep -q "learning.au-ibar.org" /etc/hosts; then
  echo "127.0.0.1 learning.au-ibar.org" | sudo tee -a /etc/hosts > /dev/null
  echo "  Added learning.au-ibar.org to /etc/hosts"
else
  echo "  learning.au-ibar.org already in /etc/hosts"
fi

# ---------------------------------------------------------------------------
# 6. Configure firewall
# ---------------------------------------------------------------------------
echo "[6/7] Configuring firewall..."
if command -v ufw &> /dev/null; then
  sudo ufw allow 22/tcp   # SSH
  sudo ufw allow 80/tcp   # HTTP (Traefik)
  sudo ufw allow 443/tcp  # HTTPS (future)
  sudo ufw --force enable 2>/dev/null || true
  echo "  Firewall configured (ports 22, 80, 443)"
else
  echo "  ufw not installed — skipping firewall setup"
fi

# ---------------------------------------------------------------------------
# 7. Build and start containers
# ---------------------------------------------------------------------------
echo "[7/7] Building and starting containers..."
cd "$DEPLOY_DIR"

# Build all images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --parallel

# Start all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo ""
echo "Waiting for services to start (30s)..."
sleep 30

# Health checks
echo ""
echo "=============================================="
echo " Health Checks"
echo "=============================================="
check_service() {
  if curl -sf "http://localhost:$1$2" > /dev/null 2>&1; then
    echo "  ✓ $3 (port $1) — OK"
  else
    echo "  ✗ $3 (port $1) — FAILED"
  fi
}

check_service 3000 "/" "Frontend"
check_service 4001 "/health" "Course Service"
check_service 4002 "/health" "Learning Service"
check_service 4003 "/health" "Assessment Service"
check_service 4004 "/health" "Live Service"

echo ""
echo "=============================================="
echo " Container Status"
echo "=============================================="
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=============================================="
echo " Setup Complete!"
echo "=============================================="
echo ""
echo " Application:  https://learning.au-ibar.org"
echo " Grafana:       https://learning.au-ibar.org:3001"
echo " MinIO Console: http://localhost:9001 (internal only)"
echo ""
echo " Default login: serge@au-ibar.org / academy2026"
echo ""
echo " Next steps:"
echo "  1. Update BBB_SECRET in /opt/aris-academy/.env"
echo "  2. Update SMTP_PASSWORD in /opt/aris-academy/.env (then re-run step 4b or edit alertmanager.yml)"
echo "  3. Setup backup cron: cp infra/scripts/backup-cron.conf /etc/cron.d/aris-backup"
echo "  4. TLS certificate will be auto-provisioned by Let's Encrypt on first HTTPS request"
echo ""
