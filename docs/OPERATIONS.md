# ARIS Academy -- Operations Runbook

> **Production domain:** `https://learning.au-ibar.org`
> **Infrastructure:** Docker Compose on Ubuntu VMs

---

## Table of Contents

1. [Service Architecture](#1-service-architecture)
2. [Starting and Stopping](#2-starting-and-stopping)
3. [Health Checks](#3-health-checks)
4. [Monitoring](#4-monitoring)
5. [Log Management](#5-log-management)
6. [Database Operations](#6-database-operations)
7. [Kafka Operations](#7-kafka-operations)
8. [MinIO (Object Storage)](#8-minio-object-storage)
9. [Scaling Considerations](#9-scaling-considerations)
10. [Common Issues and Troubleshooting](#10-common-issues-and-troubleshooting)

---

## 1. Service Architecture

ARIS Academy is composed of four Fastify microservices, a Next.js frontend, and supporting infrastructure services.

### Application Services

| Service             | Port | Description                                      |
|---------------------|------|--------------------------------------------------|
| academy-course      | 4001 | Course, module, and lesson management            |
| academy-learning    | 4002 | Auth, enrollments, progress, community, admin    |
| academy-assessment  | 4003 | Assessments, attempts, certifications, questions |
| academy-live        | 4004 | Live sessions, BBB integration, recordings       |
| frontend            | 3000 | Next.js 14 application                           |

### Infrastructure Services

| Service       | Port(s)       | Description                                |
|---------------|---------------|--------------------------------------------|
| PostgreSQL 16 | 5432          | Primary database with RLS multi-tenancy    |
| Redis         | 6379          | Caching, sessions, video heartbeat buffer  |
| Kafka (KRaft) | 9092          | Event streaming (no ZooKeeper)             |
| MinIO         | 9000 / 9001   | S3-compatible object storage (API / console) |
| Traefik v3    | 80 / 443 / 8080 | Reverse proxy, TLS termination, routing |

### Monitoring Stack

| Service              | Port  | Description                    |
|----------------------|-------|--------------------------------|
| Prometheus           | 9090  | Metrics collection             |
| Grafana              | 3001  | Dashboards and alerting        |
| AlertManager         | 9093  | Alert routing                  |
| node-exporter        | 9100  | Host metrics                   |
| postgres-exporter    | 9187  | PostgreSQL metrics             |
| redis-exporter       | 9121  | Redis metrics                  |

### Network Topology

```
Internet
  |
  +-- Traefik v3 (ports 80/443)
       |
       +-- frontend       (3000)
       +-- academy-course  (4001)
       +-- academy-learning(4002)
       +-- academy-assessment(4003)
       +-- academy-live    (4004)
       +-- Grafana         (3001)  -- /grafana path
       |
       +-- [internal only: monitoring-net]
            +-- Prometheus (9090)
            +-- AlertManager (9093)
            +-- exporters
       |
       +-- [internal only: backend-net]
            +-- PostgreSQL (5432)
            +-- Redis      (6379)
            +-- Kafka      (9092)
            +-- MinIO      (9000)
```

### External Dependency

| Service        | Host    | Description                           |
|----------------|---------|---------------------------------------|
| BigBlueButton  | VM-BBB  | Video conferencing (separate VM)      |

---

## 2. Starting and Stopping

### Development

```bash
# Start all services
docker compose up -d

# Start specific service
docker compose up -d academy-course

# Stop all services
docker compose down

# Stop and remove volumes (DESTROYS DATA)
docker compose down -v
```

### Production

```bash
# Start with production overlay
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Stop
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Restart a single service (zero-downtime with Traefik health checks)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps academy-course
```

### Build and Deploy

```bash
# Rebuild images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Rebuild a single service
docker compose -f docker-compose.yml -f docker-compose.prod.yml build academy-learning

# Pull latest and restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Startup Order

Services depend on infrastructure. Docker Compose `depends_on` with health checks ensures correct ordering:

1. PostgreSQL, Redis, Kafka, MinIO start first
2. Kafka topic initialization runs (`init-kafka-topics`)
3. MinIO bucket initialization runs (`init-minio`)
4. Application services start after infrastructure is healthy
5. Frontend starts last
6. Traefik routes traffic once health checks pass

---

## 3. Health Checks

### Endpoints

Every microservice exposes two health endpoints:

| Endpoint         | Purpose                              | Checks                        |
|------------------|--------------------------------------|-------------------------------|
| `GET /health`    | Liveness -- is the process running?  | Returns 200 if process is up  |
| `GET /health/ready` | Readiness -- can it serve traffic? | Checks DB connectivity        |

### Health check responses

**Healthy:**

```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-04-17T12:00:00Z"
}
```

**Unhealthy (readiness):**

```json
{
  "status": "error",
  "checks": {
    "database": "connection refused"
  }
}
```

### Automated Health Script

```bash
# Check all services
bash infra/scripts/health-check.sh
```

This script pings every service's `/health` and `/health/ready` endpoints and reports status. It exits with code 1 if any service is unhealthy.

### Manual Spot Check

```bash
# Check individual services
curl http://localhost:4001/health
curl http://localhost:4002/health/ready
curl http://localhost:4003/health
curl http://localhost:4004/health/ready
```

### Docker Health Checks

Each Dockerfile includes a `HEALTHCHECK` instruction. Docker marks containers as `healthy`, `unhealthy`, or `starting`. View status:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

## 4. Monitoring

### Grafana

- **Production:** `https://learning.au-ibar.org/grafana`
- **Development:** `http://localhost:3001`
- **Default credentials:** Set via `GF_SECURITY_ADMIN_PASSWORD` in `.env`

### Key Dashboards

| Dashboard           | Description                                          |
|---------------------|------------------------------------------------------|
| Overview            | All services status, request rate, error rate         |
| Request Rate        | Per-service HTTP requests/sec, broken down by status  |
| Latency             | P50/P95/P99 latency per service and endpoint          |
| PostgreSQL          | Connections, queries/sec, replication lag, cache hit   |
| Redis               | Memory usage, hit/miss ratio, evictions, connections  |
| Kafka               | Consumer lag, partition distribution, throughput       |

### Prometheus

- **Internal only** -- accessible on the `monitoring-net` Docker network.
- Scrapes all services at `/metrics` (Fastify prom-client).
- Scrapes infrastructure exporters (node, postgres, redis).
- Config: `infra/prometheus/prometheus.yml`

### AlertManager

- **Internal only** -- routes alerts from Prometheus.
- Email notifications sent to: `ops-team@au-ibar.org`
- Config: `infra/alertmanager/alertmanager.yml`

### Key Alerts

| Alert                       | Condition                          | Severity |
|-----------------------------|------------------------------------|----------|
| ServiceDown                 | Health check fails for > 2 min     | critical |
| HighErrorRate               | 5xx rate > 5% for 5 min           | critical |
| HighLatency                 | P95 > 2s for 5 min                | warning  |
| DatabaseConnectionsHigh     | Active connections > 80%           | warning  |
| KafkaConsumerLag            | Lag > 1000 for 10 min             | warning  |
| RedisMemoryHigh             | Memory > 80% of maxmemory         | warning  |
| DiskSpaceRunningLow         | < 15% free                        | critical |

---

## 5. Log Management

### Live Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f academy-course

# Last 100 lines
docker compose logs --tail 100 academy-learning

# Multiple services
docker compose logs -f academy-course academy-learning
```

### Log Format

| Environment | Format       | Library       |
|-------------|--------------|---------------|
| Development | Pretty-print | pino-pretty   |
| Production  | JSON (NDJSON)| pino          |

### Production log example

```json
{
  "level": 30,
  "time": 1713355200000,
  "pid": 1,
  "hostname": "academy-course-abc123",
  "reqId": "req-1",
  "req": { "method": "GET", "url": "/courses" },
  "res": { "statusCode": 200 },
  "responseTime": 12,
  "msg": "request completed"
}
```

### Log Collection

```bash
# Collect and archive logs
bash infra/scripts/logs-collect.sh
```

This script gathers logs from all containers and stores them in a timestamped archive for analysis.

### Searching Logs

```bash
# Search for errors in a service
docker compose logs academy-assessment 2>&1 | grep '"level":50'

# Search by request ID
docker compose logs academy-learning 2>&1 | grep 'req-abc123'
```

---

## 6. Database Operations

### Connection Details

| Parameter | Dev                  | Prod                          |
|-----------|----------------------|-------------------------------|
| Host      | localhost            | postgres (Docker network)     |
| Port      | 5432                 | 5432                          |
| Database  | aris_academy         | aris_academy                  |
| User      | from `.env`          | from `.env`                   |
| Password  | from `.env`          | from `.env`                   |

### Migrations

```bash
# Run pending migrations
npx node-pg-migrate up

# Check migration status
npx node-pg-migrate status

# Rollback last migration
npx node-pg-migrate down
```

Migration files are located in `services/shared/migrations/`.

### Seeding

```bash
# Load demo data (courses, users, enrollments)
bash infra/scripts/seed-demo-data.sh
```

### Reset (Development Only)

```bash
# WARNING: Destroys all data
bash infra/scripts/reset-db.sh
```

### Backup and Restore

```bash
# Backup
bash infra/scripts/backup-db.sh
# Creates: backups/aris_academy_YYYYMMDD_HHMMSS.sql.gz

# Restore from backup
bash infra/scripts/restore-db.sh backups/aris_academy_20260417_120000.sql.gz
```

### Useful Queries

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Long-running queries (> 30 seconds)
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND now() - pg_stat_activity.query_start > interval '30 seconds';

-- Table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;

-- RLS policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

---

## 7. Kafka Operations

### Topic Initialization

```bash
bash infra/scripts/init-kafka-topics.sh
```

### Topics

The platform uses 14 Kafka topics:

| Topic                              | Producer           | Consumer(s)              |
|------------------------------------|--------------------|--------------------------|
| `academy.course.created`           | course             | learning                 |
| `academy.course.updated`           | course             | learning                 |
| `academy.course.published`         | course             | learning, assessment     |
| `academy.course.archived`          | course             | learning                 |
| `academy.enrollment.created`       | learning           | course, assessment       |
| `academy.enrollment.completed`     | learning           | assessment               |
| `academy.progress.updated`         | learning           | course                   |
| `academy.assessment.submitted`     | assessment         | learning                 |
| `academy.assessment.passed`        | assessment         | learning                 |
| `academy.certification.issued`     | assessment         | learning                 |
| `academy.certification.revoked`    | assessment         | learning                 |
| `academy.session.scheduled`        | live               | learning                 |
| `academy.session.started`          | live               | learning                 |
| `academy.session.ended`            | live               | learning                 |

### Consumer Groups

Consumer group naming convention: `academy-{service}-{function}`

Examples:
- `academy-learning-enrollment`
- `academy-assessment-certification`
- `academy-course-progress`

### Monitoring Consumer Lag

```bash
# Via Kafka CLI inside the container
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group academy-learning-enrollment
```

Consumer lag is also visible in the Grafana Kafka dashboard.

### Reset Consumer Offsets (Use with Caution)

```bash
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group academy-learning-enrollment \
  --reset-offsets --to-earliest \
  --topic academy.course.created \
  --execute
```

---

## 8. MinIO (Object Storage)

### Bucket Initialization

```bash
bash infra/scripts/init-minio.sh
```

### Buckets

| Bucket         | Purpose                                 |
|----------------|-----------------------------------------|
| `videos`       | Lesson video files and recordings       |
| `documents`    | Lesson documents (PDF, slides, etc.)    |
| `avatars`      | User profile pictures                   |
| `certificates` | Generated certificate PDFs              |

### Access

| Parameter    | Dev                     | Prod                    |
|--------------|-------------------------|-------------------------|
| Endpoint     | `http://localhost:9000` | `http://minio:9000`     |
| Console      | `http://localhost:9001` | Internal only           |
| Access Key   | from `.env`             | from `.env`             |
| Secret Key   | from `.env`             | from `.env`             |

### Useful Commands

```bash
# List buckets (using mc CLI inside container)
docker compose exec minio mc ls local/

# Check bucket size
docker compose exec minio mc du local/videos

# Remove orphaned files (dry run)
docker compose exec minio mc rm --recursive --dry-run local/videos/orphaned/
```

---

## 9. Scaling Considerations

### VM-ACADEMY (Application Server)

| Resource    | Value     |
|-------------|-----------|
| vCPU        | 8         |
| RAM         | 32 GB     |
| Storage     | 300 GB    |

### VM-BBB (BigBlueButton Server)

| Resource    | Value     |
|-------------|-----------|
| vCPU        | 8         |
| RAM         | 16 GB     |
| Storage     | 200 GB    |

**Total: 16 vCPU / 48 GB RAM / 500 GB storage**

### Resource Limits

Production resource limits are defined in `docker-compose.prod.yml`:

| Service             | CPU Limit | Memory Limit |
|---------------------|-----------|--------------|
| frontend            | 1         | 512 MB       |
| academy-course      | 1         | 512 MB       |
| academy-learning    | 1.5       | 768 MB       |
| academy-assessment  | 1         | 512 MB       |
| academy-live        | 1         | 512 MB       |
| PostgreSQL          | 2         | 4 GB         |
| Redis               | 0.5       | 512 MB       |
| Kafka               | 2         | 2 GB         |
| MinIO               | 1         | 1 GB         |

### Scaling Strategies

- **Horizontal**: Run multiple replicas of stateless services behind Traefik. Requires sticky sessions or shared session store (Redis already in place).
- **Vertical**: Increase VM resources if workload exceeds current limits.
- **Database**: Add read replicas for read-heavy analytics queries.
- **Kafka**: Increase partition count for high-throughput topics.
- **BBB**: Add additional BBB servers behind Scalelite for more concurrent sessions.

---

## 10. Common Issues and Troubleshooting

### Service Won't Start

```bash
# 1. Check container status
docker ps -a --filter "name=academy"

# 2. Check logs for the failing service
docker compose logs --tail 50 academy-course

# 3. Check health endpoint
curl http://localhost:4001/health

# 4. Check if dependencies are ready
curl http://localhost:4001/health/ready

# 5. Common causes:
#    - .env file missing or incomplete
#    - Port conflict (another process on 4001-4004)
#    - Database not yet ready (migration pending)
#    - Kafka not yet accepting connections (give it 30s)
```

### Database Connection Issues

```bash
# Check active connections
docker compose exec postgres psql -U $POSTGRES_USER -d aris_academy \
  -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections (if pool exhausted)
docker compose exec postgres psql -U $POSTGRES_USER -d aris_academy \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '10 minutes';"

# Check connection pool settings in .env:
#   DB_POOL_MIN=2
#   DB_POOL_MAX=20
```

### Kafka Consumer Lag

```bash
# Check lag for all consumer groups
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --all-groups

# If lag is growing:
# 1. Check consumer service logs for errors
# 2. Check if consumer is connected
# 3. Restart the consuming service
docker compose restart academy-learning
```

### Redis Memory Pressure

```bash
# Check memory usage
docker compose exec redis redis-cli INFO memory

# Check eviction stats
docker compose exec redis redis-cli INFO stats | grep evicted

# If memory is high:
# 1. Check for large keys
docker compose exec redis redis-cli --bigkeys

# 2. Flush video heartbeat buffer (safe, data is ephemeral)
docker compose exec redis redis-cli KEYS "heartbeat:*" | xargs docker compose exec redis redis-cli DEL
```

### Traefik Routing Issues

```bash
# Check Traefik dashboard (dev only)
# http://localhost:8080/dashboard/

# Check registered routers
curl http://localhost:8080/api/http/routers | jq .

# Check service health in Traefik
curl http://localhost:8080/api/http/services | jq .

# Common causes:
# - Service not healthy (Traefik won't route to unhealthy backends)
# - Label mismatch in docker-compose.yml
# - TLS certificate not yet issued (check Traefik logs)
```

### MinIO Upload Failures

```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live

# Check bucket existence
docker compose exec minio mc ls local/

# Recreate missing buckets
bash infra/scripts/init-minio.sh

# Common causes:
# - Bucket not initialized after fresh deploy
# - Disk space exhausted on VM
# - Access key mismatch between service and MinIO
```

### Frontend Not Loading

```bash
# Check frontend container
docker compose logs --tail 50 frontend

# Common causes:
# - Build failure (check build logs)
# - API services not reachable (check NEXT_PUBLIC_API_URL in .env)
# - Node memory limit exceeded (increase in docker-compose.prod.yml)
```

### Emergency Procedures

#### Full Service Restart

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### Database Restore from Backup

```bash
# 1. Stop application services (keep PostgreSQL running)
docker compose stop academy-course academy-learning academy-assessment academy-live frontend

# 2. Restore
bash infra/scripts/restore-db.sh backups/aris_academy_YYYYMMDD_HHMMSS.sql.gz

# 3. Restart services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### Rollback Deployment

```bash
# 1. Check previous image tags
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | grep academy

# 2. Update docker-compose.prod.yml with previous image tags
# 3. Restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

*ARIS Academy Operations Runbook -- April 2026*
