# Topnet Solutions Academy -- Deployment Guide

Complete deployment guide for the Topnet Solutions Academy LMS platform on two Ubuntu VMs.

## Architecture Overview

```
                    Internet
                       |
                  [Traefik v3]
                  (SSL/HTTPS)
                       |
            +----------+----------+
            |                     |
     VM-ACADEMY              VM-BBB
  (8 vCPU, 32GB,         (8 vCPU, 16GB,
   300GB SSD)              200GB SSD)
            |                     |
   +--------+--------+    BigBlueButton 2.7+
   |   |   |   |   | |    (Videoconference)
   FE  C   L   A  Lv |
   |   |   |   |   | |
   +--PostgreSQL--+   |
   |   Redis   Kafka  |
   |   MinIO   Traefik|
   +------------------+

FE = Frontend (Next.js)    C = Course Service (4001)
L  = Learning Service (4002)   A = Assessment Service (4003)
Lv = Live Service (4004)
```

## Prerequisites

- **OS**: Ubuntu 22.04 LTS on both VMs
- **Docker**: Docker Engine 24+ and Docker Compose v2
- **Domain**: DNS A record for `learning.topnet-solutions.com` pointing to VM-ACADEMY
- **Ports**: 80 (HTTP), 443 (HTTPS), 22 (SSH)
- **Git**: For cloning the repository

### Minimum Hardware Specifications

| VM | vCPU | RAM | Storage | Role |
|----|------|-----|---------|------|
| VM-ACADEMY | 8 | 32 GB | 300 GB SSD | Platform (frontend, backend, infra) |
| VM-BBB | 8 | 16 GB | 200 GB SSD | BigBlueButton (videoconference) |

**Total: 16 vCPU / 48 GB RAM / 500 GB SSD**

---

## VM-ACADEMY Setup

### 1. Initial Server Setup

```bash
# System updates
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl git wget unzip htop net-tools

# Create academy user
sudo adduser academy
sudo usermod -aG sudo academy
sudo usermod -aG docker academy

# SSH hardening (edit /etc/ssh/sshd_config)
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Firewall setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (for Let's Encrypt challenge)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### 2. Install Docker

```bash
# Install Docker Engine (official method)
curl -fsSL https://get.docker.com | sh

# Verify installation
docker --version
docker compose version

# Enable Docker to start on boot
sudo systemctl enable docker

# Add academy user to docker group (if not already done)
sudo usermod -aG docker academy
newgrp docker
```

### 3. Clone Repository

```bash
# Switch to academy user
su - academy

# Clone the repository
cd /opt
sudo git clone https://github.com/topnet-solutions/topnet-academy.git /opt/topnet-academy
sudo chown -R academy:academy /opt/topnet-academy
cd /opt/topnet-academy
```

### 4. Configure Environment

```bash
# Copy and edit environment file
cp .env.example .env

# Generate secrets
echo "Generating secrets..."

# PostgreSQL password
PG_PASS=$(openssl rand -base64 32)
sed -i "s/POSTGRES_PASSWORD=CHANGE_ME/POSTGRES_PASSWORD=$PG_PASS/" .env

# JWT secret
JWT_SEC=$(openssl rand -base64 64 | tr -d '\n')
sed -i "s/JWT_SECRET=CHANGE_ME/JWT_SECRET=$JWT_SEC/" .env

# MinIO secret
MINIO_SEC=$(openssl rand -base64 32)
sed -i "s/MINIO_SECRET_KEY=CHANGE_ME/MINIO_SECRET_KEY=$MINIO_SEC/" .env

# Verify all CHANGE_ME values are replaced
grep "CHANGE_ME" .env && echo "WARNING: Some secrets still need to be set!" || echo "All secrets configured."
```

**Required manual configuration in `.env`:**

```bash
# BigBlueButton (from VM-BBB setup)
BBB_URL=https://bbb.topnet-solutions.com/bigbluebutton/
BBB_SECRET=<shared-secret-from-bbb-server>

# Topnet Solutions Core SSO (if applicable)
TOPNET_SSO_CLIENT_SECRET=<from-topnet-core-admin>

# Domain URLs
APP_URL=https://learning.topnet-solutions.com
NEXT_PUBLIC_API_URL=https://learning.topnet-solutions.com/api
```

### 5. SSL/TLS Setup

Traefik automatically manages Let's Encrypt certificates. Ensure:

```bash
# Ports 80 and 443 are open
sudo ufw status

# Verify DNS points to this server
dig +short learning.topnet-solutions.com

# The ACME email is configured in docker-compose.yml:
# --certificatesresolvers.letsencrypt.acme.email=admin@topnet-solutions.com
```

No manual certificate management is needed. Traefik handles renewal automatically.

### 6. Create Backup Directory

```bash
# Create backup directory
sudo mkdir -p /backups/postgres
sudo chown academy:academy /backups/postgres

# Install cron job for automated backups
sudo cp infra/scripts/backup-cron.conf /etc/cron.d/academy-backup
sudo chmod 644 /etc/cron.d/academy-backup

# Create log rotation config
sudo tee /etc/logrotate.d/academy-backup > /dev/null << 'EOF'
/var/log/academy-backup.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
    create 0640 academy academy
}
EOF
```

### 7. Start Services

```bash
cd /opt/topnet-academy

# Pull images and build
docker compose build

# Start all services
docker compose up -d

# Wait for services to initialize (takes 30-60 seconds)
sleep 30

# Verify all services are healthy
docker compose ps
```

Expected output: all services should show "Up" with "(healthy)" where applicable.

### 8. Initialize Database

```bash
# The init.sql and seed.sql run automatically on first boot.
# For a fresh setup, run migrations manually:
docker compose run --rm migrate

# Create the first super-admin user
./infra/scripts/init-admin.sh

# (Optional) Seed demo data for testing
./infra/scripts/seed-demo-data.sh

# For production with reference data only:
./infra/scripts/seed-demo-data.sh --production
```

### 9. Verify Deployment

```bash
# Check that the frontend loads
curl -sI https://learning.topnet-solutions.com | head -5

# Check API health endpoints
curl -s http://localhost:4001/health
curl -s http://localhost:4002/health
curl -s http://localhost:4003/health
curl -s http://localhost:4004/health

# Run the full health check
./infra/scripts/health-check.sh

# Check database connectivity
docker exec academy-postgres psql -U academy -d academy -c "SELECT COUNT(*) FROM academy_core.tenants;"

# Check Traefik dashboard (if enabled)
# Access via http://<server-ip>:8080 (restrict in production)
```

---

## VM-BBB Setup

### 1. BigBlueButton Installation

```bash
# Ensure the server meets BBB requirements
# - Ubuntu 22.04 LTS
# - 8 vCPU, 16 GB RAM
# - Port 80, 443, 16384-32768/UDP open

# Install BigBlueButton 2.7+ using the official script
wget -qO- https://raw.githubusercontent.com/bigbluebutton/bbb-install/v2.7.x-release/bbb-install.sh | bash -s -- -v jammy-27 -s bbb.topnet-solutions.com -e admin@topnet-solutions.com -w

# This installs BBB with:
# - Let's Encrypt SSL for bbb.topnet-solutions.com
# - Greenlight frontend (optional)
# - TURN server for NAT traversal
```

### 2. Configure SSL

SSL is handled by the install script with Let's Encrypt. Verify:

```bash
# Check SSL certificate
curl -sI https://bbb.topnet-solutions.com | head -10

# Check BBB status
sudo bbb-conf --check
sudo bbb-conf --status
```

### 3. Get Shared Secret

```bash
# Retrieve the BBB shared secret
sudo bbb-conf --secret

# Output will show:
#   URL: https://bbb.topnet-solutions.com/bigbluebutton/
#   Secret: <your-shared-secret>
```

Copy the secret and URL for the VM-ACADEMY `.env` configuration.

### 4. Configure Webhooks

```bash
# Install the BBB webhooks module
sudo apt install -y bbb-webhooks

# Configure the webhook URL (edit /etc/bigbluebutton/bbb-webhooks.yml)
sudo tee /etc/bigbluebutton/bbb-webhooks.yml > /dev/null << 'EOF'
hooks:
  permanentURLs:
    - url: "https://learning.topnet-solutions.com/api/live/webhooks/bbb"
      getRaw: false
  queueSize: 100
  retries: 5
  permanentURLs:
    - url: "https://learning.topnet-solutions.com/api/live/webhooks/bbb"
EOF

# Enable recording
sudo bbb-conf --setip bbb.topnet-solutions.com

# Restart BBB
sudo bbb-conf --restart
```

### 5. Configure Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp          # SSH
sudo ufw allow 80/tcp          # HTTP
sudo ufw allow 443/tcp         # HTTPS
sudo ufw allow 16384:32768/udp # WebRTC media (TURN)
sudo ufw enable
```

### 6. Connect to VM-ACADEMY

On **VM-ACADEMY**, update the `.env` file:

```bash
# In /opt/topnet-academy/.env
BBB_URL=https://bbb.topnet-solutions.com/bigbluebutton/
BBB_SECRET=<secret-from-step-3>

# Restart the live service to pick up new config
docker compose restart academy-live
```

Test the connection:

```bash
# From VM-ACADEMY, test BBB API
curl -s "https://bbb.topnet-solutions.com/bigbluebutton/api?checksum=$(echo -n 'getMeetings<BBB_SECRET>' | sha1sum | cut -d' ' -f1)"
```

---

## Maintenance

### Backups

Automated daily backups run at 2:00 AM via cron.

```bash
# Manual full backup
./infra/scripts/backup-postgres.sh

# Schema-only backup
./infra/scripts/backup-postgres.sh --schema-only

# List available backups
ls -lh /backups/postgres/

# Restore from a backup
./infra/scripts/restore-postgres.sh /backups/postgres/academy_2026-03-25_020000.sql.gz

# Non-interactive restore (for scripts/CI)
./infra/scripts/restore-postgres.sh --force /backups/postgres/academy_2026-03-25_020000.sql.gz
```

### Updates

```bash
cd /opt/topnet-academy

# Pull latest code
git pull origin main

# Rebuild services
docker compose build

# Apply database migrations
docker compose run --rm migrate

# Deploy with zero-downtime restart
docker compose up -d

# Verify
docker compose ps
./infra/scripts/health-check.sh
```

### Monitoring

```bash
# Health check (all services)
./infra/scripts/health-check.sh

# Service health endpoints
curl localhost:4001/health   # Course service
curl localhost:4002/health   # Learning service
curl localhost:4003/health   # Assessment service
curl localhost:4004/health   # Live service

# Traefik dashboard
# http://localhost:8080 (internal access only)

# Docker resource usage
docker stats --no-stream

# Collect diagnostic logs
./infra/scripts/logs-collect.sh
./infra/scripts/logs-collect.sh --since 2h
```

### Database Operations

```bash
# Direct database access
docker exec -it academy-postgres psql -U academy academy

# Reset database (DESTRUCTIVE - development only)
./infra/scripts/reset-db.sh

# Seed demo data
./infra/scripts/seed-demo-data.sh

# Create admin user
./infra/scripts/init-admin.sh
```

### Troubleshooting

#### Service Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f academy-course
docker compose logs -f academy-learning
docker compose logs -f academy-assessment
docker compose logs -f academy-live
docker compose logs -f frontend
docker compose logs -f traefik

# Last 100 lines of a service
docker compose logs --tail 100 academy-course
```

#### Database Issues

```bash
# Check PostgreSQL logs
docker compose logs -f academy-postgres

# Check connections
docker exec academy-postgres psql -U academy academy -c "SELECT * FROM pg_stat_activity WHERE datname='academy';"

# Check for locks
docker exec academy-postgres psql -U academy academy -c "SELECT * FROM pg_locks WHERE NOT granted;"

# Restart PostgreSQL
docker compose restart academy-postgres
```

#### Redis Issues

```bash
# Check Redis status
docker exec academy-redis redis-cli INFO

# Check memory
docker exec academy-redis redis-cli INFO memory

# Flush cache (if needed -- will clear sessions)
docker exec academy-redis redis-cli FLUSHDB
```

#### Kafka Issues

```bash
# List topics
docker exec academy-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list

# Check consumer groups
docker exec academy-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list

# Describe a topic
docker exec academy-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic academy.course.published.v1
```

#### SSL/Certificate Issues

```bash
# Check certificate expiry
echo | openssl s_client -connect learning.topnet-solutions.com:443 2>/dev/null | openssl x509 -noout -dates

# Force certificate renewal (Traefik handles this automatically)
docker compose restart traefik

# Check Traefik logs for ACME errors
docker compose logs traefik | grep -i "acme\|certificate\|error"
```

#### Container Restart Loops

```bash
# Check why a container is restarting
docker inspect --format='{{.State.ExitCode}}' <container-name>
docker logs --tail 50 <container-name>

# Common causes:
# - Missing environment variables -> check .env
# - Database not ready -> check postgres healthcheck
# - Port conflicts -> check 'docker compose ps' and 'netstat -tlnp'
```

---

## Security Checklist

- [ ] All `CHANGE_ME` values replaced in `.env`
- [ ] SSH key-based authentication only (passwords disabled)
- [ ] UFW firewall enabled with minimal ports
- [ ] Traefik dashboard secured or disabled in production
- [ ] PostgreSQL not exposed externally (only via Docker network)
- [ ] Redis not exposed externally
- [ ] Kafka not exposed externally
- [ ] Regular backups verified and tested
- [ ] SSL certificates auto-renewing
- [ ] Docker images from trusted registries only
- [ ] Log rotation configured
- [ ] System updates scheduled (unattended-upgrades)

---

## CI/CD (GitHub Actions)

The repository includes GitHub Actions workflows for automated deployment:

1. **On push to `main`**: Build, test, and deploy to VM-ACADEMY via SSH
2. **On pull request**: Run tests and linting only

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | VM-ACADEMY IP address |
| `SSH_USER` | `academy` |
| `SSH_KEY` | Private SSH key for deployment |
| `DOCKER_REGISTRY` | Container registry URL (optional) |

### Manual Deployment

```bash
# On VM-ACADEMY
cd /opt/topnet-academy
git pull origin main
docker compose build
docker compose run --rm migrate
docker compose up -d
./infra/scripts/health-check.sh
```

---

## Useful Commands Reference

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Rebuild a specific service
docker compose build academy-course
docker compose up -d academy-course

# View running containers
docker compose ps

# Resource usage
docker stats

# Clean up unused images/volumes
docker system prune -f
docker volume prune -f   # WARNING: removes unused volumes

# Database shell
docker exec -it academy-postgres psql -U academy academy

# Redis CLI
docker exec -it academy-redis redis-cli
```
