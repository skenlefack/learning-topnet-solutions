// ============================================================================
// Topnet Solutions Academy — Audit Log Helper
// Writes to academy_core.audit_log AND publishes to Kafka AUDIT_EVENTS topic
// ============================================================================
import { query } from '../db';
import { publishEvent, TOPICS } from '../kafka';

export interface AuditLogEntry {
  userId: string;
  tenantId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Records an auditable action in both PostgreSQL and Kafka.
 *
 * @example
 * await auditLog(
 *   request.user.sub,
 *   request.tenantId,
 *   'course.created',
 *   'course',
 *   courseId,
 *   { title: 'New Course' },
 *   request.ip,
 * );
 */
export async function auditLog(
  userId: string,
  tenantId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details: Record<string, unknown> = {},
  ipAddress?: string,
): Promise<void> {
  // 1. Persist to database
  await query(
    `INSERT INTO academy_core.audit_log
       (user_id, tenant_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::inet)`,
    [
      userId,
      tenantId,
      action,
      entityType ?? null,
      entityId ?? null,
      JSON.stringify(details),
      ipAddress ?? null,
    ],
  );

  // 2. Publish to Kafka (fire-and-forget style — log errors but don't throw)
  try {
    await publishEvent(
      TOPICS.AUDIT_EVENTS,
      { action, entityType, entityId, details, ipAddress },
      tenantId,
      userId,
    );
  } catch (err) {
    console.error('[Audit] Failed to publish Kafka event:', err);
  }
}
