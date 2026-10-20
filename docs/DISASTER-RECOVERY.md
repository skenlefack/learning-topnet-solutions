# Disaster Recovery Plan

**Topnet Solutions Academy** — learning.topnet-solutions.com
**Last updated**: 2026-04-17

---

## Table of Contents

1. [Backup Strategy](#1-backup-strategy)
2. [PostgreSQL Backup & Restore](#2-postgresql-backup--restore)
3. [Redis Backup & Restore](#3-redis-backup--restore)
4. [MinIO (Object Storage)](#4-minio-object-storage)
5. [Kafka](#5-kafka)
6. [Full VM Recovery](#6-full-vm-recovery)
7. [Recovery Time Objectives](#7-recovery-time-objectives)
8. [Testing the Recovery Plan](#8-testing-the-recovery-plan)

---

## 1. Backup Strategy

### What is backed up

| Component   | Data                                          | Method              | Frequency          | Retention                          |
|-------------|-----------------------------------------------|---------------------|--------------------|------------------------------------|
| PostgreSQL  | Full database dump                            | `pg_dump` (custom)  | Daily 2:00 AM      | 30 daily, 12 weekly, 6 monthly    |
| PostgreSQL  | Schema-only dump                              | `pg_dump --schema-only` | 1st of month 1:00 AM | 6 monthly                      |
| Redis       | AOF + RDB snapshots                           | Built-in persistence | Continuous (AOF)  | Current state on disk              |
| MinIO       | Object storage volume (`minio_data`)          | `tar` archive        | Manual / scripted | Depends on operator schedule       |
| Kafka       | Topic data in `kafka_data` volume             | N/A (transient)      | Not backed up     | Topics auto-created by services    |

### Storage locations

- **Primary backups**: `/backups/postgres/` on VM-ACADEMY (300 GB disk)
- **MinIO archives**: `/backups/minio/` on VM-ACADEMY
- **Off-site** (recommended): Copy critical backups to external storage or a second VM periodically

### Cron schedule (`infra/scripts/backup-cron.conf`)

```
# Daily full backup at 2:00 AM
0 2 * * *       /opt/academy/infra/scripts/backup-postgres.sh

# Weekly cleanup every Sunday at 3:00 AM
0 3 * * 0       /opt/academy/infra/scripts/backup-postgres.sh --cleanup

# Monthly schema-only backup on the 1st at 1:00 AM
0 1 1 * *       /opt/academy/infra/scripts/backup-postgres.sh --schema-only
```

---

## 2. PostgreSQL Backup & Restore

### Automated backups

The script `infra/scripts/backup-postgres.sh` (218 lines) handles:

- **Full backups** (`pg_dump -Fc`) — compressed custom format, suitable for `pg_restore`
- **Schema-only backups** — DDL only, useful for auditing schema changes
- **Retention policy**: 30 daily, 12 weekly, 6 monthly — old backups are pruned automatically

Backups are triggered by cron (see `infra/scripts/backup-cron.conf`).

### Manual backup

```bash
# Full backup (custom format, compressed)
docker exec academy-postgres pg_dump \
  -U topnet_user -d topnet_academy \
  -Fc -f /tmp/manual-backup.dump

# Copy out of container
docker cp academy-postgres:/tmp/manual-backup.dump /backups/postgres/

# Schema-only backup
docker exec academy-postgres pg_dump \
  -U topnet_user -d topnet_academy \
  --schema-only -f /tmp/schema-backup.sql

docker cp academy-postgres:/tmp/schema-backup.sql /backups/postgres/
```

### Restore

Use the interactive restore script `infra/scripts/restore-postgres.sh` (213 lines):

```bash
# Interactive restore (prompts for confirmation)
./infra/scripts/restore-postgres.sh /backups/postgres/daily/topnet_academy_2026-04-17.dump

# Force restore (no confirmation, terminates active connections)
./infra/scripts/restore-postgres.sh /backups/postgres/daily/topnet_academy_2026-04-17.dump --force
```

The restore script:
1. Validates the backup file exists and is readable
2. Terminates all active connections to the database
3. Drops and recreates the database
4. Restores from the backup using `pg_restore`
5. Verifies restoration by checking table counts

### Manual restore

```bash
# Stop application services (keep postgres running)
docker compose stop course-service learning-service assessment-service live-service frontend

# Terminate active connections
docker exec academy-postgres psql -U topnet_user -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'topnet_academy' AND pid <> pg_backend_pid();"

# Drop and recreate
docker exec academy-postgres psql -U topnet_user -d postgres -c "DROP DATABASE IF EXISTS topnet_academy;"
docker exec academy-postgres psql -U topnet_user -d postgres -c "CREATE DATABASE topnet_academy OWNER topnet_user;"

# Restore
docker cp /backups/postgres/daily/topnet_academy_2026-04-17.dump academy-postgres:/tmp/restore.dump
docker exec academy-postgres pg_restore -U topnet_user -d topnet_academy /tmp/restore.dump

# Restart services
docker compose up -d
```

### Point-in-time recovery considerations

The current backup strategy uses daily `pg_dump` snapshots, which means the RPO is up to 24 hours. For tighter RPO:

- **Enable WAL archiving**: Configure `archive_mode = on` and `archive_command` in PostgreSQL to ship WAL segments to a backup location
- **Continuous archiving**: Combined with a base backup, WAL archives enable point-in-time recovery to any moment between backups
- **pgBackRest or Barman**: Consider these tools for production-grade continuous backup with PITR support

> **Note**: WAL archiving is not currently configured. For the current 55-country deployment, enabling WAL archiving is strongly recommended to reduce RPO from 24 hours to seconds.

---

## 3. Redis Backup & Restore

### Persistence configuration

Redis is configured with **AOF (Append-Only File)** persistence in the Docker Compose configuration. This provides:

- Every write operation is logged to `appendonly.aof`
- On restart, Redis replays the AOF to reconstruct state
- Near-zero data loss for cache and session data

### Manual backup

```bash
# Trigger a background save (creates/updates dump.rdb)
docker exec academy-redis redis-cli BGSAVE

# Wait for save to complete
docker exec academy-redis redis-cli LASTSAVE

# Copy RDB snapshot out
docker cp academy-redis:/data/dump.rdb /backups/redis/dump-$(date +%F).rdb
```

### Restore

```bash
# Stop Redis
docker compose stop redis

# Replace data files in the volume
# (find volume mount point first)
docker volume inspect academy_redis_data | grep Mountpoint

# Copy backup files into the volume
sudo cp /backups/redis/dump.rdb <volume-mountpoint>/dump.rdb
sudo cp /backups/redis/appendonly.aof <volume-mountpoint>/appendonly.aof

# Restart Redis
docker compose up -d redis
```

### What Redis stores

- User session tokens
- Rate-limiting counters
- Cached course catalog data
- Temporary assessment state

> **Note**: Redis data is ephemeral by design. Losing Redis means users must re-authenticate and caches rebuild automatically. AOF persistence minimizes this disruption.

---

## 4. MinIO (Object Storage)

### Data location

MinIO data is stored in the Docker volume `minio_data`. This contains:

- **Course videos** — uploaded lecture recordings
- **Documents** — PDF materials, slide decks, handouts
- **Avatars** — user profile images
- **Certificates** — generated completion certificates (PDF)

### Backup

```bash
# Archive the entire MinIO volume
docker run --rm \
  -v minio_data:/data \
  -v /backups:/backup \
  alpine tar czf /backup/minio-$(date +%F).tar.gz /data
```

For large datasets, consider incremental backups using `mc mirror`:

```bash
# Using MinIO Client (mc)
docker run --rm --network academy_default \
  minio/mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD

docker run --rm --network academy_default \
  -v /backups/minio-mirror:/backup \
  minio/mc mirror local/ /backup/
```

### Restore

```bash
# Stop MinIO
docker compose stop minio

# Remove current volume and recreate
docker volume rm minio_data
docker volume create minio_data

# Restore from archive
docker run --rm \
  -v minio_data:/data \
  -v /backups:/backup \
  alpine tar xzf /backup/minio-2026-04-17.tar.gz -C /

# Restart MinIO
docker compose up -d minio
```

---

## 5. Kafka

### Architecture

Kafka runs in **KRaft mode** (no ZooKeeper dependency). Data is stored in the `kafka_data` Docker volume.

### Backup considerations

Kafka is used as a **transient message bus** in Topnet Solutions Academy. Key characteristics:

- **Topics are auto-created** by backend services on startup
- **Messages are event notifications** (enrollment events, assessment completions, live session updates)
- **Consumer offsets** are stored within Kafka itself
- **State is transient** — all critical data is persisted in PostgreSQL

### Impact of Kafka data loss

- Services will recreate topics automatically on restart
- Consumer offsets will be reset, meaning some events may be re-processed from the last committed offset
- No permanent data loss occurs because PostgreSQL is the source of truth
- Services are designed to handle duplicate event processing (idempotent consumers)

### Recovery

```bash
# If Kafka volume is corrupted, remove and recreate
docker compose stop kafka
docker volume rm kafka_data
docker compose up -d kafka

# Services will auto-create topics on next startup
docker compose restart course-service learning-service assessment-service live-service
```

> **Note**: Kafka backup is generally unnecessary for this deployment. If message replay is needed, services can regenerate events from PostgreSQL state.

---

## 6. Full VM Recovery

If VM-ACADEMY needs to be rebuilt from scratch, follow these steps:

### Prerequisites

- Fresh Ubuntu VM (8 vCPU, 32 GB RAM, 300 GB storage)
- SSH access configured
- Backup files available (PostgreSQL dump, MinIO archive)

### Step-by-step recovery

```bash
# 1. Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Clone the repository
git clone <repository-url> /opt/academy
cd /opt/academy

# 3. Configure environment
cp .env.example .env
# Edit .env with production values (DB credentials, JWT secrets, etc.)

# 4. Start infrastructure services first
docker compose up -d postgres redis kafka minio traefik

# 5. Wait for PostgreSQL to be ready
docker exec academy-postgres pg_isready -U topnet_user
# Retry until ready

# 6. Restore PostgreSQL from backup
./infra/scripts/restore-postgres.sh /backups/postgres/latest.dump --force

# 7. Restore MinIO data
docker run --rm \
  -v minio_data:/data \
  -v /backups:/backup \
  alpine tar xzf /backup/minio-latest.tar.gz -C /

# 8. Start application services
docker compose up -d

# 9. Verify health
./infra/scripts/health-check.sh

# 10. Restore cron jobs
sudo cp infra/scripts/backup-cron.conf /etc/cron.d/academy-backup
sudo systemctl restart cron

# 11. Verify DNS and TLS
curl -I https://learning.topnet-solutions.com
```

### VM-BBB (BigBlueButton) recovery

BigBlueButton runs on a separate VM (8 vCPU, 16 GB RAM, 200 GB storage). Recovery:

1. Install BigBlueButton following official docs: https://docs.bigbluebutton.org/administration/install/
2. Configure the shared secret in the Topnet Solutions `.env` file (`BBB_SECRET`)
3. Verify webhook integration with the live service (port 4004)

---

## 7. Recovery Time Objectives

| Component    | RPO (Recovery Point Objective)         | RTO (Recovery Time Objective) | Notes                                         |
|--------------|----------------------------------------|-------------------------------|-----------------------------------------------|
| PostgreSQL   | ~24 hours (daily backups)              | ~30 minutes                   | Enable WAL archiving for RPO ~seconds         |
| Redis        | ~seconds (AOF persistence)             | ~5 minutes                    | Restart and AOF replay                        |
| MinIO        | Depends on backup frequency            | ~1 hour                       | Proportional to data volume                   |
| Kafka        | N/A (transient)                        | ~5 minutes                    | Topics auto-recreated                         |
| Full platform| ~24 hours (bound by PostgreSQL RPO)    | ~2 hours from clean VM        | Includes Docker install, restore, verification|

### Improving RPO

To reduce PostgreSQL RPO from 24 hours to seconds:

1. Enable WAL archiving (`archive_mode = on`)
2. Ship WAL segments to `/backups/postgres/wal/`
3. Take periodic base backups with `pg_basebackup`
4. Use `recovery_target_time` for point-in-time recovery

---

## 8. Testing the Recovery Plan

### Monthly tests

- [ ] Restore the latest PostgreSQL backup to a test container
- [ ] Verify row counts match production
- [ ] Run health-check script against restored instance
- [ ] Verify RLS policies are intact (multi-tenant isolation)

```bash
# Monthly restore test
docker run -d --name pg-test -e POSTGRES_USER=topnet_user -e POSTGRES_PASSWORD=test postgres:16
docker cp /backups/postgres/daily/latest.dump pg-test:/tmp/restore.dump
docker exec pg-test pg_restore -U topnet_user -d topnet_academy /tmp/restore.dump
# Verify
docker exec pg-test psql -U topnet_user -d topnet_academy -c "SELECT count(*) FROM users;"
# Cleanup
docker rm -f pg-test
```

### Quarterly DR drill

- [ ] Provision a fresh staging VM
- [ ] Execute the full VM recovery procedure (Section 6)
- [ ] Verify all services are healthy
- [ ] Run the test suite against the restored environment
- [ ] Verify TLS certificate issuance via Traefik
- [ ] Test BigBlueButton integration
- [ ] Document any issues and update this plan

### After each drill

1. Record the actual RTO achieved
2. Note any missing steps or outdated instructions
3. Update this document with corrections
4. File issues for any automation improvements needed

---

## Emergency Contacts

| Role               | Responsibility                          |
|--------------------|-----------------------------------------|
| DevOps Lead        | VM access, Docker, infrastructure       |
| DBA                | PostgreSQL restore, data integrity      |
| Backend Lead       | Service configuration, Kafka, API       |
| Frontend Lead      | Next.js deployment, CDN, Traefik       |
| Topnet Solutions IT         | VM provisioning, network, DNS           |

---

## Revision History

| Date       | Author    | Change                           |
|------------|-----------|----------------------------------|
| 2026-04-17 | Team      | Initial disaster recovery plan   |
