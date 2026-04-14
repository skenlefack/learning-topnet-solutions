#!/bin/bash
# ============================================================================
# ARIS Academy — Kafka Topic Initialization
# Creates all 11 topics with specific partition/retention configs
# Idempotent: safe to run multiple times (--if-not-exists)
# ============================================================================

set -euo pipefail

BOOTSTRAP_SERVER="${KAFKA_BOOTSTRAP_SERVER:-localhost:9092}"
REPLICATION_FACTOR="${KAFKA_REPLICATION_FACTOR:-1}"

# Detect $KAFKA_TOPICS_CMD path (bitnami vs apache/kafka images)
if command -v kafka-topics.sh &>/dev/null; then
  KAFKA_TOPICS_CMD="kafka-topics.sh"
elif [ -f /opt/kafka/bin/kafka-topics.sh ]; then
  KAFKA_TOPICS_CMD="/opt/kafka/bin/kafka-topics.sh"
else
  echo "ERROR: kafka-topics.sh not found"
  exit 1
fi

echo "=== ARIS Academy — Kafka Topic Init ==="
echo "Bootstrap server: $BOOTSTRAP_SERVER"
echo ""

# Wait for Kafka to be fully ready
echo "Waiting for Kafka to be ready..."
for i in $(seq 1 30); do
  if $KAFKA_TOPICS_CMD --bootstrap-server "$BOOTSTRAP_SERVER" --list > /dev/null 2>&1; then
    echo "Kafka is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Kafka not ready after 30 attempts. Exiting."
    exit 1
  fi
  echo "  Attempt $i/30 — waiting 2s..."
  sleep 2
done

echo ""

create_topic() {
  local topic="$1"
  local partitions="$2"
  shift 2
  local configs=("$@")

  local config_args=""
  for cfg in "${configs[@]}"; do
    config_args="$config_args --config $cfg"
  done

  echo "Creating topic: $topic (partitions=$partitions, replication=$REPLICATION_FACTOR)"
  $KAFKA_TOPICS_CMD --bootstrap-server "$BOOTSTRAP_SERVER" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --partitions "$partitions" \
    --replication-factor "$REPLICATION_FACTOR" \
    $config_args

  echo "  OK"
}

# ============================================================================
# academy.course.* — 3 partitions, 30 days retention
# ============================================================================
create_topic "academy.course.published.v1" 3 \
  "retention.ms=2592000000" \
  "cleanup.policy=delete"

create_topic "academy.course.updated.v1" 3 \
  "retention.ms=2592000000" \
  "cleanup.policy=delete"

# ============================================================================
# academy.enrollment.* — 3 partitions, 90 days retention
# ============================================================================
create_topic "academy.enrollment.created.v1" 3 \
  "retention.ms=7776000000" \
  "cleanup.policy=delete"

# ============================================================================
# academy.progress.* — 6 partitions (high frequency), 7 days retention
# ============================================================================
create_topic "academy.progress.updated.v1" 6 \
  "retention.ms=604800000" \
  "cleanup.policy=delete"

# ============================================================================
# academy.lesson.* — 3 partitions, 30 days retention
# ============================================================================
create_topic "academy.lesson.completed.v1" 3 \
  "retention.ms=2592000000" \
  "cleanup.policy=delete"

# ============================================================================
# academy.assessment.* — 3 partitions, 90 days retention
# ============================================================================
create_topic "academy.assessment.submitted.v1" 3 \
  "retention.ms=7776000000" \
  "cleanup.policy=delete"

# ============================================================================
# academy.certification.* — 1 partition, infinite retention (compacted)
# ============================================================================
create_topic "academy.certification.issued.v1" 1 \
  "retention.ms=-1" \
  "cleanup.policy=compact"

# ============================================================================
# academy.live.* — 3 partitions, 30 days retention
# ============================================================================
create_topic "academy.live.scheduled.v1" 3 \
  "retention.ms=2592000000" \
  "cleanup.policy=delete"

create_topic "academy.live.started.v1" 3 \
  "retention.ms=2592000000" \
  "cleanup.policy=delete"

create_topic "academy.live.recorded.v1" 3 \
  "retention.ms=2592000000" \
  "cleanup.policy=delete"

# ============================================================================
# academy.audit.events — 6 partitions, 365 days, compact+delete
# ============================================================================
create_topic "academy.audit.events" 6 \
  "retention.ms=31536000000" \
  "cleanup.policy=compact,delete"

echo ""
echo "=== All 11 topics created successfully ==="
$KAFKA_TOPICS_CMD --bootstrap-server "$BOOTSTRAP_SERVER" --list | grep "^academy\."
echo ""
echo "Done."
